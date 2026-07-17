import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { SessionLostReason } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import { BASE, authResponse, testUser } from "./helpers.js";

// Integration coverage for the session substrate (frontend-core-architecture-v2
// §43): auth-react no longer implements its own single-flight/recursion
// bookkeeping — it delegates to `@stapel/core`'s `SessionManager` and only
// owns tokens + the refresh HTTP call. These tests exercise that delegation
// from the auth-react side (the mechanism itself is covered exhaustively in
// @stapel/core's own test/session.test.ts).

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("SessionManager delegation (§43.1)", () => {
  it("coalesces two concurrently-401ing requests into ONE refresh call and both succeed", async () => {
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/me/`, ({ request }) =>
        request.headers.get("authorization") === "Bearer acc_2"
          ? HttpResponse.json({ id: "u_1" })
          : HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      ),
      http.get(`${BASE}/security/status/`, ({ request }) =>
        request.headers.get("authorization") === "Bearer acc_2"
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      ),
      http.post(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_2", refresh: "ref_2" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    runtime.session.adopt(authResponse("LOGGED_IN"));

    const [me, status] = await Promise.all([
      runtime.client.get("/me/"),
      runtime.client.get("/security/status/"),
    ]);

    expect(me).toEqual({ id: "u_1" });
    expect(status).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });

  it("the token-refresh call itself uses a client without the onAuthRefresh seam (no recursion)", async () => {
    // The refresh endpoint 401ing must NOT recursively trigger another
    // refresh attempt — it should just fail this attempt once.
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/me/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      ),
      http.post(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ localizable_error: "error.401.refresh_revoked" }, { status: 401 });
      })
    );
    const reasons: string[] = [];
    const runtime = createAuthRuntime({ baseUrl: BASE, onTeardown: (r) => reasons.push(r), cookieMode: false });
    runtime.session.adopt(authResponse("LOGGED_IN"));

    await expect(runtime.client.get("/me/")).rejects.toBeTruthy();
    expect(refreshCalls).toBe(1);
    expect(reasons).toEqual(["revoked"]);
  });
});

describe("SessionManager delegation — logout-hook registry (§43.3)", () => {
  it("runs a hook registered directly on the underlying SessionManager on logout()", async () => {
    server.use(http.post(`${BASE}/logout/`, () => HttpResponse.json({ message: "ok" })));
    const runtime = createAuthRuntime({ baseUrl: BASE });
    runtime.session.adopt(authResponse("LOGGED_IN"));

    const hook = vi.fn();
    runtime.session.getSessionManager().registerLogoutHook(hook);

    await runtime.session.logout();
    expect(hook).toHaveBeenCalledWith("logout");
    // auth-react's own cleanup ran too (registered the same way).
    expect(runtime.session.getState().status).toBe("anonymous");
  });

  it("clears the persisted session through the SAME registry — no bespoke inline call site", async () => {
    server.use(
      http.get(`${BASE}/me/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      ),
      http.post(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "error.401.refresh_revoked" }, { status: 401 })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    runtime.session.adopt(authResponse("LOGGED_IN"));
    expect(runtime.session.getSessionManager().getStatus()).toBe("authenticated");

    await expect(runtime.client.get("/me/")).rejects.toBeTruthy();
    expect(runtime.session.getSessionManager().getStatus()).toBe("unauthenticated");
    expect(runtime.session.getState().status).toBe("anonymous");
  });
});

describe("SessionManager delegation — three-state status via is_anonymous", () => {
  it("marks the core SessionManager 'anonymous' for a guest (is_anonymous) user", () => {
    const runtime = createAuthRuntime({ baseUrl: BASE });
    runtime.session.adopt({
      status: "LOGGED_IN",
      user: testUser({ is_anonymous: true }),
      tokens: { access: "acc_1", refresh: "ref_1" },
    });
    expect(runtime.session.getSessionManager().getStatus()).toBe("anonymous");
    // auth-react's OWN (two-value) status field stays "authenticated" for
    // backward compatibility — it does not distinguish guest sessions yet.
    expect(runtime.session.getState().status).toBe("authenticated");
  });

  it("marks the core SessionManager 'authenticated' for a real user", () => {
    const runtime = createAuthRuntime({ baseUrl: BASE });
    runtime.session.adopt(authResponse("LOGGED_IN"));
    expect(runtime.session.getSessionManager().getStatus()).toBe("authenticated");
  });
});

describe("SessionManager delegation — host onSessionLost policy (§43.1)", () => {
  it("invokes the host policy on an involuntary loss, with the specific reason", async () => {
    server.use(
      http.get(`${BASE}/me/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      ),
      http.post(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "error.401.refresh_revoked" }, { status: 401 })
      )
    );
    const onSessionLost = vi.fn<(reason: SessionLostReason) => void>();
    const runtime = createAuthRuntime({ baseUrl: BASE, onSessionLost, cookieMode: false });
    runtime.session.adopt(authResponse("LOGGED_IN"));

    await expect(runtime.client.get("/me/")).rejects.toBeTruthy();
    expect(onSessionLost).toHaveBeenCalledWith("revoked");
  });

  it("does NOT invoke the host policy on an explicit logout()", async () => {
    server.use(http.post(`${BASE}/logout/`, () => HttpResponse.json({ message: "ok" })));
    const onSessionLost = vi.fn();
    const runtime = createAuthRuntime({ baseUrl: BASE, onSessionLost });
    runtime.session.adopt(authResponse("LOGGED_IN"));

    await runtime.session.logout();
    expect(onSessionLost).not.toHaveBeenCalled();
  });
});

describe("SessionManager delegation — logout vs. a racing 401 (owner-diagnosed live incident, 2026-07-17, миттудей race)", () => {
  // Reproduces the exact finisher diagnosis: `logout()` used to await the
  // server revoke BEFORE any local teardown. In the window between the
  // server honoring that revoke and this session getting back around to
  // tearing itself down, a parallel authenticated request (e.g. a Navbar
  // still holding a stale `useWorkspaces` query) 401s, retries its own
  // refresh against the now-revoked token, fails, and used to race a
  // `sessionLost('expired'/'revoked')` teardown in ahead of the explicit
  // logout — rendering a "session expired" banner on a logout the user
  // asked for themselves. Cookie mode (the default the incident occurred
  // in — `GET /token/refresh/` rides the cookie jar, no local token
  // required) so the racing refresh always hits the network regardless of
  // how far the logout's own (concurrent) local-state cleanup has
  // progressed. This test stalls BOTH the logout's own teardown (via a
  // registered hook) and the racing request's refresh response so the race
  // is deterministic instead of timing-dependent.
  it("never fires onTeardown/onSessionLost for the racing 401 — teardown('logout') fires exactly once", async () => {
    let releaseHook: () => void = () => {};
    const hookGate = new Promise<void>((resolve) => {
      releaseHook = resolve;
    });
    let releaseRefresh: () => void = () => {};
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let refreshReceived: () => void = () => {};
    const refreshReceivedPromise = new Promise<void>((resolve) => {
      refreshReceived = resolve;
    });

    server.use(
      http.post(`${BASE}/logout/`, () => HttpResponse.json({ message: "ok" })),
      http.get(`${BASE}/me/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      ),
      http.get(`${BASE}/token/refresh/`, async () => {
        refreshReceived();
        await refreshGate;
        // The server has ALREADY revoked the token by the time this
        // resolves — "the server rejected it first", exactly as diagnosed.
        return HttpResponse.json(
          { localizable_error: "error.401.refresh_revoked" },
          { status: 401 }
        );
      })
    );

    const reasons: string[] = [];
    const onSessionLost = vi.fn();
    const hook = vi.fn(() => hookGate); // stalls the logout's own teardown
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      onTeardown: (r) => reasons.push(r),
      onSessionLost,
    });
    runtime.session.adopt(authResponse("LOGGED_IN"));
    runtime.session.getSessionManager().registerLogoutHook(hook);

    // Explicit logout — its local teardown is stalled mid-flight on `hook`.
    const logoutPromise = runtime.session.logout();

    // A parallel authenticated request races in while teardown is still
    // pending, gets a 401, and retries via a refresh the server has
    // already revoked.
    const racedRequest = runtime.client.get("/me/");
    await refreshReceivedPromise;

    // Let both stalls resolve together and let everything settle.
    releaseRefresh();
    releaseHook();
    await Promise.allSettled([logoutPromise, racedRequest]);

    await expect(racedRequest).rejects.toBeTruthy();
    expect(reasons).toEqual(["logout"]); // never "expired"/"revoked", no duplicate
    expect(onSessionLost).not.toHaveBeenCalled();
    expect(hook.mock.calls).toEqual([["logout"]]); // teardown ran exactly once
    expect(runtime.session.getSessionManager().getStatus()).toBe("unauthenticated");
  });
});
