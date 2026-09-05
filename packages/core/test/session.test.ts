import { describe, expect, it, vi } from "vitest";
import {
  createSessionManager,
  REFRESH_HANDOFF_WINDOW_MS,
  REFRESH_INFLIGHT_MARKER_KEY,
  REFRESH_UNAVAILABLE,
} from "../src/session.js";
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

describe("createSessionManager — logout-in-progress guard (owner-diagnosed live incident, 2026-07-17, meettoday race)", () => {
  it("sessionLost() is a no-op (returns false, no event, no teardown) while logout() is mid-teardown, even before status has flipped", async () => {
    let releaseHook: () => void = () => {};
    const hookGate = new Promise<void>((resolve) => {
      releaseHook = resolve;
    });
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
    });
    manager.registerLogoutHook(() => hookGate); // stalls teardown mid-flight

    const logoutPromise = manager.logout();
    // Still mid-teardown: the hook hasn't resolved, so status has NOT
    // flipped to "unauthenticated" yet — this is exactly the window a
    // racing 401's failed refresh lands in.
    expect(manager.getStatus()).toBe("authenticated");

    const lost = vi.fn();
    manager.on("session:lost", lost);
    const tornDown = await manager.sessionLost("expired");

    expect(tornDown).toBe(false);
    expect(lost).not.toHaveBeenCalled();
    expect(manager.getStatus()).toBe("authenticated"); // untouched by the race

    releaseHook();
    await logoutPromise;
    expect(manager.getStatus()).toBe("unauthenticated");
    expect(lost).not.toHaveBeenCalled(); // never fired, not even after settling
  });

  it("sessionLost() reports true and behaves normally once no logout() is in flight", async () => {
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
    });
    expect(await manager.sessionLost("expired")).toBe(true);
    expect(await manager.sessionLost("expired")).toBe(false); // idempotent, unrelated to the guard
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

// An outage is not an authentication verdict (owner-reported live incident,
// 2026-07-26): the ironmemo stand was mid-redeploy, the browser's refresh
// call got a 502 out of nginx, and the app threw a signed-in user onto the
// sign-in page. A failed refresh is not a reason to tear down the session —
// the user was never logged out, the backend just hiccuped.
describe("createSessionManager — REFRESH_UNAVAILABLE (no verdict ≠ session lost)", () => {
  it("keeps the session, fires no teardown and no host policy, on 'unavailable'", async () => {
    const onSessionLost = vi.fn();
    const hook = vi.fn();
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => REFRESH_UNAVAILABLE,
      onSessionLost,
    });
    manager.registerLogoutHook(hook);
    const lost = vi.fn();
    manager.on("session:lost", lost);

    await expect(manager.refresh()).resolves.toBe(false);

    expect(manager.getStatus()).toBe("authenticated");
    expect(onSessionLost).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
    expect(lost).not.toHaveBeenCalled();
  });

  it("emits session:refresh-unavailable carrying the untouched status", async () => {
    const seen: SessionStatus[] = [];
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => REFRESH_UNAVAILABLE,
    });
    manager.on("session:refresh-unavailable", ({ status }) => seen.push(status));

    await manager.refresh();

    expect(seen).toEqual(["authenticated"]);
  });

  it("a LATER refresh over a recovered backend still authenticates normally", async () => {
    let up = false;
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => (up ? "authenticated" : REFRESH_UNAVAILABLE),
    });

    await manager.refresh();
    expect(manager.getStatus()).toBe("authenticated");
    up = true;
    await expect(manager.refresh()).resolves.toBe(true);
    expect(manager.getStatus()).toBe("authenticated");
  });

  it("null (the server ANSWERED that the credential is dead) still tears down", async () => {
    const onSessionLost = vi.fn();
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
      onSessionLost,
    });

    await expect(manager.refresh()).resolves.toBe(false);

    expect(manager.getStatus()).toBe("unauthenticated");
    expect(onSessionLost).toHaveBeenCalledWith("unknown");
  });

  it("a doRefresh that THROWS is unavailable, not lost — a bug in the refresh path must not log the user out", async () => {
    const onSessionLost = vi.fn();
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => {
        throw new Error("boom");
      },
      onSessionLost,
    });

    await expect(manager.refresh()).resolves.toBe(false);

    expect(manager.getStatus()).toBe("authenticated");
    expect(onSessionLost).not.toHaveBeenCalled();
  });
});

/**
 * ONE PAGE LOAD, TWO ROTATIONS — incident D413.
 *
 * `refresh()`'s coalescing is a promise in memory, so a full document reload
 * throws it away and the fresh `SessionManager` fires its own bootstrap
 * refresh on top of the previous page's un-answered rotation. The server sees
 * the superseded `jti`, reads it as a replayed refresh token, and revokes the
 * session: a person signed out by nothing but a page load.
 *
 * The guard is a marker in `sessionStorage` — the one store that survives a
 * reload of this tab and nothing else. These tests drive two managers over
 * ONE fake storage, which is exactly the shape of the two documents.
 */
function fakeSessionStorage(seed?: Record<string, string>): Storage {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  } as Storage;
}

describe("createSessionManager — the refresh survives a reload (D413)", () => {
  it("writes the in-flight marker while a refresh is out, and clears it on success", async () => {
    const store = fakeSessionStorage();
    let release: (status: SessionStatus) => void = () => {};
    const manager = createSessionManager({
      refreshHandoffStorage: store,
      doRefresh: () =>
        new Promise<SessionStatus>((resolve) => {
          release = resolve;
        }),
    });

    const pending = manager.refresh();
    const raw = store.getItem(REFRESH_INFLIGHT_MARKER_KEY);
    expect(raw).not.toBeNull();
    expect(typeof (JSON.parse(raw as string) as { startedAt: unknown }).startedAt).toBe(
      "number"
    );

    release("authenticated");
    await pending;
    expect(store.getItem(REFRESH_INFLIGHT_MARKER_KEY)).toBeNull();
  });

  it("clears the marker on a FAILED refresh too — a marker outliving its refresh taxes every later boot", async () => {
    const store = fakeSessionStorage();
    const manager = createSessionManager({
      initialStatus: "authenticated",
      refreshHandoffStorage: store,
      doRefresh: async () => {
        throw new Error("proxy down");
      },
    });
    await expect(manager.refresh()).resolves.toBe(false);
    expect(store.getItem(REFRESH_INFLIGHT_MARKER_KEY)).toBeNull();
  });

  it("the SECOND manager waits for the first to settle and never dispatches its own refresh", async () => {
    const store = fakeSessionStorage();
    let release: (status: SessionStatus) => void = () => {};
    const first = vi.fn(
      () =>
        new Promise<SessionStatus>((resolve) => {
          release = resolve;
        })
    );
    const firstManager = createSessionManager({
      refreshHandoffStorage: store,
      doRefresh: first,
    });
    const rotating = firstManager.refresh();

    // The reload: a brand-new manager over the SAME tab storage, with the
    // previous document's rotation still out.
    let signedIn = false;
    const second = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const secondManager = createSessionManager({
      refreshHandoffStorage: store,
      readSessionHint: () => (signedIn ? "authenticated" : null),
      doRefresh: second,
    });
    const booting = secondManager.refresh();

    // It is WAITING, not refreshing: presenting the credential the first
    // rotation is replacing is exactly what got the session revoked.
    await Promise.resolve();
    expect(second).not.toHaveBeenCalled();
    expect(secondManager.getStatus()).toBe("initializing");

    signedIn = true;
    release("authenticated");
    await rotating;

    await expect(booting).resolves.toBe(true);
    expect(second).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(1);
    expect(secondManager.getStatus()).toBe("authenticated");
  });

  it("waits, then refreshes anyway when the wait produced no session", async () => {
    const store = fakeSessionStorage();
    let release: (status: SessionStatus) => void = () => {};
    const firstManager = createSessionManager({
      refreshHandoffStorage: store,
      doRefresh: () =>
        new Promise<SessionStatus>((resolve) => {
          release = resolve;
        }),
    });
    const rotating = firstManager.refresh();

    const second = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const secondManager = createSessionManager({
      refreshHandoffStorage: store,
      readSessionHint: () => null,
      doRefresh: second,
    });
    const booting = secondManager.refresh();
    await Promise.resolve();
    expect(second).not.toHaveBeenCalled();

    release("authenticated");
    await rotating;
    await expect(booting).resolves.toBe(true);
    // Waiting is not skipping: with no evidence of a session, the boot probe
    // still runs — just no longer on top of somebody else's rotation.
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("only the FIRST refresh after a boot pays the wait", async () => {
    const store = fakeSessionStorage({
      [REFRESH_INFLIGHT_MARKER_KEY]: JSON.stringify({ startedAt: Date.now() }),
    });
    const doRefresh = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const manager = createSessionManager({
      refreshHandoffWindowMs: 20,
      refreshHandoffStorage: store,
      doRefresh,
    });
    await manager.refresh();
    expect(doRefresh).toHaveBeenCalledTimes(1);
    const before = Date.now();
    await manager.refresh();
    expect(doRefresh).toHaveBeenCalledTimes(2);
    expect(Date.now() - before).toBeLessThan(20);
  });

  it("a SETTLED session's 401 refresh never waits — the guard is for the boot probe, not for every request", async () => {
    // The seam this was found on: a pair that holds one refresh open and then
    // builds a second manager (a phone losing its socket, an SSR host, a
    // multi-tenant host with two sessions) had every later refresh held for
    // the whole window. A manager that already knows its status is not a
    // reloaded page racing its predecessor.
    const store = fakeSessionStorage({
      [REFRESH_INFLIGHT_MARKER_KEY]: JSON.stringify({ startedAt: Date.now() }),
    });
    const doRefresh = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const readSessionHint = vi.fn((): SessionStatus => "authenticated");
    const manager = createSessionManager({
      initialStatus: "authenticated",
      refreshHandoffWindowMs: 30_000,
      refreshHandoffStorage: store,
      readSessionHint,
      doRefresh,
    });
    await expect(manager.refresh()).resolves.toBe(true);
    expect(doRefresh).toHaveBeenCalledTimes(1);
    expect(readSessionHint).not.toHaveBeenCalled();
  });

  it("a STALE marker is treated as absent — a tab killed mid-rotation must not tax the next boot", async () => {
    const store = fakeSessionStorage({
      [REFRESH_INFLIGHT_MARKER_KEY]: JSON.stringify({
        startedAt: Date.now() - (REFRESH_HANDOFF_WINDOW_MS + 5_000),
      }),
    });
    const doRefresh = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const readSessionHint = vi.fn((): SessionStatus => "authenticated");
    const manager = createSessionManager({
      refreshHandoffStorage: store,
      readSessionHint,
      doRefresh,
    });

    await expect(manager.refresh()).resolves.toBe(true);
    // No wait, no hint read, and the refresh went out — today's behaviour.
    expect(doRefresh).toHaveBeenCalledTimes(1);
    expect(readSessionHint).not.toHaveBeenCalled();
  });

  it("an unreadable marker is treated as absent too", async () => {
    const store = fakeSessionStorage({ [REFRESH_INFLIGHT_MARKER_KEY]: "not json" });
    const doRefresh = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const manager = createSessionManager({ refreshHandoffStorage: store, doRefresh });
    await expect(manager.refresh()).resolves.toBe(true);
    expect(doRefresh).toHaveBeenCalledTimes(1);
    expect(store.getItem(REFRESH_INFLIGHT_MARKER_KEY)).toBeNull();
  });

  it("storage unavailable: exactly today's behaviour, and nothing thrown", async () => {
    const doRefresh = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const readSessionHint = vi.fn((): SessionStatus => "authenticated");
    const manager = createSessionManager({
      refreshHandoffStorage: null,
      readSessionHint,
      doRefresh,
    });
    await expect(manager.refresh()).resolves.toBe(true);
    await expect(manager.refresh()).resolves.toBe(true);
    expect(doRefresh).toHaveBeenCalledTimes(2);
    expect(readSessionHint).not.toHaveBeenCalled();
  });

  it("a storage that THROWS on every access is unavailable, not a crash", async () => {
    const hostile = {
      get length(): number {
        throw new Error("SecurityError");
      },
      clear: () => {
        throw new Error("SecurityError");
      },
      getItem: () => {
        throw new Error("SecurityError");
      },
      key: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    const doRefresh = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const manager = createSessionManager({ refreshHandoffStorage: hostile, doRefresh });
    await expect(manager.refresh()).resolves.toBe(true);
    expect(doRefresh).toHaveBeenCalledTimes(1);
  });

  it("no marker, no change: the window is never waited out when nothing was in flight", async () => {
    const store = fakeSessionStorage();
    const doRefresh = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const manager = createSessionManager({
      refreshHandoffWindowMs: 5_000,
      refreshHandoffStorage: store,
      doRefresh,
    });
    const before = Date.now();
    await expect(manager.refresh()).resolves.toBe(true);
    expect(Date.now() - before).toBeLessThan(1_000);
    expect(doRefresh).toHaveBeenCalledTimes(1);
  });

  it("wakes on the `storage` event the OTHER document announces its rotation with", async () => {
    const store = fakeSessionStorage({
      [REFRESH_INFLIGHT_MARKER_KEY]: JSON.stringify({ startedAt: Date.now() }),
    });
    const doRefresh = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const manager = createSessionManager({
      // Long enough that finishing at all proves the event woke it, not the
      // timer.
      refreshHandoffWindowMs: 30_000,
      refreshHandoffStorage: store,
      doRefresh,
    });
    const booting = manager.refresh();
    await Promise.resolve();
    expect(doRefresh).not.toHaveBeenCalled();

    // The removal is the announcement; a WRITE is another document STARTING a
    // rotation, which is not news this manager can act on.
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: REFRESH_INFLIGHT_MARKER_KEY,
        newValue: JSON.stringify({ startedAt: Date.now() }),
      })
    );
    await Promise.resolve();
    expect(doRefresh).not.toHaveBeenCalled();

    window.dispatchEvent(
      new StorageEvent("storage", { key: REFRESH_INFLIGHT_MARKER_KEY, newValue: null })
    );
    await expect(booting).resolves.toBe(true);
    expect(doRefresh).toHaveBeenCalledTimes(1);
  });

  it("gives up on a writer that never answers, bounded by the window", async () => {
    const store = fakeSessionStorage({
      [REFRESH_INFLIGHT_MARKER_KEY]: JSON.stringify({ startedAt: Date.now() }),
    });
    const doRefresh = vi.fn(async (): Promise<SessionStatus> => "authenticated");
    const manager = createSessionManager({
      refreshHandoffWindowMs: 30,
      refreshHandoffStorage: store,
      doRefresh,
    });
    await expect(manager.refresh()).resolves.toBe(true);
    expect(doRefresh).toHaveBeenCalledTimes(1);
  });
});
