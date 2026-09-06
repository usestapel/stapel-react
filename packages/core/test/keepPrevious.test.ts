import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  keepPreviousLoad,
  loadFailed,
  loadLoading,
  loadReady,
  loadStateFromQuery,
} from "../src/loadState.js";
import type { LoadState } from "../src/loadState.js";
import { useKeptLoad } from "../src/useKeptLoad.js";
import { StapelApiError } from "../src/errors.js";

const pending: LoadState<readonly string[]> = loadLoading();

/** The defect this seam closes, as a test fixture: a boundary that swaps its
 * subtree for a skeleton on a parameter change unmounts everything below it.
 * "Did the screen go through `loading`" is therefore the whole question. */
function arm(state: LoadState<readonly string[]>): string {
  if (state.status === "loading") return "skeleton";
  if (state.status === "failed") return "error";
  return state.refreshing === true ? "rows(refreshing)" : "rows";
}

describe("keepPreviousLoad — the pure merge", () => {
  it("answers with the PREVIOUS data, marked refreshing, while the next load is pending", () => {
    const state = keepPreviousLoad(pending, ["a", "b"]);
    expect(state).toEqual({ status: "ready", data: ["a", "b"], refreshing: true });
    expect(arm(state)).toBe("rows(refreshing)");
  });

  it("loads with nothing behind it — a FIRST load still gets the skeleton", () => {
    expect(arm(keepPreviousLoad(pending, undefined))).toBe(
      "skeleton"
    );
  });

  it("stamps refreshing:false on a settled answer, so the DOM does not change shape", () => {
    // The flag is present on EVERY ready answer once this seam is in play.
    // A renderer that grows a wrapper when the flag appears would be adding a
    // different element at the same position — the remount being prevented.
    expect(keepPreviousLoad(loadReady(["a"]), ["old"])).toEqual({
      status: "ready",
      data: ["a"],
      refreshing: false,
    });
  });

  it("passes a REFUSAL straight through, on top of however much good data there was", () => {
    // Documented choice: the previous page is not held over an error. A dead
    // category wearing the last live one is a dead link that looks alive, and
    // the error arm owns the retry.
    const boom = new StapelApiError({
      code: "stapel.http.404",
      message: "Request failed with status 404",
      status: 404,
    });
    const state = keepPreviousLoad<readonly string[]>(loadFailed(boom), ["a"]);
    expect(arm(state)).toBe("error");
    expect(state.status === "failed" && state.error).toBe(boom);
  });
});

describe("loadStateFromQuery — keepPrevious", () => {
  it("reads TanStack's placeholder data as ready + refreshing", () => {
    // `placeholderData: keepPreviousData` hands the PREVIOUS key's answer over
    // while the new key is in flight, and flags it.
    const state = loadStateFromQuery(
      {
        status: "success",
        data: ["a"],
        error: null,
        isPlaceholderData: true,
      },
      { keepPrevious: true }
    );
    expect(state).toEqual({ status: "ready", data: ["a"], refreshing: true });
  });

  it("reads data held under a PENDING status the same way", () => {
    const state = loadStateFromQuery(
      { status: "pending", data: ["a"], error: null },
      { keepPrevious: true }
    );
    expect(arm(state)).toBe("rows(refreshing)");
  });

  it("still loads when there is nothing in hand", () => {
    const state = loadStateFromQuery<readonly string[]>(
      { status: "pending", data: undefined, error: null },
      { keepPrevious: true }
    );
    expect(arm(state)).toBe("skeleton");
  });

  it("still FAILS on a refusal, before anything else is considered", () => {
    const boom = new Error("nope");
    const state = loadStateFromQuery<readonly string[]>(
      { status: "error", data: ["a"], error: boom },
      { keepPrevious: true }
    );
    expect(state.status === "failed" && state.error).toBe(boom);
  });

  it("WITHOUT the option is byte-for-byte what it always was", () => {
    // Placeholder data included: an existing caller sees no new field and no
    // new behaviour, down to `toStrictEqual`.
    expect(
      loadStateFromQuery({
        status: "success",
        data: ["a"],
        error: null,
        isPlaceholderData: true,
      })
    ).toStrictEqual({ status: "ready", data: ["a"] });
    expect(
      loadStateFromQuery<readonly string[]>({
        status: "pending",
        data: ["a"],
        error: null,
      })
    ).toStrictEqual({ status: "loading" });
  });
});

describe("useKeptLoad — the memory", () => {
  it("holds the answer on the glass across a KEY CHANGE, never going through loading", () => {
    const seen: string[] = [];
    const { rerender } = renderHook(
      (state: LoadState<readonly string[]>) => {
        const kept = useKeptLoad(state, { keepPrevious: true });
        seen.push(arm(kept));
        return kept;
      },
      { initialProps: pending }
    );
    rerender(loadReady<readonly string[]>(["first"]));
    // The parameter changed: both reads behind the composed state went
    // pending again. This is the render that used to draw a skeleton.
    rerender(pending);
    rerender(loadReady<readonly string[]>(["second"]));

    expect(seen).toEqual(["skeleton", "rows", "rows(refreshing)", "rows"]);
    expect(seen.slice(1)).not.toContain("skeleton");
  });

  it("keeps the previous DATA, not just the previous status", () => {
    const { result, rerender } = renderHook(
      (state: LoadState<readonly string[]>) =>
        useKeptLoad(state, { keepPrevious: true }),
      { initialProps: loadReady<readonly string[]>(["held"]) }
    );
    rerender(pending);
    expect(result.current).toEqual({
      status: "ready",
      data: ["held"],
      refreshing: true,
    });
  });

  it("replaces the held page with the error arm when the next read REFUSES", () => {
    const boom = new Error("410 gone");
    const { result, rerender } = renderHook(
      (state: LoadState<readonly string[]>) =>
        useKeptLoad(state, { keepPrevious: true }),
      { initialProps: loadReady<readonly string[]>(["held"]) }
    );
    rerender(loadFailed(boom));
    expect(result.current.status).toBe("failed");
  });

  it("hands the state back UNTOUCHED when the host opts out", () => {
    // `keepPrevious` is an option rather than "don't call the hook", because
    // a hook cannot be called conditionally.
    const { result, rerender } = renderHook(
      (state: LoadState<readonly string[]>) =>
        useKeptLoad(state, { keepPrevious: false }),
      { initialProps: loadReady<readonly string[]>(["held"]) }
    );
    rerender(pending);
    expect(result.current).toStrictEqual({ status: "loading" });
  });

  it("defaults to opted out, so an existing call site changes nothing", () => {
    const { result, rerender } = renderHook(
      (state: LoadState<readonly string[]>) => useKeptLoad(state),
      { initialProps: loadReady<readonly string[]>(["held"]) }
    );
    rerender(pending);
    expect(result.current).toStrictEqual({ status: "loading" });
  });
});
