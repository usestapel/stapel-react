import { describe, expect, it } from "vitest";
import {
  bothLoaded,
  isLoadFailed,
  isLoadLoading,
  isLoadReady,
  loadFailed,
  loadLoading,
  loadReady,
  loadStateFromQuery,
  loadedRowsOrEmpty,
  mapLoad,
  matchList,
  matchLoad,
} from "../src/loadState.js";
import { StapelApiError } from "../src/errors.js";

/** The four screens a list can put in front of a person. */
function render(state: Parameters<typeof matchList<string, string>>[0]): string {
  return matchList(state, {
    loading: () => "spinner",
    failed: () => "could not load",
    empty: () => "you have none",
    ready: (items) => `rows:${String(items.length)}`,
  });
}

describe("loadStateFromQuery", () => {
  it("reads a successful query as ready with its data", () => {
    const state = loadStateFromQuery({
      status: "success",
      data: ["a"],
      error: null,
    });
    expect(state).toEqual({ status: "ready", data: ["a"] });
  });

  it("reads a failed query as failed, carrying the thrown value verbatim", () => {
    const error = new StapelApiError({
      code: "stapel.http.404",
      message: "Request failed with status 404",
      status: 404,
    });
    const state = loadStateFromQuery({ status: "error", data: undefined, error });
    expect(isLoadFailed(state)).toBe(true);
    expect(state.status === "failed" && state.error).toBe(error);
  });

  it("reads a DISABLED query as loading, not as an empty result", () => {
    // The incident's earlier, quieter half: a session-ready-gated hook sits at
    // `status: "pending"` with `fetchStatus: "idle"`, so `isLoading` is FALSE.
    // Anything reading `isLoading` therefore reported "not loading, no error,
    // nothing here" for the whole session bootstrap.
    const state = loadStateFromQuery<readonly string[]>({
      status: "pending",
      data: undefined,
      error: null,
    });
    expect(isLoadLoading(state)).toBe(true);
    expect(render(state)).toBe("spinner");
  });

  it("keeps showing rows when a BACKGROUND refetch fails on top of good data", () => {
    // TanStack leaves `status: "success"` when a refetch fails but data is
    // still held. Blanking the screen there would be a second lie.
    const state = loadStateFromQuery({
      status: "success",
      data: ["a", "b"],
      error: new Error("refetch blew up"),
    });
    expect(isLoadReady(state)).toBe(true);
    expect(render(state)).toBe("rows:2");
  });
});

describe("matchList — the four answers stay four", () => {
  it("says 'you have none' ONLY for a load that actually succeeded", () => {
    expect(render(loadReady<readonly string[]>([]))).toBe("you have none");
  });

  it("says 'could not load' for a failure — never the empty copy", () => {
    expect(render(loadFailed(new Error("404")))).toBe("could not load");
    expect(render(loadFailed(new Error("404")))).not.toBe("you have none");
  });

  it("says 'spinner' before an answer exists", () => {
    expect(render(loadLoading())).toBe("spinner");
  });

  it("hands the ready arm a non-empty array", () => {
    const first = matchList(loadReady<readonly string[]>(["only"]), {
      loading: () => "",
      failed: () => "",
      empty: () => "",
      // `items[0]` is a string here, not `string | undefined` — that is the
      // NonEmptyArray guarantee, and it only holds because `empty` took the
      // zero-length case away first.
      ready: (items) => items[0],
    });
    expect(first).toBe("only");
  });

  it("routes every state through exactly one arm", () => {
    const seen: string[] = [];
    for (const state of [
      loadLoading(),
      loadFailed(new Error("x")),
      loadReady<readonly string[]>([]),
      loadReady<readonly string[]>(["a"]),
    ]) {
      matchList(state, {
        loading: () => seen.push("loading"),
        failed: () => seen.push("failed"),
        empty: () => seen.push("empty"),
        ready: () => seen.push("ready"),
      });
    }
    expect(seen).toEqual(["loading", "failed", "empty", "ready"]);
  });
});

describe("matchLoad", () => {
  it("dispatches on the discriminant", () => {
    const arms = {
      loading: () => "L",
      failed: () => "F",
      ready: (n: number) => `R${String(n)}`,
    };
    expect(matchLoad(loadLoading(), arms)).toBe("L");
    expect(matchLoad(loadFailed(new Error("x")), arms)).toBe("F");
    expect(matchLoad(loadReady(7), arms)).toBe("R7");
  });
});

describe("mapLoad / bothLoaded", () => {
  it("maps only the ready case", () => {
    expect(mapLoad(loadReady(2), (n) => n * 2)).toEqual({ status: "ready", data: 4 });
    expect(mapLoad(loadLoading(), (n: number) => n * 2)).toEqual({ status: "loading" });
  });

  it("waits for both, and surfaces the FIRST failure rather than masking it", () => {
    const boom = new Error("boom");
    expect(bothLoaded(loadReady(1), loadLoading())).toEqual({ status: "loading" });
    expect(bothLoaded(loadReady(1), loadReady("x"))).toEqual({
      status: "ready",
      data: [1, "x"],
    });
    // A slow sibling must not downgrade a real failure to "still loading".
    const combined = bothLoaded(loadFailed(boom), loadLoading());
    expect(combined.status === "failed" && combined.error).toBe(boom);
  });
});

describe("loadedRowsOrEmpty", () => {
  it("flattens only for the callers that do not discriminate", () => {
    expect(loadedRowsOrEmpty(loadReady<readonly string[]>(["a"]))).toEqual(["a"]);
    expect(loadedRowsOrEmpty(loadFailed(new Error("x")))).toEqual([]);
    expect(loadedRowsOrEmpty(loadLoading())).toEqual([]);
  });
});
