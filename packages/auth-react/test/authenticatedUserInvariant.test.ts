/**
 * The `authenticated && user == null` bug (owner incident, 2026-07-20 —
 * meettoday migrators): `AuthSession` used to be able to settle into
 * `{ status: "authenticated", user: null }` — `setTokens()` spread the prior
 * (possibly still-null) `state.user` and hand-set `status: "authenticated"`
 * regardless. A `ProtectedRoute` that correctly checks BOTH `status` and
 * `user` (`!isAuthenticated || !user`) saw a contradiction and bounced a
 * signed-in user back to the login screen — every navigation, since the
 * bearer-mode `bootstrapProbe` fix (3747681) made this path (QR-minted
 * httponly cookie, cold load, no local bearer token) newly reachable.
 *
 * Two layers, both covered here:
 *  - LAYER A (session.ts's `computeStatus`): `status` is DERIVED from
 *    `user`/`tokens`, never hand-set — `authenticated && user==null` cannot
 *    be constructed through this module at all.
 *  - LAYER B (session.ts's `setTokens`): a bare token pair with no known
 *    user resolves one via `me()` (the seam-free refresh client) before
 *    settling `"authenticated"`; a resolution failure clears the tokens and
 *    settles unauthenticated rather than leave a dangling, unconfirmed
 *    session.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor } from "@testing-library/react";
import { useActiveSessionReady } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import { createAuthSession } from "../src/model/session.js";
import type { AuthSessionState } from "../src/model/session.js";
import { BASE, makeApi, testUser } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  document.cookie = "stapel_auth_hint=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});
afterAll(() => server.close());

function setHintCookie(): void {
  document.cookie = "stapel_auth_hint=1; path=/";
}

/** Fails the assertion the instant the invariant is violated, not just at the end. */
function assertNeverAuthenticatedWithoutUser(state: AuthSessionState): void {
  if (state.status === "authenticated" && state.user === null) {
    throw new Error("INVARIANT VIOLATED: status is 'authenticated' but user is null");
  }
}

describe("the authenticated-without-user invariant", () => {
  it("bootstrap probe (bearer mode, QR/hint-cookie cold load) never yields authenticated+user==null at any transition, and settles authenticated WITH a user — reproduces the original bug and proves it's fixed", async () => {
    setHintCookie();
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ access: "acc_1", refresh: "ref_1" })
      ),
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser()))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    const seenStates: AuthSessionState[] = [];
    runtime.session.subscribe(() => {
      const s = runtime.session.getState();
      assertNeverAuthenticatedWithoutUser(s);
      seenStates.push(s);
    });

    await runtime.session.restore();

    // Sanity: the probe actually ran through more than one state transition
    // (tokens-held-anonymous, then authenticated-with-user) — not a
    // vacuously-true assertion because nothing happened.
    expect(seenStates.length).toBeGreaterThanOrEqual(2);
    const final = runtime.session.getState();
    expect(final.status).toBe("authenticated");
    expect(final.user).toEqual(testUser());
    expect(final.tokens).toEqual({ access: "acc_1", refresh: "ref_1" });
  });

  it("refresh succeeds but user resolution fails (me() 401) → settles UNauthenticated, tokens cleared, never throws", async () => {
    setHintCookie();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ access: "acc_orphan", refresh: "ref_orphan" })
      ),
      http.get(`${BASE}/me/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      )
    );
    const onTeardown = vi.fn();
    const onSessionLost = vi.fn();
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      onTeardown,
      onSessionLost,
    });
    const seenStates: AuthSessionState[] = [];
    runtime.session.subscribe(() => {
      const s = runtime.session.getState();
      assertNeverAuthenticatedWithoutUser(s);
      seenStates.push(s);
    });

    await expect(runtime.session.restore()).resolves.toBeUndefined(); // never throws

    const final = runtime.session.getState();
    expect(final.status).toBe("anonymous");
    expect(final.user).toBeNull();
    expect(final.tokens).toBeNull(); // no dangling orphaned tokens
    expect(runtime.session.getSessionManager().getStatus()).toBe("unauthenticated");
    // Never confirmed established before this failure — quiet settle, no banner.
    expect(onTeardown).not.toHaveBeenCalled();
    expect(onSessionLost).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("user resolution failed"),
      expect.anything()
    );
    warnSpy.mockRestore();
  });

  it("setTokens() called directly (QR login_request fulfilment) with a failing me() also clears tokens and settles unauthenticated — never throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(
      http.get(`${BASE}/me/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });

    await expect(
      runtime.session.setTokens({ access: "acc_qr", refresh: "ref_qr" })
    ).resolves.toBeUndefined();

    const final = runtime.session.getState();
    expect(final.status).toBe("anonymous");
    expect(final.user).toBeNull();
    expect(final.tokens).toBeNull();
    warnSpy.mockRestore();
  });

  it("composes with the bearer-mode bootstrapProbe fix (3747681): QR/hint-cookie cold load → probe → refresh → user resolved → authenticated with a non-null user — this is exactly what unblocks meettoday's `|| !user` ProtectedRoute guard", async () => {
    setHintCookie(); // simulates the stapel_auth_hint cookie a QR session_share mint left behind
    let refreshCalls = 0;
    let meCalls = 0;
    server.use(
      http.get(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_qr_cold", refresh: "ref_qr_cold" });
      }),
      http.get(`${BASE}/me/`, () => {
        meCalls += 1;
        return HttpResponse.json(testUser());
      })
    );
    // No storage, nothing persisted — a genuinely cold load. bearer mode
    // (`cookieMode: false`) with no local token — the exact shape
    // 3747681 made `bootstrapProbe` actually attempt.
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });

    expect(runtime.session.getSessionManager().isReady()).toBe(false);
    await runtime.session.restore();

    expect(refreshCalls).toBe(1);
    expect(meCalls).toBe(1);
    expect(runtime.session.getSessionManager().isReady()).toBe(true);
    expect(runtime.session.getSessionManager().getStatus()).toBe("authenticated");
    const final = runtime.session.getState();
    expect(final.status).toBe("authenticated");
    expect(final.user).not.toBeNull();
    expect(final.user).toEqual(testUser());
  });

  it("isReady()/useActiveSessionReady() reflect the invariant: NOT ready while the user is still unresolved, ready only once settled (authenticated-with-user, or confirmed unauthenticated)", async () => {
    setHintCookie();
    let resolveRefresh: (() => void) | null = null;
    const refreshGate = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    server.use(
      http.get(`${BASE}/token/refresh/`, async () => {
        await refreshGate; // held open until the test releases it
        return HttpResponse.json({ access: "acc_gate", refresh: "ref_gate" });
      }),
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser()))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    const { result } = renderHook(() => useActiveSessionReady());

    expect(result.current).toBe(false);
    const restorePromise = runtime.session.restore();
    // Still mid-flight (refresh call held open) — must still read not-ready,
    // and the local state must not have raced ahead into
    // authenticated+user==null in the meantime.
    expect(result.current).toBe(false);
    expect(
      runtime.session.getState().status === "authenticated" &&
        runtime.session.getState().user === null
    ).toBe(false);

    resolveRefresh?.();
    await restorePromise;

    await waitFor(() => expect(result.current).toBe(true));
    expect(runtime.session.getState().status).toBe("authenticated");
    expect(runtime.session.getState().user).not.toBeNull();
  });

  it("bearer mode: a corrupted pre-fix persisted state (tokens present, user null) never restores as authenticated", async () => {
    const map = new Map<string, unknown>();
    const storage = {
      get: (k: string) => Promise.resolve(map.get(k)),
      set: (k: string, v: unknown) => {
        map.set(k, v);
        return Promise.resolve();
      },
      del: (k: string) => {
        map.delete(k);
        return Promise.resolve();
      },
      keys: () => Promise.resolve([...map.keys()]),
    };
    await storage.set("stapel-auth:session", {
      user: null,
      tokens: { access: "stale", refresh: "stale_r" },
    });
    const session = createAuthSession({
      api: () => makeApi(),
      storage,
      cookieMode: false,
      bootstrapProbe: "off",
    });
    await session.restore();
    const state = session.getState();
    assertNeverAuthenticatedWithoutUser(state);
    expect(state.status).toBe("anonymous");
  });
});
