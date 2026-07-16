/**
 * `<TotpManager/>` (owner directive point 5): enable via the existing
 * `TotpSetup` headless flow (start → QR/secret → confirm → backup codes),
 * disable via the existing `useDisableTotp` mutation. Status read from the
 * existing `useSecurityStatus` query — no new backend surface.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createAuthRuntime } from "../../src/model/runtime.js";
import type { AuthRuntime } from "../../src/model/runtime.js";
import { AuthProvider } from "../../src/headless/AuthProvider.js";
import { registerAuthI18n } from "../../src/i18n/keys.js";
import { TotpManager } from "../../src/default/security/TotpManager.js";
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

function securityStatus(overrides: { is_enabled: boolean; backup_codes_remaining?: number }) {
  return {
    password: { is_set: true },
    totp: { is_enabled: overrides.is_enabled, backup_codes_remaining: overrides.backup_codes_remaining ?? 8 },
    email: { value: "a***@b.com", is_verified: true },
    phone: { value: null, is_verified: false },
    oauth: { connected_providers: [] },
    sessions: { active_count: 1 },
    passkeys: { count: 0 },
  };
}

function fillOtp(code: string): void {
  for (let i = 0; i < code.length; i++) {
    const cell = screen.getByLabelText(`OTP Input ${i + 1}`);
    fireEvent.input(cell, { target: { value: code[i] } });
  }
}

describe("<TotpManager/>", () => {
  it("shows 'Not set up' and a Set up button when disabled", async () => {
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: false }))
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));
    await waitFor(() => expect(screen.getByText("Not set up")).toBeDefined());
    expect(screen.getByRole("button", { name: "Set up" })).toBeDefined();
  });

  it("shows Enabled + backup code count when enabled, with a Disable button", async () => {
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: true, backup_codes_remaining: 5 }))
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));
    await waitFor(() => expect(screen.getByText("Enabled")).toBeDefined());
    expect(screen.getByText("5 backup codes left")).toBeDefined();
    expect(screen.getByRole("button", { name: "Disable" })).toBeDefined();
  });

  it("full enable journey: start → QR/secret → confirm → backup codes → status refetches", async () => {
    let confirmed = false;
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: confirmed }))
      ),
      http.post(`${BASE}/totp/setup/`, () =>
        HttpResponse.json({ secret: "JBSWY3DPEHPK3PXP", qr_uri: "otpauth://totp/demo", expires_in: 300 })
      ),
      http.post(`${BASE}/totp/setup/confirm/`, () => {
        confirmed = true;
        return HttpResponse.json({ backup_codes: ["11111111", "22222222"] });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));
    await waitFor(() => expect(screen.getByRole("button", { name: "Set up" })).toBeDefined());
    screen.getByRole("button", { name: "Set up" }).click();

    await screen.findByRole("dialog");
    await screen.findByText("JBSWY3DPEHPK3PXP");
    fillOtp("123456");
    screen.getByRole("button", { name: "Confirm" }).click();

    await screen.findByText("11111111");
    screen.getByRole("button", { name: "I've saved these codes" }).click();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("disable via authenticator code", async () => {
    let enabled = true;
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: enabled }))
      ),
      http.post(`${BASE}/totp/disable/`, async ({ request }) => {
        const body = (await request.json()) as { method: string; code?: string };
        expect(body.method).toBe("_TOTPDisableByTOTP");
        expect(body.code).toBe("654321");
        enabled = false;
        return HttpResponse.json({ status: "ok" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));
    await waitFor(() => expect(screen.getByRole("button", { name: "Disable" })).toBeDefined());
    screen.getByRole("button", { name: "Disable" }).click();
    await screen.findByRole("dialog");
    const input = screen.getByLabelText("Authenticator code");
    fireEvent.change(input, { target: { value: "654321" } });
    screen.getAllByRole("button", { name: "Disable" })[1]?.click();
    await waitFor(() => expect(enabled).toBe(false));
  });
});
