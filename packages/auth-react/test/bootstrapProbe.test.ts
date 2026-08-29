import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createAuthRuntime } from "../src/model/runtime.js";
import { createAuthSession } from "../src/model/session.js";
import { BASE, makeApi, testUser } from "./helpers.js";

/**
 * `AuthSessionOptions.bootstrapProbe` (consumer-reported gap, meettoday
 * migrators, 2026-07-19): a `session_share` QR scan (and magic-link/SSO/OAuth
 * callback) mints fresh httponly JWT cookies via a plain HTTP redirect. A
 * bearer-mode host (`cookieMode: false`) had NO way to discover that session
 * on a cold load — `bootstrapProbe()` hard-skipped the refresh attempt
 * whenever there was no locally stored bearer token, which is exactly the
 * QR-scan situation. `stapel-auth` now sets a non-httponly `stapel_auth_hint`
 * cookie alongside every such mint so a bearer host can tell "a cookie
 * session might exist" apart from "there never was one" — see
 * `stapel_auth/hint_cookie.py` in the backend repo.
 *
 * 2026-08-30 (multibrand spec, frontend decision): the same gate now covers COOKIE mode,
 * which used to probe unconditionally. On a public storefront that was two
 * 401s on every anonymous visit and every crawl, spent looking for a session
 * the hint cookie already said was absent. A live 401 is untouched — only the
 * cold bootstrap SEARCH is gated.
 */
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

describe("bootstrapProbe (bearer mode gating)", () => {
  it('"auto" probes bearer mode when the stapel_auth_hint cookie is present, and resolves the user (LAYER B) before settling authenticated', async () => {
    setHintCookie();
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_1", refresh: "ref_1" });
      }),
      // `RefreshResponse`/`TokenPairResponse` is tokens-only — a bearer-mode
      // bootstrap probe must resolve the user itself before settling
      // "authenticated" (session.ts's `setTokens` LAYER B).
      http.get(`${BASE}/me/`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer acc_1");
        return HttpResponse.json(testUser());
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    await runtime.session.restore();

    expect(refreshCalls).toBe(1);
    expect(runtime.session.getState().status).toBe("authenticated");
    expect(runtime.session.getState().user).toEqual(testUser());
    expect(runtime.session.getState().tokens).toEqual({
      access: "acc_1",
      refresh: "ref_1",
    });
  });

  it('"auto" makes ZERO probe requests in bearer mode with no hint cookie on a cold load', async () => {
    // No `setHintCookie()` — this is the exact "bearer host that never
    // touches cookie-minting flows" case; the whole point of the gate is
    // that it must not pay a network round trip here.
    const fetchSpy = vi.fn(async () => {
      throw new Error("bootstrapProbe must not call fetch in this scenario");
    });
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      fetch: fetchSpy as unknown as typeof globalThis.fetch,
    });
    await runtime.session.restore();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(runtime.session.getState().status).toBe("anonymous");
    expect(runtime.session.getSessionManager().getStatus()).toBe("unauthenticated");
  });

  it('"always" probes bearer mode even with no hint cookie', async () => {
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_2", refresh: "ref_2" });
      }),
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser()))
    );
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      bootstrapProbe: "always",
    });
    await runtime.session.restore();

    expect(refreshCalls).toBe(1);
    expect(runtime.session.getState().status).toBe("authenticated");
    expect(runtime.session.getState().user).toEqual(testUser());
  });

  it('"off" never probes bearer mode, even with a hint cookie present, and warns exactly once', async () => {
    setHintCookie();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchSpy = vi.fn(async () => {
      throw new Error("bootstrapProbe must not call fetch when off");
    });
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      bootstrapProbe: "off",
      fetch: fetchSpy as unknown as typeof globalThis.fetch,
    });

    await runtime.session.restore();
    // A second restore()-equivalent probe (simulated via a second session
    // sharing the same options shape) also warns — but each SESSION instance
    // warns only once, not once per call within its own lifetime.
    const session2 = createAuthSession({
      api: () => makeApi(),
      cookieMode: false,
      bootstrapProbe: "off",
    });
    await session2.restore();
    await session2.restore();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(runtime.session.getState().status).toBe("anonymous");
    expect(warnSpy).toHaveBeenCalledTimes(2); // once for `runtime`'s session, once for `session2`
    expect(warnSpy.mock.calls[0]?.[0]).toContain("bootstrapProbe off/declined in bearer mode");
    warnSpy.mockRestore();
  });

  it('"auto" probes COOKIE mode when the hint cookie is present — one refresh, and the session is found', async () => {
    setHintCookie();
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_3", refresh: "ref_3" });
      }),
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser()))
    );
    // cookieMode defaults true.
    const runtime = createAuthRuntime({ baseUrl: BASE });
    await runtime.session.restore();

    expect(refreshCalls).toBe(1);
    expect(runtime.session.getState().status).toBe("authenticated");
    expect(runtime.session.getState().user).toEqual(testUser());
  });

  /**
   * The storefront half of the same gate (multibrand spec, frontend decision, measured live
   * on southgate.test 2026-08-30): cookie mode used to probe unconditionally, so
   * every anonymous visit — and every crawl — of a public catalogue opened
   * with two 401s on `/token/refresh/` looking for a session that the hint
   * cookie already said did not exist. 80–95% of a classified's traffic is
   * exactly that visit.
   */
  it('"auto" makes ZERO probe requests in COOKIE mode with no hint cookie on a cold load', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("bootstrapProbe must not call fetch in this scenario");
    });
    const runtime = createAuthRuntime({
      baseUrl: BASE, // cookieMode defaults true
      fetch: fetchSpy as unknown as typeof globalThis.fetch,
    });
    await runtime.session.restore();

    expect(fetchSpy).not.toHaveBeenCalled();
    // Settled for real, so every hook gated on whenReady() is released.
    expect(runtime.session.getState().status).toBe("anonymous");
    expect(runtime.session.getSessionManager().getStatus()).toBe("unauthenticated");
    expect(runtime.session.getSessionManager().isReady()).toBe(true);
  });

  it('"always" still probes cookie mode with no hint cookie — for a backend that sets none', async () => {
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_4", refresh: "ref_4" });
      }),
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser()))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, bootstrapProbe: "always" });
    await runtime.session.restore();

    expect(refreshCalls).toBe(1);
    expect(runtime.session.getState().status).toBe("authenticated");
  });

  it("a LIVE 401 in cookie mode still refreshes without any hint cookie — only the cold probe is gated", async () => {
    // The distinction the gate must not blur: a request that MET a 401 has
    // evidence a session existed; a cold probe has none.
    let meCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/me/`, () => {
        meCalls += 1;
        if (meCalls > 1) return HttpResponse.json(testUser());
        return HttpResponse.json({ localizable_error: "auth.token.expired" }, { status: 401 });
      }),
      http.get(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_5", refresh: "ref_5" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE }); // cookie mode, no hint

    await expect(runtime.client.get("/me/")).resolves.toEqual(testUser());
    expect(refreshCalls).toBe(1);
  });

  it("a failed probe (401/no session) settles anonymous quietly — no throw, no onTeardown", async () => {
    setHintCookie();
    server.use(
      http.get(`${BASE}/token/refresh/`, () =>
        HttpResponse.json({ localizable_error: "error.401.refresh_revoked" }, { status: 401 })
      )
    );
    const onTeardown = vi.fn();
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      onTeardown,
    });
    await expect(runtime.session.restore()).resolves.toBeUndefined();

    expect(runtime.session.getState().status).toBe("anonymous");
    expect(onTeardown).not.toHaveBeenCalled();
  });

  it("a network failure during the probe never throws — settles anonymous with a warn", async () => {
    setHintCookie();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failingFetch: typeof globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      fetch: failingFetch,
    });

    await expect(runtime.session.restore()).resolves.toBeUndefined();
    expect(runtime.session.getState().status).toBe("anonymous");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
