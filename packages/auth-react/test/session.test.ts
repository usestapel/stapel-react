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
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
