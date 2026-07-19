import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createAuthRuntime } from "../src/model/runtime.js";
import { createAuthSession } from "../src/model/session.js";
import { BASE, makeApi } from "./helpers.js";

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
  it('"auto" probes bearer mode when the stapel_auth_hint cookie is present', async () => {
    setHintCookie();
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_1", refresh: "ref_1" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    await runtime.session.restore();

    expect(refreshCalls).toBe(1);
    expect(runtime.session.getState().status).toBe("authenticated");
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
      })
    );
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      bootstrapProbe: "always",
    });
    await runtime.session.restore();

    expect(refreshCalls).toBe(1);
    expect(runtime.session.getState().status).toBe("authenticated");
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

  it('"auto" cookie mode is unaffected — still probes unconditionally regardless of the hint cookie', async () => {
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_3", refresh: "ref_3" });
      })
    );
    // cookieMode defaults true; no hint cookie set.
    const runtime = createAuthRuntime({ baseUrl: BASE });
    await runtime.session.restore();

    expect(refreshCalls).toBe(1);
    expect(runtime.session.getState().status).toBe("authenticated");
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
