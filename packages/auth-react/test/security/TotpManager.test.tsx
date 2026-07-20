/**
 * `<TotpManager/>` (owner directive point 5): enable via the existing
 * `TotpSetup` headless flow (start → QR/secret → confirm → backup codes),
 * disable via the existing `useDisableTotp` mutation. Status read from the
 * existing `useSecurityStatus` query.
 *
 * Also covers the stapel-auth ≥0.9.0 TOTP-change surface: REPLACE (proof-
 * gated `POST /totp/setup/` — proof omitted surfaces `totp_proof_required` as
 * an inline retry, not a dead end) and DELAYED REMOVAL ("lost device" — a
 * pending banner short-circuits the card, cancellable, `no_verified_contact`
 * is a genuine dead end).
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

/** No pending delayed removal — the common-case mock for tests that aren't
 * exercising that surface. */
function noPendingDelayed() {
  return http.get(`${BASE}/totp/change/delayed/status/`, () =>
    HttpResponse.json({ has_pending_change: false })
  );
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
      ),
      noPendingDelayed()
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));
    await waitFor(() => expect(screen.getByText("Not set up")).toBeDefined());
    expect(screen.getByRole("button", { name: "Set up" })).toBeDefined();
  });

  it("shows Enabled + backup code count when enabled, with Replace and Disable buttons", async () => {
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: true, backup_codes_remaining: 5 }))
      ),
      noPendingDelayed()
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));
    await waitFor(() => expect(screen.getByText("Enabled")).toBeDefined());
    expect(screen.getByText("5 backup codes left")).toBeDefined();
    expect(screen.getByRole("button", { name: "Replace" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Disable" })).toBeDefined();
  });

  it("full enable journey: start → QR/secret → confirm → backup codes → status refetches", async () => {
    let confirmed = false;
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: confirmed }))
      ),
      noPendingDelayed(),
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
      noPendingDelayed(),
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

  it("replace requires proof: opens straight on the code prompt, and a rejected proof surfaces totp_proof_required inline", async () => {
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: true }))
      ),
      noPendingDelayed(),
      http.post(`${BASE}/totp/setup/`, async ({ request }) => {
        const body = (await request.json()) as { code?: string };
        if (body.code !== "123456") {
          return HttpResponse.json(
            { localizable_error: "error.400.totp_proof_required" },
            { status: 400 }
          );
        }
        return HttpResponse.json({ secret: "NEWSECRET", qr_uri: "otpauth://totp/new", expires_in: 300 });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));

    await waitFor(() => expect(screen.getByRole("button", { name: "Replace" })).toBeDefined());
    screen.getByRole("button", { name: "Replace" }).click();
    await screen.findByRole("dialog");

    // Proof-omitted: the code prompt is shown immediately — no network call
    // was made yet, and there's no error (first, un-proved attempt).
    const codeInput = await screen.findByLabelText("Authenticator code");
    expect(screen.queryByText(/A TOTP already exists/)).toBeNull();

    // Wrong/empty proof → 400 totp_proof_required, surfaced inline on the
    // SAME form (not a dead end — the user can just retry).
    fireEvent.change(codeInput, { target: { value: "000000" } });
    screen.getByRole("button", { name: "Continue" }).click();
    await screen.findByText(/A TOTP already exists on this account/);

    // Correct proof → the replace enrolls a new device, same QR/secret UI as
    // first-time setup.
    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
    screen.getByRole("button", { name: "Continue" }).click();
    await screen.findByText("NEWSECRET");
  });

  it("delayed removal ('lost your authenticator') initiates and shows the pending banner with a cancel action", async () => {
    let hasPending = false;
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: true }))
      ),
      http.get(`${BASE}/totp/change/delayed/status/`, () =>
        HttpResponse.json(
          hasPending
            ? {
                has_pending_change: true,
                change_request_id: "req_t1",
                type: "totp",
                new_value_masked: "authenticator app",
                scheduled_at: "2026-08-01T00:00:00Z",
                days_remaining: 14,
              }
            : { has_pending_change: false }
        )
      ),
      http.post(`${BASE}/totp/change/delayed/initiate/`, async ({ request }) => {
        expect(await request.json()).toEqual({});
        hasPending = true;
        return HttpResponse.json({
          status: "PENDING",
          change_request_id: "req_t1",
          new_value_masked: "authenticator app",
          scheduled_at: "2026-08-01T00:00:00Z",
        });
      }),
      http.post(`${BASE}/totp/change/delayed/cancel/`, async ({ request }) => {
        expect(await request.json()).toEqual({ change_request_id: "req_t1" });
        return HttpResponse.json({ status: "cancelled" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));

    await waitFor(() => expect(screen.getByRole("button", { name: "Replace" })).toBeDefined());
    screen.getByRole("button", { name: "Replace" }).click();
    await screen.findByRole("dialog");

    screen.getByRole("button", { name: "Lost your authenticator?" }).click();
    await screen.findByRole("button", { name: "Request removal" });
    screen.getByRole("button", { name: "Request removal" }).click();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await screen.findByText(/will be removed on/);
    expect(screen.queryByRole("button", { name: "Replace" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Disable" })).toBeNull();

    screen.getByRole("button", { name: "Cancel" }).click();
    const confirmButtons = await screen.findAllByRole("button", { name: "Cancel" });
    confirmButtons[confirmButtons.length - 1]?.click();
  });

  it("a pending delayed removal on mount short-circuits to the banner", async () => {
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: true }))
      ),
      http.get(`${BASE}/totp/change/delayed/status/`, () =>
        HttpResponse.json({
          has_pending_change: true,
          change_request_id: "req_t2",
          type: "totp",
          new_value_masked: "authenticator app",
          scheduled_at: "2026-08-01T00:00:00Z",
          days_remaining: 3,
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));

    await waitFor(() => expect(screen.getByText(/will be removed on/)).toBeDefined());
    expect(screen.queryByRole("button", { name: "Replace" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Disable" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Set up" })).toBeNull();
  });

  it("no_verified_contact on delayed initiate shows a dead end, not a retry loop", async () => {
    server.use(
      http.get(`${BASE}/security/status/`, () =>
        HttpResponse.json(securityStatus({ is_enabled: true }))
      ),
      noPendingDelayed(),
      http.post(`${BASE}/totp/change/delayed/initiate/`, () =>
        HttpResponse.json({ localizable_error: "error.400.no_verified_contact" }, { status: 400 })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <TotpManager />));

    await waitFor(() => expect(screen.getByRole("button", { name: "Replace" })).toBeDefined());
    screen.getByRole("button", { name: "Replace" }).click();
    await screen.findByRole("dialog");

    screen.getByRole("button", { name: "Lost your authenticator?" }).click();
    await screen.findByRole("button", { name: "Request removal" });
    screen.getByRole("button", { name: "Request removal" }).click();

    await screen.findByText("No recovery contact on file");
    expect(screen.queryByRole("button", { name: "Request removal" })).toBeNull();
  });
});
