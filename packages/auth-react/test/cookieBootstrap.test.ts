import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createAuthRuntime } from "../src/model/runtime.js";
import { testUser } from "./helpers.js";
import { BASE } from "./helpers.js";

/**
 * Owner-diagnosed live incident (2026-07-17): a `session_share` QR scan sets
 * fresh httponly JWT cookies via a plain HTTP redirect — entirely outside
 * this JS runtime's `adopt()`/`restore()`. The freshly loaded SPA has
 * nothing persisted locally to restore, and a query hook with no manual
 * `enabled` gate (the exact shape `useWorkspaces()` was) fires immediately.
 * Before this fix: the session's `doRefresh` bearer-logic early-out (no
 * local refresh token → give up) fired even though the deployment was
 * cookie-based, tearing the session down as "expired" before a real refresh
 * attempt ever happened. After this fix: cookie mode is the default, the
 * bootstrap probe actually tries the cookie-backed refresh, and NOTHING is
 * torn down (there was nothing to tear down) — it either finds a live
 * session or settles quietly into "unauthenticated".
 *
 * Verified against the real stack too (docker-composed `meettoday`,
 * stapel-auth 0.6.0 real backend, `localhost:8080`) — see the write-up for
 * the curl cookie-jar recipe; these tests pin the exact regression at the
 * unit level so it can't silently come back.
 */
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("cookie-mode bootstrap (owner incident, 2026-07-17)", () => {
  it("a query fired BEFORE restore()/bootstrap completes does NOT tear down — it bootstraps via cookies and retries", async () => {
    // Simulates valid httponly cookies already present (set by the QR scan's
    // redirect) that this JS runtime has never seen: the resource 401s once
    // (no bearer header attached — cookie mode never sends one), the
    // cookie-backed refresh succeeds, and the retried request goes through.
    // Cookie mode never attaches a bearer header (the cookie jar IS the
    // auth) — a real "did the cookie-backed session kick in" retry signal
    // has to be call-order based, not header-based.
    //
    // Three `/me/` calls, not two (LAYER B, session.ts's `setTokens`): the
    // ORIGINAL 401, then `setTokens`'s own user-resolution call (the session
    // has no user yet — nothing was ever adopted here — so it must resolve
    // one via `me()` BEFORE settling "authenticated", the fix for the
    // `authenticated && user==null` bug), THEN the client's own retry of the
    // original request.
    let meCalls = 0;
    server.use(
      http.get(`${BASE}/me/`, () => {
        meCalls += 1;
        if (meCalls > 1) return HttpResponse.json(testUser());
        return HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 });
      }),
      // Cookie mode calls GET (see model/session.ts's doc) with no body.
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ access: "acc_from_cookie", refresh: "ref_from_cookie" })
      )
    );

    const onSessionLost = vi.fn();
    const onTeardown = vi.fn();
    // No `cookieMode` passed — this pins the DEFAULT being cookie mode.
    const runtime = createAuthRuntime({ baseUrl: BASE, onSessionLost, onTeardown });

    expect(runtime.session.getSessionManager().isReady()).toBe(false);

    // The query hook fires immediately — no manual `enabled` gate, exactly
    // the shape of the reported bug (`useWorkspaces()` vs. the gated
    // `useWorkspace(id)`).
    const result = await runtime.client.get("/me/");

    expect(result).toEqual(testUser());
    expect(meCalls).toBe(3);
    expect(onSessionLost).not.toHaveBeenCalled();
    expect(onTeardown).not.toHaveBeenCalled();
    expect(runtime.session.getState().status).toBe("authenticated");
    expect(runtime.session.getState().user).toEqual(testUser());
  });

  it("restore() with nothing persisted locally bootstraps via the cookie-backed refresh, resolves the user (LAYER B), and reaches 'authenticated'", async () => {
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ access: "acc_from_cookie", refresh: "ref_from_cookie" })
      ),
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser()))
    );
    const onSessionLost = vi.fn();
    const runtime = createAuthRuntime({ baseUrl: BASE, onSessionLost }); // cookieMode defaults true

    expect(runtime.session.getSessionManager().isReady()).toBe(false);
    await runtime.session.restore();

    expect(runtime.session.getSessionManager().isReady()).toBe(true);
    expect(runtime.session.getState().status).toBe("authenticated");
    expect(runtime.session.getState().user).toEqual(testUser());
    expect(onSessionLost).not.toHaveBeenCalled(); // a successful bootstrap is not a "loss"
  });

  it("restore() with nothing persisted AND no valid cookies settles quietly to 'unauthenticated' — no onSessionLost, no onTeardown", async () => {
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "error.401.refresh_revoked" }, { status: 401 })
      )
    );
    const onSessionLost = vi.fn();
    const onTeardown = vi.fn();
    const runtime = createAuthRuntime({ baseUrl: BASE, onSessionLost, onTeardown });

    await runtime.session.restore();

    expect(runtime.session.getSessionManager().isReady()).toBe(true);
    expect(runtime.session.getSessionManager().getStatus()).toBe("unauthenticated");
    // A brand-new anonymous visitor never HAD a session — this must not
    // read as a "loss" (which would fire the host's redirect-to-login
    // policy for someone who was never logged in).
    expect(onSessionLost).not.toHaveBeenCalled();
    expect(onTeardown).not.toHaveBeenCalled();
  });

  /**
   * Owner-diagnosed live incident, deepened 2026-07-17: a bright "your
   * session expired" banner rendered even on a COLD visit (no session ever
   * existed) or right after an explicit LOGOUT — "that's only fair to show
   * if there WAS one". `sessionLost(reason)`/`onTeardown` (what a host wires
   * its banner to) must fire ONLY when the session had genuinely left
   * `"initializing"` (confirmed authenticated/anonymous) before the failure
   * — one piece of logic (`settleRefreshFailure` in `model/session.ts`)
   * covers every path that can call `doRefresh`, not just the bootstrap
   * probe on `restore()`.
   */
  it("a live 401 retry that fails while STILL initializing (never established) settles quietly — no banner", async () => {
    server.use(
      http.get(`${BASE}/me/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      ),
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "error.401.refresh_revoked" }, { status: 401 })
      )
    );
    const onSessionLost = vi.fn();
    const onTeardown = vi.fn();
    const runtime = createAuthRuntime({ baseUrl: BASE, onSessionLost, onTeardown });

    // A query fires immediately (no restore() awaited first) — the exact
    // race the incident was about. The session was NEVER established.
    await expect(runtime.client.get("/me/")).rejects.toBeTruthy();

    expect(onSessionLost).not.toHaveBeenCalled();
    expect(onTeardown).not.toHaveBeenCalled();
    expect(runtime.session.getSessionManager().getStatus()).toBe("unauthenticated");
  });

  it("a real expiry — session WAS established, THEN the refresh fails — still fires the banner policy", async () => {
    server.use(
      http.get(`${BASE}/me/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      ),
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "error.401.refresh_revoked" }, { status: 401 })
      )
    );
    const onSessionLost = vi.fn();
    const onTeardown = vi.fn();
    const runtime = createAuthRuntime({ baseUrl: BASE, onSessionLost, onTeardown });

    // A genuinely-established session first (cookie mode: adopt() alone is
    // enough to mark the core SessionManager authenticated).
    runtime.session.adopt({
      status: "LOGGED_IN",
      user: testUser(),
      tokens: { access: "acc_1", refresh: "ref_1" },
    });
    expect(runtime.session.getSessionManager().getStatus()).toBe("authenticated");

    await expect(runtime.client.get("/me/")).rejects.toBeTruthy();

    // NOW it's a genuine loss — the banner policy is expected to fire.
    expect(onSessionLost).toHaveBeenCalledWith("revoked");
    expect(onTeardown).toHaveBeenCalledWith("revoked");
    expect(runtime.session.getSessionManager().getStatus()).toBe("unauthenticated");
  });

  it("credentials: 'include' rides both the main client AND the refresh-only client in (default) cookie mode", async () => {
    const inits: RequestInit[] = [];
    const fetchSpy: typeof globalThis.fetch = async (input, init) => {
      inits.push(init ?? {});
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/token/refresh/")) {
        return new Response(JSON.stringify({ access: "a", refresh: "r" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ localizable_error: "auth.token.expired" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    };
    const runtime = createAuthRuntime({ baseUrl: BASE, fetch: fetchSpy });
    await runtime.session.restore();
    expect(inits.length).toBeGreaterThan(0);
    for (const init of inits) {
      expect(init.credentials).toBe("include");
    }
  });
});
