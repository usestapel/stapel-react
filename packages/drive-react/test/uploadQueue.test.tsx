/**
 * The upload queue: progress, concurrency, retry, cancel, and the 507.
 *
 * The PUT is driven through a fake `XMLHttpRequest` that the queue reaches the
 * same way a browser's does — `putWithProgress` is given an `xhrFactory` here
 * only because jsdom has no object store to PUT to; the code path, the event
 * names and the outcome folding are the shipped ones. The JSON steps go
 * through the real transport over a stubbed `fetch`, so a 507 arrives as the
 * real envelope and is folded by the real error layer.
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { putWithProgress, useUploadQueue } from "../src/index.js";
import { WORKSPACE_ID, harness, wire } from "./helpers.js";
import { DOC_A } from "./fixtures.js";

/** A hand-driven XHR: the test decides when progress ticks and when it lands. */
class FakeXhr {
  status = 0;
  readonly upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  aborted = false;
  sent: Blob | null = null;
  readonly headers = new Map<string, string>();
  withCredentials = false;

  open(): void {}
  setRequestHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }
  send(body: Blob): void {
    this.sent = body;
    FakeXhr.live.push(this);
  }
  abort(): void {
    this.aborted = true;
    this.onabort?.();
  }

  /** Emit one `upload.onprogress` tick. */
  progress(loaded: number, total: number): void {
    this.upload.onprogress?.({
      loaded,
      total,
      lengthComputable: true,
    } as ProgressEvent);
  }
  /** Finish with a status. */
  finish(status: number): void {
    this.status = status;
    this.onload?.();
  }

  static live: FakeXhr[] = [];
  static reset(): void {
    FakeXhr.live = [];
  }
}

function file(name: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type: "image/jpeg" });
}

const TICKET = {
  upload_id: "u-1",
  document_id: DOC_A.id,
  key: "ws/obj",
  put_url: "https://store.example/put/u-1",
  expires_at: null,
};

describe("putWithProgress — the transport fetch cannot provide", () => {
  it("reports every byte the browser reports, and lands on 100%", async () => {
    FakeXhr.reset();
    const seen: number[] = [];
    const promise = putWithProgress(TICKET.put_url, file("a.jpg", 100), {
      contentType: "image/jpeg",
      onProgress: ({ loaded }) => seen.push(loaded),
      xhrFactory: () => new FakeXhr() as unknown as XMLHttpRequest,
    });
    const xhr = FakeXhr.live[0];
    expect(xhr).toBeDefined();
    xhr?.progress(40, 100);
    xhr?.progress(80, 100);
    xhr?.finish(200);
    await expect(promise).resolves.toEqual({ ok: true, status: 200 });
    expect(seen).toEqual([40, 80, 100]);
  });

  it("sends the ticket's Content-Type — the store signs against it", async () => {
    FakeXhr.reset();
    const promise = putWithProgress(TICKET.put_url, file("a.jpg", 10), {
      contentType: "image/jpeg",
      xhrFactory: () => new FakeXhr() as unknown as XMLHttpRequest,
    });
    FakeXhr.live[0]?.finish(200);
    await promise;
    expect(FakeXhr.live[0]?.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("resolves a refusal instead of throwing it — the queue must branch on it", async () => {
    FakeXhr.reset();
    const promise = putWithProgress(TICKET.put_url, file("a.jpg", 10), {
      xhrFactory: () => new FakeXhr() as unknown as XMLHttpRequest,
    });
    FakeXhr.live[0]?.finish(403);
    await expect(promise).resolves.toEqual({ ok: false, status: 403 });
  });

  it("an abort rejects AS an abort, never as a dead backend", async () => {
    FakeXhr.reset();
    const controller = new AbortController();
    const promise = putWithProgress(TICKET.put_url, file("a.jpg", 10), {
      signal: controller.signal,
      xhrFactory: () => new FakeXhr() as unknown as XMLHttpRequest,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("refuses before opening anything when the signal is already aborted", async () => {
    FakeXhr.reset();
    const controller = new AbortController();
    controller.abort();
    await expect(
      putWithProgress(TICKET.put_url, file("a.jpg", 10), {
        signal: controller.signal,
        xhrFactory: () => new FakeXhr() as unknown as XMLHttpRequest,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXhr.live).toHaveLength(0);
  });
});

/** The queue with its transport swapped for the fake, nothing else changed. */
function queueHarness(routes: Parameters<typeof wire>[0]) {
  FakeXhr.reset();
  const stub = wire(routes);
  const { wrapper } = harness(stub);
  // The api object the runtime built is reached through the provider; the one
  // seam a test may move is the XHR constructor, so it is moved globally the
  // way a browser would supply it.
  const original = globalThis.XMLHttpRequest;
  vi.stubGlobal(
    "XMLHttpRequest",
    class extends FakeXhr {} as unknown as typeof XMLHttpRequest
  );
  return { stub, wrapper, restore: () => vi.stubGlobal("XMLHttpRequest", original) };
}

describe("useUploadQueue", () => {
  it("runs at most two files at once; the rest wait", async () => {
    const { wrapper, restore } = queueHarness({
      "/uploads": { body: TICKET },
      "/finalize": { body: DOC_A },
    });
    const { result } = renderHook(
      () => useUploadQueue({ workspaceId: WORKSPACE_ID }),
      { wrapper }
    );

    act(() => {
      result.current.add([
        file("a.jpg", 10),
        file("b.jpg", 10),
        file("c.jpg", 10),
      ]);
    });

    await waitFor(() => {
      expect(FakeXhr.live.length).toBe(2);
    });
    expect(
      result.current.items.filter((item) => item.status === "queued")
    ).toHaveLength(1);

    act(() => {
      FakeXhr.live[0]?.finish(200);
    });
    await waitFor(() => {
      expect(FakeXhr.live.length).toBe(3);
    });
    restore();
  });

  it("moves a row's bar with the bytes the transport reported", async () => {
    const { wrapper, restore } = queueHarness({
      "/uploads": { body: TICKET },
      "/finalize": { body: DOC_A },
    });
    const { result } = renderHook(
      () => useUploadQueue({ workspaceId: WORKSPACE_ID }),
      { wrapper }
    );
    act(() => {
      result.current.add([file("a.jpg", 1000)]);
    });
    await waitFor(() => {
      expect(FakeXhr.live).toHaveLength(1);
    });
    act(() => {
      FakeXhr.live[0]?.progress(250, 1000);
    });
    await waitFor(() => {
      expect(result.current.items[0]?.progress).toBeCloseTo(0.25);
    });
    restore();
  });

  it("surfaces a workspace-quota 507 as its OWN state, not as a generic failure", async () => {
    const { wrapper, restore } = queueHarness({
      "/uploads": {
        status: 507,
        body: { localizable_error: "error.507.docs_workspace_quota" },
      },
    });
    const { result } = renderHook(
      () => useUploadQueue({ workspaceId: WORKSPACE_ID }),
      { wrapper }
    );
    act(() => {
      result.current.add([file("a.jpg", 10)]);
    });
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe("failed");
    });
    expect(result.current.items[0]?.quotaExceeded).toBe(true);
    expect(result.current.quotaExceeded).toBe(true);
    // Folded through the real error layer, so the code is the backend's own.
    expect(result.current.items[0]?.error?.code).toBe(
      "error.507.docs_workspace_quota"
    );
    restore();
  });

  it("a refused PUT fails that row only, and retry runs it again from a fresh ticket", async () => {
    const { stub, wrapper, restore } = queueHarness({
      "/uploads": { body: TICKET },
      "/finalize": { body: DOC_A },
    });
    const { result } = renderHook(
      () => useUploadQueue({ workspaceId: WORKSPACE_ID }),
      { wrapper }
    );
    act(() => {
      result.current.add([file("a.jpg", 10)]);
    });
    await waitFor(() => {
      expect(FakeXhr.live).toHaveLength(1);
    });
    act(() => {
      FakeXhr.live[0]?.finish(500);
    });
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe("failed");
    });
    expect(result.current.items[0]?.quotaExceeded).toBe(false);

    const ticketsBefore = stub.calls.filter((call) =>
      call.pathname.endsWith("/uploads")
    ).length;
    const id = result.current.items[0]?.id ?? "";
    act(() => {
      result.current.retry(id);
    });
    await waitFor(() => {
      expect(
        stub.calls.filter((call) => call.pathname.endsWith("/uploads")).length
      ).toBe(ticketsBefore + 1);
    });
    restore();
  });

  it("cancel aborts the transfer and records it as canceled, not failed", async () => {
    const { wrapper, restore } = queueHarness({
      "/uploads": { body: TICKET },
      "/finalize": { body: DOC_A },
    });
    const { result } = renderHook(
      () => useUploadQueue({ workspaceId: WORKSPACE_ID }),
      { wrapper }
    );
    act(() => {
      result.current.add([file("a.jpg", 10)]);
    });
    await waitFor(() => {
      expect(FakeXhr.live).toHaveLength(1);
    });
    const id = result.current.items[0]?.id ?? "";
    act(() => {
      result.current.cancel(id);
    });
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe("canceled");
    });
    expect(result.current.items[0]?.error).toBeNull();
    restore();
  });

  it("clearFinished keeps what is still moving and drops what is not", async () => {
    const { wrapper, restore } = queueHarness({
      "/uploads": { body: TICKET },
      "/finalize": { body: DOC_A },
    });
    const { result } = renderHook(
      () => useUploadQueue({ workspaceId: WORKSPACE_ID, concurrency: 1 }),
      { wrapper }
    );
    act(() => {
      result.current.add([file("a.jpg", 10), file("b.jpg", 10)]);
    });
    await waitFor(() => {
      expect(FakeXhr.live).toHaveLength(1);
    });
    act(() => {
      FakeXhr.live[0]?.finish(200);
    });
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe("done");
    });
    act(() => {
      result.current.clearFinished();
    });
    expect(result.current.items.some((item) => item.status === "done")).toBe(false);
    restore();
  });
});
