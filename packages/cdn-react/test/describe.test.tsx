/**
 * `describe` — the read that makes an attachment renderer possible at all, and
 * the three properties it is built around.
 *
 * 1. THE BATCH IS A TRANSPORT DETAIL AND THE CACHE UNIT IS THE REF. A page of
 *    thirty bubbles asks per ref and issues ONE request; a thirty-first bubble
 *    holding a ref somebody already resolved issues none.
 * 2. MISSING IS DATA. A deleted or malformed ref comes back inside a 200 and
 *    resolves to `null` — never a rejection, because one dead attachment must
 *    not cost a page its other thirty-nine.
 * 3. THE RATE LIMITER IS THE ONE FAILURE WORTH RE-ASKING, and the server says
 *    when. Everything else is a settled answer.
 *
 * Requests are COUNTED here rather than asserted about, for the same reason
 * `dedup.test.ts` counts them: "coalesced" is a claim about how many POSTs left
 * the browser, and only a count can disprove it.
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  createDescribeLoader,
  describeRetryDelayMs,
  isRateLimited,
  useDescribe,
  useDescribeRef,
} from "../src/index.js";
import { StapelApiError } from "@stapel/core";
import { createHarnessRuntime, TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { describeResponse, renderMeta } from "./fixtures.js";

const A = `product/${"a".repeat(64)}`;
const B = `product/${"b".repeat(64)}`;
const GONE = `product/${"c".repeat(64)}`;

function wrapperFor(server: MockServer) {
  return function Wrapper(props: { children: ReactNode }): ReactNode {
    return <TestHarness server={server}>{props.children}</TestHarness>;
  };
}

function serverWith(body: unknown, status = 200): MockServer {
  return mockServer({ "/describe/": { status, body } });
}

describe("the batching loader (no React)", () => {
  it("coalesces every ref raised before the window closes into ONE request", async () => {
    const server = serverWith(
      describeResponse({ [A]: renderMeta({ ref: A }), [B]: renderMeta({ ref: B }) })
    );
    const { api } = createHarnessRuntime({ server });
    const loader = createDescribeLoader(api);

    const both = await Promise.all([loader.load(A), loader.load(B)]);

    expect(both[0]?.ref).toBe(A);
    expect(both[1]?.ref).toBe(B);
    expect(server.count("/describe/")).toBe(1);
  });

  it("gives the SAME ref asked for twice one request and two answers", async () => {
    const server = serverWith(describeResponse({ [A]: renderMeta({ ref: A }) }));
    const { api } = createHarnessRuntime({ server });
    const loader = createDescribeLoader(api);

    const [first, second] = await Promise.all([loader.load(A), loader.load(A)]);

    expect(first?.ref).toBe(A);
    expect(second?.ref).toBe(A);
    expect(server.count("/describe/")).toBe(1);
  });

  it("splits past the ceiling instead of sending a request the server refuses", async () => {
    const server = serverWith(describeResponse({}, []));
    const { api } = createHarnessRuntime({ server });
    const loader = createDescribeLoader(api, { maxRefs: 2 });

    await Promise.all(
      [A, B, GONE].map((ref) => loader.load(ref).catch(() => null))
    );

    // Three refs, a ceiling of two: two requests, not one refused with
    // `error.400.too_many_refs`.
    expect(server.count("/describe/")).toBe(2);
  });

  it("resolves a missing ref to NULL — a 200 is an answer, not a rejection", async () => {
    const server = serverWith(describeResponse({}, [GONE]));
    const { api } = createHarnessRuntime({ server });
    const loader = createDescribeLoader(api);

    await expect(loader.load(GONE)).resolves.toBeNull();
  });

  it("rejects — does not report missing — when the transport failed", async () => {
    const server = serverWith({ localizable_error: "error.500.server", error: "x" }, 500);
    const { api } = createHarnessRuntime({ server });
    const loader = createDescribeLoader(api);

    // "This attachment is gone" and "we could not ask" are different sentences,
    // and collapsing the second into the first would make an outage look like a
    // deletion.
    await expect(loader.load(A)).rejects.toBeInstanceOf(StapelApiError);
  });
});

describe("the rate limiter is the one failure worth re-asking", () => {
  it("recognises 429 and nothing else", () => {
    expect(isRateLimited(new StapelApiError({ code: "x", message: "x", status: 429 }))).toBe(
      true
    );
    expect(isRateLimited(new StapelApiError({ code: "x", message: "x", status: 403 }))).toBe(
      false
    );
    expect(isRateLimited(new Error("network"))).toBe(false);
  });

  it("waits for the server's own retry_after rather than guessing", () => {
    const limited = new StapelApiError({
      code: "error.429.rate_limited",
      message: "slow down",
      status: 429,
      params: { retry_after: 4 },
    });
    expect(describeRetryDelayMs(limited)).toBe(4_000);
  });

  it("clamps a hostile retry_after and falls back when there is none", () => {
    const hostile = new StapelApiError({
      code: "error.429.rate_limited",
      message: "slow down",
      status: 429,
      params: { retry_after: 86_400 },
    });
    expect(describeRetryDelayMs(hostile)).toBe(60_000);
    expect(describeRetryDelayMs(new Error("no params"))).toBe(1_000);
  });
});

describe("useDescribe", () => {
  it("resolves a list into snapshots keyed by ref, in one request", async () => {
    const server = serverWith(
      describeResponse({ [A]: renderMeta({ ref: A }), [B]: renderMeta({ ref: B }) })
    );
    const { result } = renderHook(() => useDescribe([A, B]), {
      wrapper: wrapperFor(server),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    expect(server.count("/describe/")).toBe(1);
    expect(result.current.get(A)?.ref).toBe(A);
    expect(result.current.get(B)?.ref).toBe(B);
  });

  it("reports a resolved-to-nothing ref as data, and the map keeps the rest", async () => {
    const server = serverWith(
      describeResponse({ [A]: renderMeta({ ref: A }) }, [GONE])
    );
    const { result } = renderHook(() => useDescribe([A, GONE]), {
      wrapper: wrapperFor(server),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    expect(result.current.missing).toEqual([GONE]);
    // `null` (resolved to nothing) and `undefined` (never asked) are different
    // answers, and `get` keeps them apart — collapsing them with a `??` turns
    // "this attachment is gone" back into "not asked yet".
    expect(result.current.get(GONE)).toBeNull();
    expect(result.current.get(`product/${"d".repeat(64)}`)).toBeUndefined();
    expect(result.current.state.status === "ready" && result.current.state.data.size).toBe(1);
  });

  it("fails the bag when the transport failed — not 'everything is missing'", async () => {
    const server = serverWith({ localizable_error: "error.500.server", error: "x" }, 500);
    const { result } = renderHook(() => useDescribe([A]), {
      wrapper: wrapperFor(server),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("failed");
    });
    expect(result.current.missing).toEqual([]);
  });

  it("asks nothing at all for an empty list", () => {
    const server = serverWith(describeResponse({}));
    const { result } = renderHook(() => useDescribe([]), {
      wrapper: wrapperFor(server),
    });
    expect(result.current.state.status).toBe("ready");
    expect(server.count("/describe/")).toBe(0);
  });

  it("collapses duplicates before the request — a thread repeats attachments", async () => {
    const server = serverWith(describeResponse({ [A]: renderMeta({ ref: A }) }));
    const { result } = renderHook(() => useDescribe([A, A, A]), {
      wrapper: wrapperFor(server),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    expect(server.count("/describe/")).toBe(1);
  });

  it("useDescribeRef asks nothing for a null reference", () => {
    const server = serverWith(describeResponse({}));
    const { result } = renderHook(() => useDescribeRef(null), {
      wrapper: wrapperFor(server),
    });
    expect(result.current.state.status).toBe("ready");
    expect(server.count("/describe/")).toBe(0);
  });
});
