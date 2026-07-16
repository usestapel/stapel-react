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
