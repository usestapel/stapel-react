/**
 * `<PhoneChangePanel/>` — thin `channel="phone"` wrapper over the shared
 * `AuthenticatorChangePanel`. `EmailChangePanel.test.tsx` already exercises
 * the full instant/delayed step chain against the shared implementation;
 * this file covers the phone-specific bits: masked phone display, and that
 * the SAME shared component correctly channel-parametrizes to "phone"
 * (delayed initiate + pending-on-mount short-circuit).
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
import { PhoneChangePanel } from "../../src/default/security/PhoneChangePanel.js";
import { BASE, testUser } from "../helpers.js";

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

describe("<PhoneChangePanel/>", () => {
  it("shows the masked current phone number", async () => {
    server.use(
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser({ email: null, phone: "+15551234567" }))),
      http.get(`${BASE}/phone/change/delayed/status/`, () =>
        HttpResponse.json({ has_pending_change: false })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PhoneChangePanel />));

    // Masked: country digit(s) + last two pairs kept, middle collapsed — the
    // exact grouping isn't a contract, only "clearly masked, ends
    // recognizably" is (+15551234567 → "+1 ••• ••• 45 67").
    await waitFor(() => expect(screen.getByText(/•••.*45 67/)).toBeDefined());
    expect(screen.queryByText("+15551234567")).toBeNull();
    expect(screen.getByRole("button", { name: "Change Phone" })).toBeDefined();
  });

  it("starts a delayed phone change and shows the pending banner with a cancel action", async () => {
    let hasPending = false;
    server.use(
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser({ email: null, phone: "+15551234567" }))),
      http.get(`${BASE}/phone/change/delayed/status/`, () =>
        HttpResponse.json(
          hasPending
            ? {
                has_pending_change: true,
                change_request_id: "req_p1",
                type: "phone",
                new_value_masked: "+1 ••• ••• 99 99",
                scheduled_at: "2026-08-01T00:00:00Z",
                days_remaining: 14,
              }
            : { has_pending_change: false }
        )
      ),
      http.post(`${BASE}/phone/change/delayed/initiate/`, async ({ request }) => {
        expect(await request.json()).toEqual({ phone: "+15559999999" });
        hasPending = true;
        return HttpResponse.json({
          status: "PENDING",
          change_request_id: "req_p1",
          new_value_masked: "+1 ••• ••• 99 99",
          scheduled_at: "2026-08-01T00:00:00Z",
        });
      }),
      http.post(`${BASE}/phone/change/delayed/cancel/`, async ({ request }) => {
        expect(await request.json()).toEqual({ change_request_id: "req_p1" });
        return HttpResponse.json({ status: "cancelled" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PhoneChangePanel />));

    await waitFor(() => expect(screen.getByRole("button", { name: "Change Phone" })).toBeDefined());
    screen.getByRole("button", { name: "Change Phone" }).click();

    await screen.findByRole("button", { name: "No access to your old Phone?" });
    screen.getByRole("button", { name: "No access to your old Phone?" }).click();

    await screen.findByLabelText("New Phone");
    fireEvent.change(screen.getByLabelText("New Phone"), { target: { value: "+15559999999" } });
    screen.getByRole("button", { name: "Start 14-day change" }).click();

    await screen.findByText(/Changing to \+1 ••• ••• 99 99/);
    screen.getByRole("button", { name: "Cancel" }).click();
    const confirmButtons = await screen.findAllByRole("button", { name: "Cancel" });
    confirmButtons[confirmButtons.length - 1]?.click();
  });

  it("a pending delayed phone change on mount short-circuits to the banner", async () => {
    server.use(
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser({ email: null, phone: "+15551234567" }))),
      http.get(`${BASE}/phone/change/delayed/status/`, () =>
        HttpResponse.json({
          has_pending_change: true,
          change_request_id: "req_p2",
          type: "phone",
          new_value_masked: "+1 ••• ••• 99 99",
          scheduled_at: "2026-08-01T00:00:00Z",
          days_remaining: 3,
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PhoneChangePanel />));

    await waitFor(() => expect(screen.getByText(/Changing to \+1 ••• ••• 99 99/)).toBeDefined());
    expect(screen.queryByRole("button", { name: "Change Phone" })).toBeNull();
  });
});
