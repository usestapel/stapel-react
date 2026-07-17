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

/**
 * Live-verified 2026-07-17 (owner deepening of the settings-page QR audit):
 * driving `createQrLoginFlow` directly against a real running stapel-auth
 * 0.6.0 backend (docker-composed `meettoday` stack) through its full 300s
 * TTL showed polling AND the expired→regenerate transition both complete
 * correctly at the flow layer — `qrGenerate`'s response IS what unblocks the
 * `"generating"` step, every time. That live run only exercised THIS flow
 * layer, though (headless, no React), so it could not have caught a bug at
 * the React/UI layer — these tests pin the flow-layer contract the reported
 * "no polling" / "stuck loading forever" symptoms would need to violate if
 * the bug were here, so a future regression here fails loudly instead of
 * only ever showing up as a live "why is this QR panel stuck" report again.
 */
describe("qr login: expired → silent auto-regenerate (auth-sa.md §8)", () => {
  it("polls on the configured cadence while pending (poll cadence contract)", async () => {
    vi.useFakeTimers();
    const { api, statusCalls, pending } = makeQrApi();
    const flow = createQrLoginFlow({ api, pollIntervalMs: 1000 });

    await flow.start("login_request", "/app");
    expect(statusCalls).toHaveLength(0); // no poll before the first interval elapses

    // Each poll's promise resolves "pending" before the next interval tick —
    // schedulePoll only re-arms once the prior poll settles, so this proves
    // the cadence keeps going call after call, not just once.
    for (let i = 1; i <= 4; i += 1) {
      await vi.advanceTimersByTimeAsync(1000);
      expect(statusCalls).toHaveLength(i);
      pending.get("qr_1")?.[i - 1]?.resolve({ status: "pending" });
      await tick();
    }
  });

  it("on 'expired', regenerates a fresh key and IMMEDIATELY resumes polling it — never stalls on 'generating'", async () => {
    vi.useFakeTimers();
    const { api, statusCalls, pending } = makeQrApi();
    const flow = createQrLoginFlow({ api, pollIntervalMs: 1000 });

    await flow.start("login_request", "/app");
    expect(flow.machine.getState()).toMatchObject({ step: "awaitingScan", key: "qr_1" });

    await vi.advanceTimersByTimeAsync(1000);
    expect(statusCalls).toEqual(["qr_1"]);

    // Backend reports the key expired — the flow must regenerate right away,
    // land back in `awaitingScan` with the NEW key (never stuck in
    // `generating`), and resume polling it on the same cadence.
    pending.get("qr_1")?.[0]?.resolve({ status: "expired" });
    await tick();

    expect(flow.machine.getState()).toMatchObject({ step: "awaitingScan", key: "qr_2" });

    await vi.advanceTimersByTimeAsync(1000);
    expect(statusCalls).toEqual(["qr_1", "qr_2"]);

    pending.get("qr_2")?.[0]?.resolve({ status: "pending" });
    await tick();
    expect(flow.machine.getState()).toMatchObject({ step: "awaitingScan", key: "qr_2" });

    await vi.advanceTimersByTimeAsync(1000);
    expect(statusCalls).toEqual(["qr_1", "qr_2", "qr_2"]);
  });

  it("pollNow() re-checks status immediately without waiting for the next scheduled tick", async () => {
    vi.useFakeTimers();
    const { api, statusCalls, pending } = makeQrApi();
    const flow = createQrLoginFlow({ api, pollIntervalMs: 60_000 }); // a long cadence a foregrounded tab shouldn't have to wait out

    await flow.start("login_request", "/app");
    expect(statusCalls).toEqual([]); // nothing yet — first tick is 60s away

    flow.pollNow();
    await tick();
    expect(statusCalls).toEqual(["qr_1"]); // checked immediately, not after 60s

    pending.get("qr_1")?.[0]?.resolve({ status: "pending" });
    await tick();
    // still resumes the normal cadence afterwards
    expect(flow.machine.getState()).toMatchObject({ step: "awaitingScan", key: "qr_1" });
  });

  it("pollNow() is a no-op outside awaitingScan (nothing to re-check yet/anymore)", async () => {
    vi.useFakeTimers();
    const { api, statusCalls } = makeQrApi();
    const flow = createQrLoginFlow({ api, pollIntervalMs: 1000 });

    flow.pollNow(); // idle — before start()
    await tick();
    expect(statusCalls).toEqual([]);
  });
});
