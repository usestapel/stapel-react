/**
 * `<EmailChangePanel/>` — thin `channel="email"` wrapper over the shared
 * `AuthenticatorChangePanel`. Covers: masked current-value display, the
 * instant flow's full step chain (built on the EXISTING `<AuthenticatorChange>`
 * headless flow — this test proves the UI drives it, not that the flow itself
 * works, which is covered by the flow's own unit tests), the delayed path
 * (no old-channel proof, 14-day pending banner + cancel), and a
 * pending-on-mount short-circuit.
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
import { EmailChangePanel } from "../../src/default/security/EmailChangePanel.js";
import { BASE, authResponse, testUser } from "../helpers.js";

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

function enterOtp(code: string): void {
  for (let i = 0; i < code.length; i++) {
    fireEvent.input(screen.getByLabelText(`OTP Input ${i + 1}`), { target: { value: code[i] } });
  }
}

describe("<EmailChangePanel/>", () => {
  it("shows the masked current email and a 'Change email' trigger", async () => {
    server.use(
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser({ email: "ada@example.com" }))),
      http.get(`${BASE}/email/change/delayed/status/`, () =>
        HttpResponse.json({ has_pending_change: false })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <EmailChangePanel />));

    await waitFor(() => expect(screen.getByText(/a•••@example.com/)).toBeDefined());
    expect(screen.getByRole("button", { name: "Change Email" })).toBeDefined();
  });

  it("drives the instant flow: old code → new value → new code → success", async () => {
    server.use(
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser({ email: "ada@example.com" }))),
      http.get(`${BASE}/email/change/delayed/status/`, () =>
        HttpResponse.json({ has_pending_change: false })
      ),
      http.post(`${BASE}/email/change/instant/request-old/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@example.com" })
      ),
      http.post(`${BASE}/email/change/instant/verify-old/`, async ({ request }) => {
        expect(await request.json()).toEqual({ code: "123456" });
        return HttpResponse.json({ status: "OLD_VERIFIED", change_token: "ctk_1", expires_at: "2026-01-01T00:00:00Z" });
      }),
      http.post(`${BASE}/email/change/instant/request-new/`, async ({ request }) => {
        expect(await request.json()).toEqual({ email: "new@example.com", change_token: "ctk_1" });
        return HttpResponse.json({ message: "sent", target: "n***@example.com" });
      }),
      http.post(`${BASE}/email/change/instant/verify-new/`, async ({ request }) => {
        expect(await request.json()).toEqual({
          email: "new@example.com",
          code: "654321",
          change_token: "ctk_1",
        });
        return HttpResponse.json(authResponse());
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <EmailChangePanel />));

    await waitFor(() => expect(screen.getByRole("button", { name: "Change Email" })).toBeDefined());
    screen.getByRole("button", { name: "Change Email" }).click();

    await screen.findByRole("button", { name: "Send code" });
    screen.getByRole("button", { name: "Send code" }).click();

    await screen.findByLabelText("OTP Input 1");
    enterOtp("123456");
    screen.getByRole("button", { name: "Confirm" }).click();

    await screen.findByLabelText("New Email");
    fireEvent.change(screen.getByLabelText("New Email"), { target: { value: "new@example.com" } });
    screen.getByRole("button", { name: "Send code to new Email" }).click();

    await screen.findByLabelText("OTP Input 1");
    enterOtp("654321");
    screen.getByRole("button", { name: "Confirm" }).click();

    await screen.findByText("Your Email has been changed.");
  });

  it("the delayed path ('no access to your old email?') starts a 14-day change with no old-channel proof", async () => {
    let hasPending = false;
    server.use(
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser({ email: "ada@example.com" }))),
      http.get(`${BASE}/email/change/delayed/status/`, () =>
        HttpResponse.json(
          hasPending
            ? {
                has_pending_change: true,
                change_request_id: "req_1",
                type: "email",
                new_value_masked: "n***@example.com",
                scheduled_at: "2026-08-01T00:00:00Z",
                days_remaining: 14,
              }
            : { has_pending_change: false }
        )
      ),
      http.post(`${BASE}/email/change/delayed/initiate/`, async ({ request }) => {
        expect(await request.json()).toEqual({ email: "new@example.com" });
        hasPending = true;
        return HttpResponse.json({
          status: "PENDING",
          change_request_id: "req_1",
          new_value_masked: "n***@example.com",
          scheduled_at: "2026-08-01T00:00:00Z",
        });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <EmailChangePanel />));

    await waitFor(() => expect(screen.getByRole("button", { name: "Change Email" })).toBeDefined());
    screen.getByRole("button", { name: "Change Email" }).click();

    await screen.findByRole("button", { name: "No access to your old Email?" });
    screen.getByRole("button", { name: "No access to your old Email?" }).click();

    await screen.findByLabelText("New Email");
    fireEvent.change(screen.getByLabelText("New Email"), { target: { value: "new@example.com" } });
    screen.getByRole("button", { name: "Start 14-day change" }).click();

    // Success re-fetches delayedChangeStatus (now pending) and the panel
    // switches from the change flow to the pending banner.
    await screen.findByText(/Changing to n\*\*\*@example.com/);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("a pending delayed change on mount short-circuits straight to the banner (no form)", async () => {
    server.use(
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser({ email: "ada@example.com" }))),
      http.get(`${BASE}/email/change/delayed/status/`, () =>
        HttpResponse.json({
          has_pending_change: true,
          change_request_id: "req_9",
          type: "email",
          new_value_masked: "n***@example.com",
          scheduled_at: "2026-08-01T00:00:00Z",
          days_remaining: 5,
        })
      ),
      http.post(`${BASE}/email/change/delayed/cancel/`, async ({ request }) => {
        expect(await request.json()).toEqual({ change_request_id: "req_9" });
        return HttpResponse.json({ status: "cancelled" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <EmailChangePanel />));

    await waitFor(() => expect(screen.getByText(/Changing to n\*\*\*@example.com/)).toBeDefined());
    // No "Change Email" trigger and no masked-current-value line — the
    // pending banner fully replaces the change UI.
    expect(screen.queryByRole("button", { name: "Change Email" })).toBeNull();

    screen.getByRole("button", { name: "Cancel" }).click();
    const confirmButtons = await screen.findAllByRole("button", { name: "Cancel" });
    confirmButtons[confirmButtons.length - 1]?.click();
  });
});
