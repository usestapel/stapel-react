/**
 * `<OAuthLinks/>` (owner directive point 5): backed by stapel-auth's real
 * `/oauth/links/` trio (found in the 0.5.9 sibling schema — read + unlink are
 * fully real here). Link is THIN by necessity (same boundary as WebAuthn):
 * it needs a host-supplied `getAccessToken` to run the provider's OAuth SDK
 * in the browser, which this suite covers both without (disabled) and with
 * (mocked) that binding.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createAuthRuntime } from "../../src/model/runtime.js";
import type { AuthRuntime } from "../../src/model/runtime.js";
import { AuthProvider } from "../../src/headless/AuthProvider.js";
import { registerAuthI18n } from "../../src/i18n/keys.js";
import { OAuthLinks } from "../../src/default/security/OAuthLinks.js";
import { BASE } from "../helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function wrap(runtime: AuthRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = createI18n({ locale: "en" });
  registerAuthI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <AuthProvider runtime={runtime}>{children}</AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

const CAPS = {
  registration: {
    phone: false,
    email: true,
    password: false,
    oauth: [
      { id: "google", name: "Google" },
      { id: "github", name: "GitHub" },
    ],
    sso: false,
    anonymous: false,
  },
  login: {
    phone: false,
    email: true,
    password: false,
    oauth: [{ id: "google", name: "Google" }, { id: "github", name: "GitHub" }],
    sso: false,
    qr: false,
    passkey: false,
    magic_link: false,
  },
};

function linksResponse(links: Array<{ provider: string; primary?: boolean }>) {
  return {
    links: links.map((l) => ({
      provider: l.provider,
      email: null,
      display_name: l.provider,
      linked_at: "2026-01-01T00:00:00Z",
      primary: l.primary ?? false,
    })),
  };
}

describe("<OAuthLinks/>", () => {
  it("shows Connected for a linked provider and a Connect button for an unlinked one", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPS)),
      http.get(`${BASE}/oauth/links/`, () => HttpResponse.json(linksResponse([{ provider: "google" }])))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <OAuthLinks />));
    await waitFor(() => expect(screen.getByText("Google")).toBeDefined());
    expect(screen.getByText("Connected")).toBeDefined();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDefined(); // github
  });

  it("without getAccessToken, Connect is disabled", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPS)),
      http.get(`${BASE}/oauth/links/`, () => HttpResponse.json(linksResponse([])))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <OAuthLinks />));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(2));
    for (const btn of screen.getAllByRole("button", { name: "Connect" })) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("with getAccessToken supplied, connecting calls POST /oauth/links/ and refetches", async () => {
    let providers: string[] = [];
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPS)),
      http.get(`${BASE}/oauth/links/`, () =>
        HttpResponse.json(linksResponse(providers.map((provider) => ({ provider }))))
      ),
      http.post(`${BASE}/oauth/links/`, async ({ request }) => {
        const body = (await request.json()) as { provider: string; access_token: string };
        expect(body).toEqual({ provider: "google", access_token: "tok123" });
        providers = ["google"];
        return HttpResponse.json(linksResponse(providers.map((provider) => ({ provider }))));
      })
    );
    const getAccessToken = vi.fn().mockResolvedValue("tok123");
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <OAuthLinks getAccessToken={getAccessToken} />));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(2));

    screen.getAllByRole("button", { name: "Connect" })[0]?.click();

    await waitFor(() => expect(getAccessToken).toHaveBeenCalledWith("google"));
    await waitFor(() => expect(screen.getByText("Connected")).toBeDefined());
  });

  it("unlinking calls DELETE /oauth/links/:provider/ and refetches", async () => {
    let providers = ["google"];
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPS)),
      http.get(`${BASE}/oauth/links/`, () =>
        HttpResponse.json(linksResponse(providers.map((provider) => ({ provider }))))
      ),
      http.delete(`${BASE}/oauth/links/:provider/`, ({ params }) => {
        providers = providers.filter((p) => p !== params["provider"]);
        return new HttpResponse(null, { status: 204 });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <OAuthLinks />));
    await waitFor(() => expect(screen.getByText("Connected")).toBeDefined());

    screen.getByRole("button", { name: "Disconnect" }).click();
    const confirmButtons = await screen.findAllByRole("button", { name: "Disconnect" });
    confirmButtons[confirmButtons.length - 1]?.click();

    await waitFor(() => expect(screen.queryByText("Connected")).toBeNull());
  });
});
