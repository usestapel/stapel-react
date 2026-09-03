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
      expect(btn.getAttribute("aria-disabled")).toBe("true");
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

    // The ROW's control names the provider it acts on ("Disconnect Google"):
    // a row of identically-named buttons is a list a screen-reader user
    // cannot navigate. The CONFIRM's button is the plain verb, because inside
    // the dialog the subject is already stated in the title and body.
    screen.getByRole("button", { name: "Disconnect Google" }).click();
    const confirmButton = await screen.findByTestId("stapel-confirm-ok");
    confirmButton.click();

    await waitFor(() => expect(screen.queryByText("Connected")).toBeNull());
  });
});

describe("<OAuthLinks/> — the reads, and the reason a control is off", () => {
  it("a failed capabilities read is stated — never 'No providers configured.'", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json({ code: "error.500.internal", message: "boom" }, { status: 500 })
      ),
      http.get(`${BASE}/oauth/links/`, () => HttpResponse.json(linksResponse([])))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <OAuthLinks />));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.queryByText("No providers configured.")).toBeNull();
  });

  it("a failed LINKS read does not render providers as 'not connected'", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPS)),
      http.get(`${BASE}/oauth/links/`, () =>
        HttpResponse.json({ code: "error.500.internal", message: "boom" }, { status: 500 })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <OAuthLinks />));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
    expect(screen.queryByText("No providers configured.")).toBeNull();
  });

  it("a deployment with zero providers still gets the empty copy", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json({
          ...CAPS,
          registration: { ...CAPS.registration, oauth: [] },
        })
      ),
      http.get(`${BASE}/oauth/links/`, () => HttpResponse.json(linksResponse([])))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <OAuthLinks />));

    await waitFor(() => expect(screen.getByText("No providers configured.")).toBeDefined());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  /**
   * A disabled button receives no pointer events, so the old tooltip on it
   * was a reason no keyboard or touch user could reach. `useActionGate`
   * prints the same i18n copy as text beside the control.
   */
  it("without getAccessToken the reason is VISIBLE text, not only a tooltip", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPS)),
      http.get(`${BASE}/oauth/links/`, () => HttpResponse.json(linksResponse([])))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <OAuthLinks />));

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(2));
    expect(
      screen.getAllByText("Connecting a new account isn't available right now.")
    ).toHaveLength(2);
  });

  it("with getAccessToken supplied there is no blocked reason on screen", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPS)),
      http.get(`${BASE}/oauth/links/`, () => HttpResponse.json(linksResponse([])))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <OAuthLinks getAccessToken={vi.fn()} />));

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(2));
    expect(screen.queryByText("Connecting a new account isn't available right now.")).toBeNull();
  });
});
