import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { PersistStorage } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import { createAuthSession } from "../src/model/session.js";
import type { TeardownReason } from "../src/model/session.js";
import { BASE, authResponse, makeApi } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  document.cookie = "stapel_auth_hint=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});
afterAll(() => server.close());

/** The non-httponly signal a mint leaves behind. Since 2026-08-30 the cold
 * `restore()` probe is gated on it in cookie mode too, so a test ABOUT the
 * probe has to put the session in the state the probe exists to discover
 * (see `bootstrapProbe.test.ts`). */
function setHintCookie(): void {
  document.cookie = "stapel_auth_hint=1; path=/";
}

function memoryStorage(): PersistStorage {
  const map = new Map<string, unknown>();
  return {
    get: (k) => Promise.resolve(map.get(k)),
    set: (k, v) => {
      map.set(k, v);
      return Promise.resolve();
    },
    del: (k) => {
      map.delete(k);
      return Promise.resolve();
    },
    keys: () => Promise.resolve([...map.keys()]),
  };
}

describe("token refresh (auth-sa.md §13)", () => {
  it("rotates the refresh token on a 401 and retries the request", async () => {
    server.use(
      http.get(`${BASE}/me/`, ({ request }) =>
        request.headers.get("authorization") === "Bearer acc_2"
          ? HttpResponse.json({ id: "u_1" })
          : HttpResponse.json(
              { localizable_error: "auth.token.expired" },
              { status: 401 }
            )
      ),
      http.post(`${BASE}/token/refresh/`, async ({ request }) => {
        expect(await request.json()).toEqual({ refresh: "ref_1" });
        return HttpResponse.json({ access: "acc_2", refresh: "ref_2" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    runtime.session.adopt(authResponse("LOGGED_IN"));
    await expect(runtime.client.get("/me/")).resolves.toEqual({ id: "u_1" });
    expect(runtime.session.getState().tokens).toEqual({
      access: "acc_2",
      refresh: "ref_2",
    });
  });

  it("tears down with reason 'revoked' on error.401.refresh_revoked (no loop)", async () => {
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/me/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      ),
      http.post(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json(
          { localizable_error: "error.401.refresh_revoked" },
          { status: 401 }
        );
      })
    );
    const reasons: TeardownReason[] = [];
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      onTeardown: (r) => reasons.push(r),
      cookieMode: false,
    });
    runtime.session.adopt(authResponse("LOGGED_IN"));
    await expect(runtime.client.get("/me/")).rejects.toBeTruthy();
    expect(reasons).toEqual(["revoked"]);
    expect(runtime.session.getState().status).toBe("anonymous");
    expect(refreshCalls).toBe(1); // the refresh 401 did NOT re-enter refresh
  });
});

describe("session persistence (frontend-standard §4.6)", () => {
  it("bearer mode: persists tokens on adopt and restores them in a fresh session", async () => {
    const storage = memoryStorage();
    const a = createAuthSession({ api: () => makeApi(), storage, cookieMode: false });
    a.adopt(authResponse("LOGGED_IN"));

    const b = createAuthSession({ api: () => makeApi(), storage, cookieMode: false });
    expect(b.getState().status).toBe("anonymous");
    await b.restore();
    expect(b.getState().status).toBe("authenticated");
    expect(b.getState().tokens?.access).toBe("acc_1");
  });

  it("cookie mode: never persists JWTs into JS-readable storage; restore is an optimistic user cache", async () => {
    const storage = memoryStorage();
    const a = createAuthSession({
      api: () => makeApi(),
      storage,
      cookieMode: true,
    });
    a.adopt(authResponse("LOGGED_IN"));

    // The persisted snapshot holds the user but NO tokens: HTTP-only cookies
    // carry the session, and mirroring JWTs into storage would reopen the
    // XSS-theft hole cookie mode exists to close.
    const stored = (await storage.get("stapel-auth:session")) as {
      user: unknown;
      tokens: unknown;
    };
    expect(stored.user).toBeTruthy();
    expect(stored.tokens).toBeNull();

    // A fresh session (reload) restores the user optimistically — the cookies
    // authenticate the next request; a dead cookie pair tears down via the
    // refresh seam.
    const b = createAuthSession({
      api: () => makeApi(),
      storage,
      cookieMode: true,
    });
    await b.restore();
    expect(b.getState().status).toBe("authenticated");
    expect(b.getState().user).toEqual(authResponse("LOGGED_IN").user);
    expect(b.getAccessToken()).toBeNull();
  });

  it("bearer mode: a stored user WITHOUT tokens does not restore as authenticated", async () => {
    const storage = memoryStorage();
    await storage.set("stapel-auth:session", {
      user: authResponse("LOGGED_IN").user,
      tokens: null,
    });
    const session = createAuthSession({ api: () => makeApi(), storage, cookieMode: false });
    await session.restore();
    expect(session.getState().status).toBe("anonymous");
  });

  it("logout revokes server-side, tears down, and purges persisted state", async () => {
    let loggedOut = false;
    server.use(
      http.post(`${BASE}/logout/`, () => {
        loggedOut = true;
        return HttpResponse.json({ message: "Successfully logged out" });
      })
    );
    const storage = memoryStorage();
    const teardown = vi.fn();
    const session = createAuthSession({
      api: () => makeApi(),
      storage,
      onTeardown: teardown,
    });
    session.adopt(authResponse("LOGGED_IN"));
    await session.logout();
    expect(loggedOut).toBe(true);
    expect(teardown).toHaveBeenCalledWith("logout");
    expect(session.getState().status).toBe("anonymous");
    expect(await storage.get("stapel-auth:session")).toBeUndefined();
  });
});

// Owner-reported live incident, 2026-07-26 (app.ironmemo.com mid-redeploy):
// "the backend clearly wasn't responding, but the frontend still threw me
// onto the sign-in page. Sure, the refresh or auth/me call failed, but
// that's no reason to tear down the session — the user was never logged
// out, the backend just hiccuped."
//
// Only the auth service can retire a credential, and only by answering. A
// 502 out of a restarting proxy, a timeout, a raw fetch failure — none of
// those are verdicts, and the session must outlive them untouched.
describe("an unreachable backend is not an authentication verdict", () => {
  const cases: Array<[string, () => Response | Promise<Response>]> = [
    ["502 from the proxy while the upstream restarts", () =>
      new HttpResponse("<html>502 Bad Gateway</html>", { status: 502 })],
    ["503 service unavailable", () => new HttpResponse(null, { status: 503 })],
    ["504 gateway timeout", () => new HttpResponse(null, { status: 504 })],
    ["500 from the service's own crash", () => new HttpResponse(null, { status: 500 })],
    ["429 rate limit (a 'come back later', not a logout)", () =>
      new HttpResponse(null, { status: 429 })],
    ["a raw transport failure (fetch throws / DNS / TLS)", () => HttpResponse.error()],
  ];

  for (const [label, respond] of cases) {
    it(`keeps the session on ${label}`, async () => {
      server.use(http.get(`${BASE}/token/refresh/`, respond));
      const teardown = vi.fn();
      const sessionLost = vi.fn();
      const session = createAuthSession({
        api: () => makeApi(),
        storage: memoryStorage(),
        cookieMode: true,
        onTeardown: teardown,
        onSessionLost: sessionLost,
      });
      session.adopt(authResponse("LOGGED_IN"));

      // What a live 401 retry does — the client's onAuthRefresh seam.
      await expect(session.onAuthRefresh()).resolves.toBeNull();

      expect(session.getState().status).toBe("authenticated");
      expect(session.getState().user).toEqual(authResponse("LOGGED_IN").user);
      expect(teardown).not.toHaveBeenCalled();
      expect(sessionLost).not.toHaveBeenCalled();
    });
  }

  it("still tears down on a real 401 — the server DID answer", async () => {
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      )
    );
    const teardown = vi.fn();
    const session = createAuthSession({
      api: () => makeApi(),
      storage: memoryStorage(),
      cookieMode: true,
      onTeardown: teardown,
    });
    session.adopt(authResponse("LOGGED_IN"));

    await session.onAuthRefresh();

    expect(session.getState().status).toBe("anonymous");
    expect(teardown).toHaveBeenCalledWith("expired");
  });

  it("still tears down (revoked) on a replayed refresh token", async () => {
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json(
          { localizable_error: "error.401.refresh_revoked" },
          { status: 401 }
        )
      )
    );
    const teardown = vi.fn();
    const session = createAuthSession({
      api: () => makeApi(),
      storage: memoryStorage(),
      cookieMode: true,
      onTeardown: teardown,
    });
    session.adopt(authResponse("LOGGED_IN"));

    await session.onAuthRefresh();

    expect(teardown).toHaveBeenCalledWith("revoked");
  });

  it("a refresh that succeeds but whose me() is unreachable KEEPS the tokens", async () => {
    // The LAYER B path: bare tokens with no known user. Clearing them because
    // me() got a 502 would end a live session over a transient outage.
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ access: "acc_9", refresh: "ref_9" })
      ),
      http.get(`${BASE}/me/`, () => new HttpResponse(null, { status: 502 }))
    );
    const teardown = vi.fn();
    const session = createAuthSession({
      api: () => makeApi(),
      storage: memoryStorage(),
      cookieMode: false,
      bootstrapProbe: "always",
      onTeardown: teardown,
    });

    await session.restore();

    expect(session.getState().tokens?.access).toBe("acc_9");
    expect(teardown).not.toHaveBeenCalled();
  });

  it("a cold start against a dead backend settles (never hangs whenReady) without a teardown", async () => {
    setHintCookie(); // a probe has to actually happen for a dead backend to be met
    server.use(http.get(`${BASE}/token/refresh/`, () => HttpResponse.error()));
    const teardown = vi.fn();
    const sessionLost = vi.fn();
    const session = createAuthSession({
      api: () => makeApi(),
      storage: memoryStorage(),
      cookieMode: true,
      onTeardown: teardown,
      onSessionLost: sessionLost,
    });

    await session.restore();

    // Settled, so every query hook gated on whenReady() is released…
    expect(session.getSessionManager().isReady()).toBe(true);
    // …but nothing was "lost": there was no session to lose, and no banner.
    expect(teardown).not.toHaveBeenCalled();
    expect(sessionLost).not.toHaveBeenCalled();
  });
});

// Owner-reported live incident, 2026-07-26: "opened ironmemo and got a
// redirect stroboscope, /app ↔ /sign-in in a loop" — 222 requests in a loop
// before it settled.
//
// The server was internally inconsistent (GET /me answered 200 off a live
// access cookie while GET /token/refresh/ answered 401 off a dead refresh
// cookie), which is a legitimate state a client has to survive. What turned
// it into a redirect storm was here: the logout hook started an async wipe of
// the persisted user and returned `undefined`, so `runLogoutHooks` — which
// DOES await its hooks — considered teardown finished while the delete was
// still in flight. The host's onSessionLost then hard-navigated, the reloaded
// page restored the very user that was meant to be gone, sign-in bounced it
// back to /app, and round it went until a wipe happened to beat a navigation.
describe("the persisted user is really gone before teardown reports done", () => {
  function slowStorage(delayMs: number): PersistStorage & { deleted: boolean } {
    const map = new Map<string, unknown>();
    const storage = {
      deleted: false,
      get: (k: string) => Promise.resolve(map.get(k)),
      set: (k: string, v: unknown) => {
        map.set(k, v);
        return Promise.resolve();
      },
      del: (k: string) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            map.delete(k);
            storage.deleted = true;
            resolve();
          }, delayMs)
        ),
      keys: () => Promise.resolve([...map.keys()]),
    };
    return storage as PersistStorage & { deleted: boolean };
  }

  it("logout() does not resolve until the wipe has actually committed", async () => {
    const storage = slowStorage(20);
    const session = createAuthSession({ api: () => makeApi(), storage });
    session.adopt(authResponse("LOGGED_IN"));
    server.use(http.post(`${BASE}/logout/`, () => HttpResponse.json({})));

    await session.logout();

    expect(storage.deleted).toBe(true);
    expect(await storage.get("stapel-auth:session")).toBeUndefined();
  });

  it("onSessionLost fires only AFTER the wipe — a hard redirect cannot outrun it", async () => {
    const storage = slowStorage(20);
    let wipedWhenNotified: boolean | null = null;
    const session = createAuthSession({
      api: () => makeApi(),
      storage,
      cookieMode: true,
      // The host policy is where `window.location.href = "/sign-in"` lives.
      onSessionLost: () => {
        wipedWhenNotified = storage.deleted;
      },
    });
    session.adopt(authResponse("LOGGED_IN"));
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      )
    );

    await session.onAuthRefresh();

    expect(wipedWhenNotified).toBe(true);
    expect(await storage.get("stapel-auth:session")).toBeUndefined();
  });

  it("a fresh session on the same storage restores nothing afterwards", async () => {
    // The loop's actual mechanism: the reloaded page rehydrating a user that
    // the previous page had already been told to forget.
    const storage = slowStorage(20);
    const first = createAuthSession({ api: () => makeApi(), storage, cookieMode: true });
    first.adopt(authResponse("LOGGED_IN"));
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      )
    );
    await first.onAuthRefresh();

    const reloaded = createAuthSession({ api: () => makeApi(), storage, cookieMode: true });
    await reloaded.restore();

    expect(reloaded.getState().user).toBeNull();
    expect(reloaded.getState().status).toBe("anonymous");
  });
});

// The redirect strobe's SECOND and deeper cause (owner-reported, 2026-07-26).
//
// The ironmemo app keeps its own auth context, which calls GET /me/ through
// the runtime client. On a server with a live access cookie and a dead
// refresh cookie — a state it is entitled to be in — /me answers 200 and the
// app marks the manager authenticated, while this library's restore(),
// finding none of ITS OWN persisted state, runs the bootstrap probe. The
// probe's 401 then read as a session LOSS (status was no longer
// "initializing", because /me had won the race), tore the session down, and
// fired the host's hard redirect to /sign-in. Reload → /me 200 → sign-in
// bounces to /app → probe 401 again. 222 requests of that.
//
// A probe is a SEARCH for a session, not a check of one. Finding nothing is
// never losing something.
describe("a negative bootstrap probe is not a session loss", () => {
  function memory(): PersistStorage {
    const map = new Map<string, unknown>();
    return {
      get: (k) => Promise.resolve(map.get(k)),
      set: (k, v) => {
        map.set(k, v);
        return Promise.resolve();
      },
      del: (k) => {
        map.delete(k);
        return Promise.resolve();
      },
      keys: () => Promise.resolve([...map.keys()]),
    };
  }

  it("does not tear down a session another caller established mid-probe", async () => {
    setHintCookie(); // there IS a probe to run — that is the premise
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      )
    );
    const onTeardown = vi.fn();
    const onSessionLost = vi.fn();
    const session = createAuthSession({
      api: () => makeApi(),
      storage: memory(),
      cookieMode: true,
      onTeardown,
      onSessionLost,
    });
    // Exactly what the host's own /me success does while restore() is in
    // flight: it marks the manager authenticated out from under the probe.
    session.getSessionManager().markAuthenticated();

    await session.restore();

    expect(onSessionLost).not.toHaveBeenCalled();
    expect(onTeardown).not.toHaveBeenCalled();
    expect(session.getSessionManager().getStatus()).toBe("authenticated");
  });

  it("still settles a cold start quietly when nothing else claimed a session", async () => {
    setHintCookie();
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      )
    );
    const onTeardown = vi.fn();
    const session = createAuthSession({
      api: () => makeApi(),
      storage: memory(),
      cookieMode: true,
      onTeardown,
    });

    await session.restore();

    expect(session.getSessionManager().getStatus()).toBe("unauthenticated");
    expect(session.getSessionManager().isReady()).toBe(true);
    expect(onTeardown).not.toHaveBeenCalled();
  });

  it("a LIVE 401 (not a probe) still tears the session down", async () => {
    // The distinction has to survive: an expired credential on a real
    // request is a loss, and must still redirect.
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 })
      )
    );
    const onTeardown = vi.fn();
    const session = createAuthSession({
      api: () => makeApi(),
      storage: memory(),
      cookieMode: true,
      onTeardown,
    });
    session.adopt(authResponse("LOGGED_IN"));

    await session.onAuthRefresh();

    expect(onTeardown).toHaveBeenCalledWith("expired");
    expect(session.getState().user).toBeNull();
  });
});
