import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  authUrls,
  safeNextPath,
  safeScanRedirect,
  validRedirectUrl,
} from "../src/api/urls.js";
import { BASE, makeApi } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("authApi", () => {
  it("sends the CSRF header on mutations and parses capabilities", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json({
          registration: {
            phone: true,
            email: true,
            password: false,
            oauth: [],
            sso: true,
            anonymous: true,
          },
          login: {
            phone: true,
            email: true,
            password: true,
            oauth: [{ id: "google", name: "Google" }],
            sso: true,
            qr: true,
            passkey: true,
            magic_link: true,
          },
        })
      ),
      http.delete(`${BASE}/sessions/abc/`, ({ request }) => {
        expect(request.headers.get("x-requested-with")).toBe("XMLHttpRequest");
        return HttpResponse.json({ status: "revoked" });
      })
    );
    const api = makeApi();
    const caps = await api.capabilities();
    expect(caps.login.oauth[0]?.id).toBe("google");
    await expect(api.revokeSession("abc")).resolves.toEqual({ status: "revoked" });
  });

  it("unwraps the passkey list envelope", async () => {
    server.use(
      http.get(`${BASE}/passkey/`, () =>
        HttpResponse.json({
          passkeys: [
            {
              id: "p1",
              device_name: "Touch ID",
              aaguid: "x",
              transports: ["internal"],
              created_at: "2026-01-01T00:00:00Z",
              last_used_at: null,
            },
          ],
        })
      )
    );
    const list = await makeApi().passkeys();
    expect(list).toHaveLength(1);
    expect(list[0]?.device_name).toBe("Touch ID");
  });
});

describe("browser-redirect URL builders", () => {
  it("builds authorize / sso / qr-scan URLs", () => {
    const u = authUrls("/auth/api/v1");
    expect(u.oauthAuthorize("google", "https://app/after")).toBe(
      "/auth/api/v1/oauth/google/authorize/?redirect_uri=https%3A%2F%2Fapp%2Fafter"
    );
    expect(u.ssoLogin("acme")).toBe("/auth/api/v1/sso/acme/login/");
    expect(u.qrScan("k1")).toBe("/auth/api/v1/qr/k1/scan/");
  });

  /**
   * A full-page navigation has one channel for anything the host needs to say
   * on the way out, and the thing a storefront needs to say at this door is
   * where the sign-up came from — captured on the landing page, navigations
   * earlier. Before this the host either hand-built the URL or smuggled the
   * tags inside `redirect_uri`, where they came back on its own address.
   */
  it("carries the host's extra query parameters through the authorize door", () => {
    const u = authUrls("/auth/api/v1");
    const href = u.oauthAuthorize("google", {
      redirect_uri: "https://app/after",
      params: {
        click_id: "EAIaIQ+bo/gus",
        click_id_type: "gclid",
        captured_at: "2026-09-06T10:00:00Z",
        utm_source: "google",
      },
    });
    const url = new URL(href, "https://app");
    expect(url.pathname).toBe("/auth/api/v1/oauth/google/authorize/");
    // Every value survives the round trip through the encoder, punctuation
    // included — the whole reason this is not a string the host concatenates.
    expect(url.searchParams.get("redirect_uri")).toBe("https://app/after");
    expect(url.searchParams.get("click_id")).toBe("EAIaIQ+bo/gus");
    expect(url.searchParams.get("click_id_type")).toBe("gclid");
    expect(url.searchParams.get("captured_at")).toBe("2026-09-06T10:00:00Z");
    expect(url.searchParams.get("utm_source")).toBe("google");
    // The address stays this module's: `redirect_uri` is written first and a
    // host cannot displace it from `params`.
    expect(href.indexOf("redirect_uri=")).toBeLessThan(href.indexOf("click_id="));
  });

  it("refuses to let params overwrite the redirect it was given", () => {
    const href = authUrls("/auth/api/v1").oauthAuthorize("google", {
      redirect_uri: "https://app/after",
      params: { redirect_uri: "https://evil.example/steal" },
    });
    const url = new URL(href, "https://app");
    expect(url.searchParams.getAll("redirect_uri")).toEqual([
      "https://app/after",
    ]);
    expect(href).not.toContain("evil.example");
  });

  it("still takes a bare string, byte for byte as before", () => {
    expect(
      authUrls("/auth/api/v1").oauthAuthorize("google", {
        redirect_uri: "https://app/after",
      })
    ).toBe(
      authUrls("/auth/api/v1").oauthAuthorize("google", "https://app/after")
    );
  });
});

describe("otpVerify carries the landing page's attribution", () => {
  /**
   * The verify call is the one that REGISTERS on this channel, so it is the
   * only place an advertising capture can be attached to the account it
   * created. Asserted on the WIRE — the body the server would parse — because
   * the value's whole job is to be a key in that JSON.
   */
  it("puts the object on the wire verbatim when the caller has one", async () => {
    let body: unknown = null;
    server.use(
      http.post(`${BASE}/email/verify/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ status: "LOGGED_IN", user: { id: "u1" } });
      })
    );
    await makeApi().otpVerify("email", "a@b.com", "123456", {
      attribution: {
        click_id: "EAIaIQ",
        click_id_type: "gclid",
        captured_at: "2026-09-06T10:00:00Z",
        utm: { source: "google", campaign: "spring" },
      },
    });
    expect(body).toEqual({
      email: "a@b.com",
      code: "123456",
      attribution: {
        click_id: "EAIaIQ",
        click_id_type: "gclid",
        captured_at: "2026-09-06T10:00:00Z",
        utm: { source: "google", campaign: "spring" },
      },
    });
  });

  it("adds NO key at all when the caller has none", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE}/phone/verify/`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "LOGGED_IN", user: { id: "u1" } });
      })
    );
    await makeApi().otpVerify("phone", "+79990000000", "123456");
    expect(body).toEqual({ phone: "+79990000000", code: "123456" });
    expect(body === null ? [] : Object.keys(body)).not.toContain("attribution");
  });
});

describe("authApi — OAuth account links (§0.5.9's /oauth/links/ trio)", () => {
  it("oauthLinks unwraps the `links` envelope", async () => {
    server.use(
      http.get(`${BASE}/oauth/links/`, () =>
        HttpResponse.json({
          links: [
            {
              provider: "google",
              email: "a@b.com",
              display_name: "Ada",
              linked_at: "2026-01-01T00:00:00Z",
              primary: true,
            },
          ],
        })
      )
    );
    const api = makeApi();
    const links = await api.oauthLinks();
    expect(links).toHaveLength(1);
    expect(links[0]?.provider).toBe("google");
    expect(links[0]?.primary).toBe(true);
  });

  it("oauthLink posts { provider, access_token } and unwraps the response", async () => {
    server.use(
      http.post(`${BASE}/oauth/links/`, async ({ request }) => {
        expect(await request.json()).toEqual({ provider: "github", access_token: "tok" });
        return HttpResponse.json({
          links: [
            { provider: "github", email: null, display_name: "gh", linked_at: null, primary: false },
          ],
        });
      })
    );
    const api = makeApi();
    const links = await api.oauthLink("github", "tok");
    expect(links[0]?.provider).toBe("github");
  });

  it("oauthUnlink deletes /oauth/links/{provider}/", async () => {
    let called = false;
    server.use(
      http.delete(`${BASE}/oauth/links/github/`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const api = makeApi();
    await api.oauthUnlink("github");
    expect(called).toBe(true);
  });
});

describe("open-redirect defence (auth-sa.md §19.2)", () => {
  it("validRedirectUrl accepts single-slash relative paths only", () => {
    expect(validRedirectUrl("/app")).toBe("/app");
    expect(validRedirectUrl("//evil.com")).toBeNull();
    expect(validRedirectUrl("https://evil.com")).toBeNull();
  });

  it("safeNextPath reduces same-origin, rejects cross-origin", () => {
    const origin = "https://app.example.com";
    expect(safeNextPath("/meetings/1", origin)).toBe("/meetings/1");
    expect(safeNextPath("https://app.example.com/x?y=1", origin)).toBe("/x?y=1");
    expect(safeNextPath("https://evil.com/x", origin)).toBeNull();
    expect(safeNextPath("//evil.com", origin)).toBeNull();
  });

  it("safeScanRedirect only accepts same-origin /auth/api/v1/qr/ paths", () => {
    const origin = "https://app.example.com";
    expect(
      safeScanRedirect("https://app.example.com/auth/api/v1/qr/k/scan/", origin)
    ).toBe("https://app.example.com/auth/api/v1/qr/k/scan/");
    expect(safeScanRedirect("https://app.example.com/other", origin)).toBeNull();
    expect(safeScanRedirect("https://evil.com/auth/api/v1/qr/k/", origin)).toBeNull();
  });
});
