/**
 * The queue: order, capacity, cancellation, retry — and the two gates a
 * composer reads before it lets anybody press Save.
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useCdnRef, useUploadQueue } from "../src/index.js";
import type { UploadQueueBag } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { bigImageFile, hit, imageFile, imageRow, MISS, uploaded } from "./fixtures.js";

function wrapperFor(server: MockServer) {
  return function Wrapper(props: { children: ReactNode }): ReactNode {
    return <TestHarness server={server}>{props.children}</TestHarness>;
  };
}

/** A server that stores whatever arrives, echoing a row for its own hash. */
function storingServer(): MockServer {
  return mockServer({
    "/file/exists/": { body: MISS },
    "/upload/image/": (call) => ({
      status: 201,
      body: uploaded(
        imageRow({ hash: hashFor(call.file?.name ?? "unknown") })
      ),
    }),
  });
}

/** A stable fake hash per filename, so refs are distinguishable in assertions. */
function hashFor(name: string): string {
  let seed = 0;
  for (const char of name) seed = (seed * 31 + char.charCodeAt(0)) % 16;
  return seed.toString(16).repeat(64);
}

async function settle(result: { current: UploadQueueBag }): Promise<void> {
  await waitFor(() => {
    expect(result.current.items.every((item) => item.phase !== "idle")).toBe(true);
  });
}

describe("admitting files", () => {
  it("uploads each pick and exposes the references in display order", async () => {
    const server = storingServer();
    const { result } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg"), imageFile("b.jpg", "other-bytes")]);
    });
    await waitFor(() => {
      expect(result.current.refs).toHaveLength(2);
    });

    expect(server.count("/upload/image/")).toBe(2);
    expect(result.current.refs[0]).toBe(`product/${hashFor("a.jpg")}`);
    expect(result.current.refs[1]).toBe(`product/${hashFor("b.jpg")}`);
  });

  it("a file over the ceiling is ADMITTED as a failed item, not silently dropped", async () => {
    const server = storingServer();
    const { result } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([bigImageFile(21 * 1024 * 1024, "huge.jpg")]);
    });

    await waitFor(() => {
      expect(result.current.items[0]?.phase).toBe("failed");
    });
    expect(result.current.items[0]?.error?.code).toBe("error.413.file_too_large");
    // A tile that vanishes on drop teaches the person nothing.
    expect(result.current.items).toHaveLength(1);
    expect(server.count("/upload/image/")).toBe(0);
  });

  it("overflow past `max` is admitted with the pair's own reason", async () => {
    const server = storingServer();
    const { result } = renderHook(() => useUploadQueue({ max: 1 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg"), imageFile("b.jpg", "other")]);
    });
    await settle(result);

    expect(result.current.items[1]?.error?.code).toBe("cdn.upload.blocked.full");
    // Client-side rule, no server involved — status 0, never a fabricated 4xx.
    expect(result.current.items[1]?.error?.status).toBe(0);
  });
});

describe("capacity and the gates", () => {
  it("canAdd is blocked WITH a reason once the gallery is full", async () => {
    const server = storingServer();
    const { result } = renderHook(
      () => useUploadQueue({ max: 1, initialRefs: [`product/${"a".repeat(64)}`] }),
      { wrapper: wrapperFor(server) }
    );

    expect(result.current.capacity).toEqual({ max: 1, used: 1, remaining: 0 });
    expect(result.current.canAdd.available).toBe(false);
    expect(result.current.canAdd.block?.code).toBe("cdn.upload.blocked.full");
    expect(result.current.canAdd.block?.params["max"]).toBe(1);
  });

  it("settled blocks while an upload is in flight, then opens", async () => {
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": {
        status: 201,
        body: uploaded(imageRow({ hash: "a".repeat(64) })),
      },
    });
    const { result } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg")]);
    });
    // Immediately after admitting, the item is queued and Save must be blocked.
    expect(result.current.settled.available).toBe(false);
    expect(result.current.settled.block?.code).toBe("cdn.upload.blocked.pending");

    await waitFor(() => {
      expect(result.current.refs).toHaveLength(1);
    });
    expect(result.current.settled.available).toBe(true);
  });

  it("settled stays blocked — for a DIFFERENT reason — when an item failed", async () => {
    const server = storingServer();
    const { result } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([bigImageFile(21 * 1024 * 1024, "huge.jpg")]);
    });
    await waitFor(() => {
      expect(result.current.items[0]?.phase).toBe("failed");
    });

    expect(result.current.settled.block?.code).toBe("cdn.upload.blocked.failed");
  });
});

describe("per-item control (spec §8.2 — cancel one file out of the queue)", () => {
  it("cancel aborts one item and leaves the others alone", async () => {
    const started: string[] = [];
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": (call) => {
        started.push(call.file?.name ?? "?");
        return {
          status: 201,
          body: uploaded(imageRow({ hash: hashFor(call.file?.name ?? "") })),
        };
      },
    });
    const { result } = renderHook(() => useUploadQueue({ max: 10, concurrency: 1 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg"), imageFile("b.jpg", "other")]);
    });
    const second = result.current.items[1]?.id ?? "";
    act(() => {
      result.current.cancel(second);
    });

    await waitFor(() => {
      expect(result.current.items[0]?.phase).toBe("done");
    });
    expect(result.current.refs).toEqual([`product/${hashFor("a.jpg")}`]);
  });

  it("retry re-runs a failed item and can succeed the second time", async () => {
    let attempt = 0;
    const server = mockServer({
      "/file/exists/": { body: MISS },
      "/upload/image/": () => {
        attempt += 1;
        return attempt === 1
          ? { status: 503, body: { localizable_error: "error.500.internal", error: "x" } }
          : { status: 201, body: uploaded(imageRow({ hash: "c".repeat(64) })) };
      },
    });
    const { result } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg")]);
    });
    await waitFor(() => {
      expect(result.current.items[0]?.phase).toBe("failed");
    });

    act(() => {
      result.current.retry(result.current.items[0]?.id ?? "");
    });
    await waitFor(() => {
      expect(result.current.refs).toEqual([`product/${"c".repeat(64)}`]);
    });
  });

  it("remove drops the item and the reference with it", async () => {
    const server = storingServer();
    const { result } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg")]);
    });
    await waitFor(() => {
      expect(result.current.refs).toHaveLength(1);
    });

    act(() => {
      result.current.remove(result.current.items[0]?.id ?? "");
    });
    expect(result.current.refs).toEqual([]);
    expect(result.current.capacity.used).toBe(0);
  });
});

describe("the order IS the meaning", () => {
  it("reorder moves a reference and the list reports the new order", async () => {
    const server = storingServer();
    const { result } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg"), imageFile("b.jpg", "other")]);
    });
    await waitFor(() => {
      expect(result.current.refs).toHaveLength(2);
    });

    act(() => {
      result.current.reorder(1, 0);
    });
    expect(result.current.refs).toEqual([
      `product/${hashFor("b.jpg")}`,
      `product/${hashFor("a.jpg")}`,
    ]);
  });

  it("an out-of-range move is a no-op, not a dropped photo", async () => {
    const server = storingServer();
    const { result } = renderHook(
      () => useUploadQueue({ max: 10, initialRefs: [`product/${"a".repeat(64)}`] }),
      { wrapper: wrapperFor(server) }
    );

    act(() => {
      result.current.reorder(0, 5);
    });
    expect(result.current.refs).toHaveLength(1);
  });

  it("onRefsChange fires on every change of the stored list, including reorder", async () => {
    const server = storingServer();
    const seen: string[][] = [];
    const { result } = renderHook(
      () =>
        useUploadQueue({
          max: 10,
          onRefsChange: (refs) => seen.push([...refs]),
        }),
      { wrapper: wrapperFor(server) }
    );

    act(() => {
      result.current.add([imageFile("a.jpg"), imageFile("b.jpg", "other")]);
    });
    await waitFor(() => {
      expect(result.current.refs).toHaveLength(2);
    });
    act(() => {
      result.current.reorder(1, 0);
    });

    await waitFor(() => {
      expect(seen.at(-1)).toEqual([
        `product/${hashFor("b.jpg")}`,
        `product/${hashFor("a.jpg")}`,
      ]);
    });
  });
});

describe("a reopened draft", () => {
  it("starts from stored references with no bytes uploaded, then resolves each row through the owner-scoped read", async () => {
    const server = storingServer();
    const refs = [`product/${"a".repeat(64)}`, `avatar/${"b".repeat(64)}`];
    const { result } = renderHook(() => useUploadQueue({ max: 10, initialRefs: refs }), {
      wrapper: wrapperFor(server),
    });

    expect(result.current.refs).toEqual(refs);
    expect(result.current.items.every((item) => item.file === null)).toBe(true);
    // No bytes cross the wire on a reopen — only the read that finds the row.
    expect(server.count("/upload/")).toBe(0);

    await waitFor(() => {
      expect(result.current.items.every((item) => item.restoredLookup === "done")).toBe(true);
    });
    // One `file/exists/` per distinct hash — see the cache-sharing test below
    // for the case where a hash is asked about only once across two hooks.
    expect(server.count("/file/exists/")).toBe(2);
  });

  it("resolves a restored item's row, so the composer's thumbnail has something to paint (D383)", async () => {
    const hash = "a".repeat(64);
    const ref = `product/${hash}`;
    const server = mockServer({ "/file/exists/": { body: hit(imageRow({ hash })) } });
    const { result } = renderHook(() => useUploadQueue({ max: 10, initialRefs: [ref] }), {
      wrapper: wrapperFor(server),
    });

    await waitFor(() => {
      expect(result.current.items[0]?.row).not.toBeNull();
    });
    expect(result.current.items[0]?.kind).toBe("image");
    expect(result.current.items[0]?.variantsReady).toBe(true);
    // Asked by HASH, not by the whole reference — same contract as `useCdnRef`.
    expect(server.calls[0]?.url).toContain(`file_hash=${hash}`);
  });

  it("a reference the server no longer resolves ends with no row, not a hang", async () => {
    const ref = `product/${"a".repeat(64)}`;
    const server = mockServer({ "/file/exists/": { body: MISS } });
    const { result } = renderHook(() => useUploadQueue({ max: 10, initialRefs: [ref] }), {
      wrapper: wrapperFor(server),
    });

    await waitFor(() => {
      expect(result.current.items[0]?.restoredLookup).toBe("done");
    });
    expect(result.current.items[0]?.row).toBeNull();
    // The gap is in the PICTURE only — count, order and the publish gate
    // never depended on the row resolving.
    expect(result.current.refs).toEqual([ref]);
    expect(result.current.settled.available).toBe(true);
  });

  it("shares the cache with useCdnRef — a hash already resolved costs the queue no second request", async () => {
    const hash = "a".repeat(64);
    const ref = `product/${hash}`;
    const server = mockServer({ "/file/exists/": { body: hit(imageRow({ hash })) } });

    const { result } = renderHook(
      () => ({
        resolved: useCdnRef(ref),
        queue: useUploadQueue({ max: 10, initialRefs: [ref] }),
      }),
      { wrapper: wrapperFor(server) }
    );

    await waitFor(() => {
      expect(result.current.queue.items[0]?.row).not.toBeNull();
    });
    // Two callers asked about the SAME hash; the query cache — keyed on the
    // hash, same as `useCdnRef` — collapses them into one request.
    expect(server.count("/file/exists/")).toBe(1);
  });
});

describe("leaving the page", () => {
  it("aborts anything still in flight on unmount", async () => {
    const abort = vi.spyOn(AbortController.prototype, "abort");
    const server = storingServer();
    const { result, unmount } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg")]);
    });
    unmount();

    expect(abort).toHaveBeenCalled();
    abort.mockRestore();
  });

  /**
   * THE TIDY-UP WAS CAUSING THE WRITE IT EXISTS TO PREVENT.
   *
   * The cleanup above aborts everything in flight; an abort REJECTS the
   * upload's promise; and that rejection's handler is the code that patches
   * `phase: "canceled"` in. So the unmount reliably scheduled a state write
   * onto a tree React had already taken down — one microtask later, which is
   * after this hook has no business writing anything.
   *
   * In a browser that write is a pointless update to nothing. In CI it landed
   * a run after the test environment was torn down and came back as
   * `ReferenceError: window is not defined` out of React's
   * `resolveUpdatePriority` — a whole release blocked by a queue that could
   * not tell it had been unmounted (run 33970729266, cdn-react, all 15 files
   * green and the run failed anyway).
   *
   * What is asserted here is the sequence, not the symptom: the settlement is
   * allowed to happen AFTER the unmount, which is the ordering that broke, and
   * the file's own unhandled-rejection gate is what fails if the write comes
   * back.
   */
  it("lets an aborted upload settle after unmount without writing state", async () => {
    const server = storingServer();
    const { result, unmount } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg")]);
    });
    // Mid-flight — the upload has begun and has not finished.
    await waitFor(() => {
      expect(result.current.items[0]?.phase).not.toBe("idle");
    });

    unmount();

    // Hand the microtask queue back so every abort rejection runs its handler
    // while the tree is gone. Before the `alive` guard this is the moment the
    // queue patched state into nothing.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
