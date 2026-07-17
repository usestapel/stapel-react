import { describe, expect, it, vi } from "vitest";
import { createSessionManager } from "../src/session.js";
import type { SessionLogoutReason, SessionStatus } from "../src/session.js";

// NOTE on recursion: `doRefresh`'s own HTTP call must go through a client
// WITHOUT the `onAuthRefresh` seam (see the module doc comment in
// `src/session.ts`) — `@stapel/auth-react`'s runtime wires a dedicated
// refresh-only client for exactly this reason (see auth-react's
// `runtime.ts`/`session.ts`). `refresh()` here only coalesces genuinely
// concurrent callers; it is not a recursion guard, and a `doRefresh` that
// re-enters `refresh()` through the same in-flight window deadlocks by
// design (nothing else can produce a correct three-way single-flight for
// concurrent siblings, since a recursive call and a genuine sibling call are
// indistinguishable by timing alone).
describe("createSessionManager — single-flight refresh (§43.1)", () => {
  it("coalesces N concurrent refresh() calls into ONE doRefresh() call", async () => {
    let calls = 0;
    let resolveRefresh: (status: SessionStatus) => void = () => {};
    const doRefresh = vi.fn(
      () =>
        new Promise<SessionStatus | null>((resolve) => {
          calls += 1;
          resolveRefresh = resolve;
        })
    );
    const manager = createSessionManager({ initialStatus: "authenticated", doRefresh });

    const p1 = manager.refresh();
    const p2 = manager.refresh();
    const p3 = manager.refresh();
    expect(calls).toBe(1);

    resolveRefresh("authenticated");
    await expect(Promise.all([p1, p2, p3])).resolves.toEqual([true, true, true]);
    expect(doRefresh).toHaveBeenCalledTimes(1);
  });

  it("a subsequent refresh() call (new window) calls doRefresh again", async () => {
    const doRefresh = vi
      .fn<() => Promise<SessionStatus | null>>()
      .mockResolvedValueOnce("authenticated")
      .mockResolvedValueOnce("authenticated");
    const manager = createSessionManager({ doRefresh });
    await manager.refresh();
    await manager.refresh();
    expect(doRefresh).toHaveBeenCalledTimes(2);
  });
});

describe("createSessionManager — events (§43.1)", () => {
  it("emits session:refreshed on a successful refresh", async () => {
    const manager = createSessionManager({
      doRefresh: async () => "authenticated",
    });
    const handler = vi.fn();
    manager.on("session:refreshed", handler);
    await manager.refresh();
    expect(handler).toHaveBeenCalledWith({ status: "authenticated" });
  });

  it("emits session:lost with the reported reason when doRefresh fails", async () => {
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
    });
    const handler = vi.fn();
    manager.on("session:lost", handler);
    await manager.refresh();
    expect(handler).toHaveBeenCalledWith({ reason: "unknown" });
  });

  it("sessionLost(reason) reports the specific reason and is idempotent", async () => {
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
    });
    const handler = vi.fn();
    manager.on("session:lost", handler);
    await manager.sessionLost("revoked");
    await manager.sessionLost("expired"); // no-op — already unauthenticated
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ reason: "revoked" });
  });

  it("emits session:logout (not session:lost) on explicit logout()", async () => {
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
    });
    const lost = vi.fn();
    const loggedOut = vi.fn();
    manager.on("session:lost", lost);
    manager.on("session:logout", loggedOut);
    await manager.logout();
    expect(lost).not.toHaveBeenCalled();
    expect(loggedOut).toHaveBeenCalledWith({ reason: "logout" });
  });

  it("calls the host onSessionLost policy on an involuntary loss, not on logout()", async () => {
    const onSessionLost = vi.fn();
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
      onSessionLost,
    });
    await manager.logout();
    expect(onSessionLost).not.toHaveBeenCalled();

    const manager2 = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
      onSessionLost,
    });
    await manager2.sessionLost("expired");
    expect(onSessionLost).toHaveBeenCalledWith("expired");
  });
});

describe("createSessionManager — logout-hook registry (§43.3)", () => {
  it("runs every registered hook on logout() with reason 'logout'", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const hookA = vi.fn();
    const hookB = vi.fn();
    manager.registerLogoutHook(hookA);
    manager.registerLogoutHook(hookB);
    await manager.logout();
    expect(hookA).toHaveBeenCalledWith("logout");
    expect(hookB).toHaveBeenCalledWith("logout");
  });

  it("runs every registered hook on sessionLost() with reason 'lost'", async () => {
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
    });
    const hook = vi.fn();
    manager.registerLogoutHook(hook);
    await manager.sessionLost();
    expect(hook).toHaveBeenCalledWith("lost");
  });

  it("unregister stops a hook from firing", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const hook = vi.fn();
    const unregister = manager.registerLogoutHook(hook);
    unregister();
    await manager.logout();
    expect(hook).not.toHaveBeenCalled();
  });

  it("one hook throwing does not stop the others from running", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const good = vi.fn();
    manager.registerLogoutHook(() => {
      throw new Error("boom");
    });
    manager.registerLogoutHook(good);
    await manager.logout();
    expect(good).toHaveBeenCalledWith("logout" satisfies SessionLogoutReason);
  });
});

describe("createSessionManager — session key (§43.5)", () => {
  it("generates the session key lazily and only once per session", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const k1 = await manager.getSessionKey();
    const k2 = await manager.getSessionKey();
    expect(k1).toBe(k2);
  });

  it("drops the key on logout — a fresh key is generated afterward", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const generateKey = vi.spyOn(crypto.subtle, "generateKey");
    await manager.getSessionKey();
    expect(generateKey).toHaveBeenCalledTimes(1);
    await manager.logout();
    await manager.getSessionKey();
    expect(generateKey).toHaveBeenCalledTimes(2);
    generateKey.mockRestore();
  });

  it("drops the key on sessionLost() too", async () => {
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
    });
    const generateKey = vi.spyOn(crypto.subtle, "generateKey");
    await manager.getSessionKey();
    await manager.sessionLost();
    await manager.getSessionKey();
    expect(generateKey).toHaveBeenCalledTimes(2);
    generateKey.mockRestore();
  });
});

describe("createSessionManager — status", () => {
  it("subscribe() fires on transitions, not on repeats", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.markAuthenticated();
    manager.markAuthenticated(); // no-op, same status
    manager.markAnonymous();
    expect(listener.mock.calls).toEqual([["authenticated"], ["anonymous"]]);
  });
});

/**
 * `"initializing"` + the ready-gate (owner-diagnosed live incident,
 * 2026-07-17): a QR `session_share` scan sets fresh httponly cookies via a
 * plain HTTP redirect, entirely outside any JS `adopt()`/`restore()` call —
 * the freshly loaded SPA has nothing to restore and has not yet been told
 * it's authenticated. Collapsing that "haven't checked yet" moment into the
 * OLD default (`"unauthenticated"`, a CONFIRMED negative) is what let a
 * query hook with no manual `enabled` gate read a valid cookie session as
 * "session expired" before the bootstrap probe ever got a chance to run.
 */
describe("createSessionManager — initializing / ready-gate", () => {
  it("is born 'initializing' by default, not 'unauthenticated'", () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    expect(manager.getStatus()).toBe("initializing");
    expect(manager.isReady()).toBe(false);
  });

  it("an explicit initialStatus skips the ready-gate entirely", async () => {
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
    });
    expect(manager.isReady()).toBe(true);
    await expect(manager.whenReady()).resolves.toBeUndefined(); // already settled
  });

  it("whenReady() resolves once markAuthenticated() leaves 'initializing'", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    let resolved = false;
    void manager.whenReady().then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    manager.markAuthenticated();
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(true);
    expect(manager.isReady()).toBe(true);
  });

  it("whenReady() resolves once markAnonymous() leaves 'initializing'", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    manager.markAnonymous();
    await expect(manager.whenReady()).resolves.toBeUndefined();
    expect(manager.isReady()).toBe(true);
  });

  it("whenReady() resolves once a failed bootstrap refresh settles into 'unauthenticated'", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const ready = manager.whenReady();
    await manager.refresh(); // the bootstrap probe: no valid cookies, refresh fails
    await ready;
    expect(manager.getStatus()).toBe("unauthenticated");
    expect(manager.isReady()).toBe(true);
  });

  it("whenReady() called AFTER the transition already happened still resolves (no late-subscriber hang)", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    manager.markAuthenticated();
    // whenReady() is called well after the transition — must not hang.
    await expect(manager.whenReady()).resolves.toBeUndefined();
  });
});
