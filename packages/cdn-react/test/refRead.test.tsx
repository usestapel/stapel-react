/**
 * `useCdnRef` — the pair's one cached read, in its three outcomes plus the
 * fourth one that matters most here: a 200 that says "not mine".
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { matchLoad } from "@stapel/core";
import { parseCdnRef, formatCdnRef, useCdnRef } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { hit, imageRow, MISS, refusal } from "./fixtures.js";

const HASH = "a".repeat(64);
const REF = `product/${HASH}`;

function wrapperFor(server: MockServer) {
  return function Wrapper(props: { children: ReactNode }): ReactNode {
    return <TestHarness server={server}>{props.children}</TestHarness>;
  };
}

describe("resolving a stored reference (the three outcomes)", () => {
  it("ready with the row, and asks by hash — not by the whole reference", async () => {
    const server = mockServer({ "/file/exists/": { body: hit(imageRow({ hash: HASH })) } });
    const { result } = renderHook(() => useCdnRef(REF), {
      wrapper: wrapperFor(server),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    expect(server.calls[0]?.url).toContain(`file_hash=${HASH}`);
    expect(server.calls[0]?.url).not.toContain("product/");
  });

  it("ready with NULL for a reference that resolves to nothing — a 200 is an answer", async () => {
    const server = mockServer({ "/file/exists/": { body: MISS } });
    const { result } = renderHook(() => useCdnRef(REF), {
      wrapper: wrapperFor(server),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });
    const shown = matchLoad(result.current.state, {
      loading: () => "loading",
      failed: () => "failed",
      ready: (image) => (image === null ? "absent" : "present"),
    });
    // "not stored / not mine" and "we could not ask" must not collapse.
    expect(shown).toBe("absent");
  });

  it("failed when the read failed", async () => {
    const server = mockServer({
      "/file/exists/": { status: 503, body: refusal("error.500.internal", "x") },
    });
    const { result } = renderHook(() => useCdnRef(REF), {
      wrapper: wrapperFor(server),
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("failed");
    });
  });

  it("stays loading and asks nothing for a null reference", () => {
    const server = mockServer({});
    const { result } = renderHook(() => useCdnRef(null), {
      wrapper: wrapperFor(server),
    });

    expect(result.current.state.status).toBe("loading");
    expect(server.calls).toHaveLength(0);
  });

  it("asks nothing for a string that is not a reference", () => {
    const server = mockServer({});
    const { result } = renderHook(() => useCdnRef("not-a-ref"), {
      wrapper: wrapperFor(server),
    });

    expect(result.current.state.status).toBe("loading");
    expect(server.calls).toHaveLength(0);
  });
});

describe("the reference is opaque, and parsed strictly", () => {
  it("round-trips", () => {
    expect(parseCdnRef(formatCdnRef("avatar", HASH))).toEqual({
      assetType: "avatar",
      fileHash: HASH,
    });
  });

  it("accepts an asset type this build has never heard of", () => {
    // ASSET_TYPES is a deployment setting; refusing an unfamiliar type here
    // would refuse a host's own configuration.
    expect(parseCdnRef(`whatever/${HASH}`)?.assetType).toBe("whatever");
  });

  it("rejects anything whose hash half is not 64 lowercase hex", () => {
    expect(parseCdnRef("product/short")).toBeNull();
    expect(parseCdnRef(`product/${"A".repeat(64)}`)).toBeNull();
    expect(parseCdnRef(HASH)).toBeNull();
    expect(parseCdnRef(`/${HASH}`)).toBeNull();
  });
});
