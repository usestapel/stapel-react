import { afterEach, describe, expect, it, vi } from "vitest";
import { createQrLoginFlow } from "../src/flows/qrLoginFlow.js";
import type { AuthApi } from "../src/api/authApi.js";
import type { QrStatusResponse } from "../src/api/types.js";

/**
 * Lifecycle tests for the QR poll loop. `poll()` re-checks the machine state
 * after its awaited `qrStatus`, and that re-check must compare the KEY, not
 * just the step: a dispose()+start() race (modal re-open, StrictMode remount)
 * leaves the machine in `awaitingScan` for a NEW key while the OLD key's poll
 * response is still in flight. Without the key comparison the stale response
 * hijacks the shared timer (polling silently stops for the live QR) or marks
 * the fresh QR `rejected`.
 */

afterEach(() => {
  vi.useRealTimers();
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeQrApi(): {
  api: AuthApi;
  statusCalls: string[];
  pending: Map<string, Deferred<QrStatusResponse>[]>;
} {
  let n = 0;
  const statusCalls: string[] = [];
  const pending = new Map<string, Deferred<QrStatusResponse>[]>();
  const api = {
    qrGenerate: vi.fn(() => {
      n += 1;
      return Promise.resolve({
        key: `qr_${String(n)}`,
        scan_url: `https://x/qr/qr_${String(n)}/scan/`,
        expires_in: 300,
      });
    }),
    qrStatus: vi.fn((key: string) => {
      statusCalls.push(key);
      const d = deferred<QrStatusResponse>();
      const list = pending.get(key) ?? [];
      list.push(d);
      pending.set(key, list);
      return d.promise;
    }),
  } as unknown as AuthApi;
  return { api, statusCalls, pending };
}

const tick = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("qr login: stale poll guard (key identity, not just step)", () => {
  it("a stale 'pending' response for a disposed key does not hijack the new QR's poll loop", async () => {
    vi.useFakeTimers();
    const { api, statusCalls, pending } = makeQrApi();
    const flow = createQrLoginFlow({ api, pollIntervalMs: 1000 });

    await flow.start("login_request", "/app");
    expect(flow.machine.getState()).toMatchObject({ step: "awaitingScan", key: "qr_1" });

    // First poll for qr_1 goes in flight …
    await vi.advanceTimersByTimeAsync(1000);
    expect(statusCalls).toEqual(["qr_1"]);

    // … the user closes and reopens the modal while it is airborne.
    flow.dispose();
    await flow.start("login_request", "/app");
    expect(flow.machine.getState()).toMatchObject({ step: "awaitingScan", key: "qr_2" });

    // The stale qr_1 response lands: it must NOT reschedule polling for qr_1.
    pending.get("qr_1")?.[0]?.resolve({ status: "pending" });
    await tick();

    // The live QR keeps polling.
    await vi.advanceTimersByTimeAsync(1000);
    expect(statusCalls.filter((k) => k === "qr_2")).toHaveLength(1);

    // And it can still fulfil.
    pending.get("qr_2")?.[0]?.resolve({
      status: "fulfilled",
      access_token: "acc",
      refresh_token: "ref",
    } as QrStatusResponse);
    await tick();
    expect(flow.machine.getState()).toMatchObject({
      step: "fulfilled",
      tokens: { access: "acc", refresh: "ref" },
    });
  });

  it("a stale 'rejected' response does not mark the new QR rejected", async () => {
    vi.useFakeTimers();
    const { api, pending } = makeQrApi();
    const flow = createQrLoginFlow({ api, pollIntervalMs: 1000 });

    await flow.start("login_request", "/app");
    await vi.advanceTimersByTimeAsync(1000); // poll(qr_1) in flight

    flow.dispose();
    await flow.start("login_request", "/app");
    const live = flow.machine.getState();
    expect(live).toMatchObject({ step: "awaitingScan", key: "qr_2" });

    pending.get("qr_1")?.[0]?.resolve({ status: "rejected" });
    await tick();
    expect(flow.machine.getState()).toBe(live); // untouched, still qr_2
  });
});
