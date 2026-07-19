/**
 * `<SecuritySettings/>` — proof that the composed page renders all six
 * security widgets from the pair's real hooks (no new backend surface),
 * closing the gap the nav-manifest `"auth.security"` entry pointed at: a
 * single component worth wiring behind one menu item.
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
import { BASE } from "./helpers.js";

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

describe("<SecuritySettings/> — composed page (sessions, TOTP, passkeys, password, oauth, QR)", () => {
  it("renders every sub-widget's own title from the pair's real hooks", async () => {
    server.use(
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
          registration: { phone: false, email: true, password: false, oauth: [], sso: false, anonymous: false },
          login: { phone: false, email: true, password: false, oauth: [], sso: false, qr: false, passkey: false, magic_link: false },
          methods: [],
        })
      ),
      http.get(`${BASE}/oauth/links/`, () => HttpResponse.json({ links: [] }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SecuritySettings />));

    await waitFor(() => expect(screen.getByTestId("security-settings")).toBeDefined());
    // Each widget renders its own section title straight from its hook.
    await waitFor(() => expect(screen.getByText("Active sessions")).toBeDefined());
    expect(screen.getByText("Two-factor authentication")).toBeDefined();
    expect(screen.getByText("Passkeys")).toBeDefined();
    // "Change password" appears twice here: the panel's own title AND the
    // single-method tab label — both real, expected duplication.
    expect(screen.getAllByText("Change password").length).toBeGreaterThan(0);
    expect(screen.getByText("Connected accounts")).toBeDefined();
    // QrDeviceLinkPanel is idle until opened — its row title still shows.
    expect(screen.getByText("Sign in on another device")).toBeDefined();
  });
});
