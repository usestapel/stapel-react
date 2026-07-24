/**
 * `<SecuritySettings/>` — proof that the composed page renders the page
 * title/subtitle plus every grouped section (contact / password / two-factor
 * / devices / connected accounts / audit log), each holding its widget's own
 * Card, from the pair's real hooks (no new backend surface).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import type { AuthRuntime } from "../src/model/runtime.js";
import { AuthProvider } from "../src/headless/AuthProvider.js";
import { registerAuthI18n } from "../src/i18n/keys.js";
import { SecuritySettings } from "../src/default/SecuritySettings.js";
import { BASE, testUser } from "./helpers.js";

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

/** `oauthProviders` defaults to one configured provider — the composed page's
 * "Connected accounts" group only renders when the deployment has at least
 * one (see the dedicated hide/show test below for the empty case). */
function mockEverything(
  options: { oauthProviders?: readonly { id: string; name: string }[] } = {}
): void {
  const oauth = options.oauthProviders ?? [{ id: "google", name: "Google" }];
  server.use(
    http.get(`${BASE}/me/`, () => HttpResponse.json(testUser({ email: "ada@example.com", phone: "+15551234567" }))),
    http.get(`${BASE}/sessions/`, () => HttpResponse.json([])),
    http.get(`${BASE}/security/status/`, () =>
      HttpResponse.json({ totp: { is_enabled: false, backup_codes_remaining: 0 } })
    ),
    http.get(`${BASE}/password/methods/`, () =>
      HttpResponse.json({ methods: [{ method: "password" }], has_password: true })
    ),
    http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [] })),
    http.get(`${BASE}/capabilities/`, () =>
      HttpResponse.json({
        registration: { phone: false, email: true, password: false, oauth, sso: false, anonymous: false },
        login: { phone: false, email: true, password: false, oauth, sso: false, qr: false, passkey: false, magic_link: false },
        methods: [],
      })
    ),
    http.get(`${BASE}/oauth/links/`, () => HttpResponse.json({ links: [] })),
    http.get(`${BASE}/email/change/delayed/status/`, () =>
      HttpResponse.json({ has_pending_change: false })
    ),
    http.get(`${BASE}/phone/change/delayed/status/`, () =>
      HttpResponse.json({ has_pending_change: false })
    ),
    http.get(`${BASE}/security/audit/`, () => HttpResponse.json({ results: [], count: 0, next: null }))
  );
}

describe("<SecuritySettings/> — composed, grouped page", () => {
  it("renders the page title/subtitle and every grouped section with its widgets", async () => {
    mockEverything();
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SecuritySettings />));

    await waitFor(() => expect(screen.getByTestId("security-settings")).toBeDefined());
    expect(screen.getByRole("heading", { level: 2, name: "Security" })).toBeDefined();
    expect(
      screen.getByText("Manage your sign-in methods, connected devices, and account activity.")
    ).toBeDefined();

    // Group headings (owner spec, exact grouping) — real `<h4>` elements,
    // distinct from same-named widget Card titles (e.g. TotpManager's own
    // "Two-factor authentication" Card title, which is a `div`, not a heading).
    expect(screen.getByRole("heading", { level: 4, name: "Contact details" })).toBeDefined();
    expect(screen.getByRole("heading", { level: 4, name: "Two-factor authentication" })).toBeDefined();
    expect(screen.getByRole("heading", { level: 4, name: "Devices & sessions" })).toBeDefined();
    // Depends on `useCapabilities()` resolving (the group hides until then —
    // see the dedicated hide/show test below), so it's the one heading
    // worth an explicit wait rather than the others' synchronous assert.
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 4, name: "Connected accounts" })).toBeDefined()
    );
    expect(screen.getByRole("heading", { level: 4, name: "Security log" })).toBeDefined();

    // Each widget renders its own Card title straight from its hook.
    await waitFor(() => expect(screen.getByTestId("email-change-panel")).toBeDefined());
    expect(screen.getByTestId("phone-change-panel")).toBeDefined();
    expect(screen.getByTestId("sessions-list")).toBeDefined();
    expect(screen.getByTestId("totp-manager")).toBeDefined();
    expect(screen.getByTestId("passkeys-manager")).toBeDefined();
    expect(screen.getByTestId("password-change-panel")).toBeDefined();
    expect(screen.getByTestId("oauth-links")).toBeDefined();
    expect(screen.getByTestId("qr-device-link-panel")).toBeDefined();
    expect(screen.getByTestId("audit-log-panel")).toBeDefined();

    // The masked current-value line proves EmailChangePanel/PhoneChangePanel
    // read real `useMe()` data, not a placeholder.
    await waitFor(() => expect(screen.getByText(/a•••@example.com/)).toBeDefined());
  });

  it("hides the whole Connected-accounts group when no OAuth providers are configured", async () => {
    mockEverything({ oauthProviders: [] });
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SecuritySettings />));

    // Wait for a section that's ALWAYS present to prove the page settled,
    // then assert the OAuth group never appeared — not even its heading.
    await waitFor(() => expect(screen.getByTestId("audit-log-panel")).toBeDefined());
    expect(screen.queryByRole("heading", { level: 4, name: "Connected accounts" })).toBeNull();
    expect(screen.queryByTestId("oauth-links")).toBeNull();
  });
});
