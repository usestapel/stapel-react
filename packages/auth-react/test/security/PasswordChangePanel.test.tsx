/**
 * `<PasswordChangePanel/>` (owner directive point 5): tabs come from the
 * existing `usePasswordMethods()` query; each tab drives the existing
 * `PasswordChange` headless flow (old-password direct change, or an
 * email/phone OTP-verified change) — no new backend surface.
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
import { PasswordChangePanel } from "../../src/default/security/PasswordChangePanel.js";
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

describe("<PasswordChangePanel/>", () => {
  it("a single 'password' method renders the old-password form directly (no tabs)", async () => {
    server.use(
      http.get(`${BASE}/password/methods/`, () =>
        HttpResponse.json({ methods: [{ method: "password" }], has_password: true })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasswordChangePanel />));
    await waitFor(() => expect(screen.getByText("Current password")).toBeDefined());
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("changes the password with the old one and shows success", async () => {
    server.use(
      http.get(`${BASE}/password/methods/`, () =>
        HttpResponse.json({ methods: [{ method: "password" }], has_password: true })
      ),
      http.post(`${BASE}/password/change/`, async ({ request }) => {
        expect(await request.json()).toEqual({ old_password: "old1", new_password: "new1" });
        return HttpResponse.json({ status: "ok" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasswordChangePanel />));
    await waitFor(() => expect(screen.getByText("Current password")).toBeDefined());
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old1" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new1" } });
    screen.getByRole("button", { name: "Change password" }).click();
    await screen.findByText("Password changed.");
  });

  it("email + password methods both render as tabs", async () => {
    server.use(
      http.get(`${BASE}/password/methods/`, () =>
        HttpResponse.json({
          methods: [{ method: "password" }, { method: "email", target: "a***@b.com" }],
          has_password: true,
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasswordChangePanel />));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Email" })).toBeDefined());
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("a single 'email' method (no password set) requests a code then verifies", async () => {
    server.use(
      http.get(`${BASE}/password/methods/`, () =>
        HttpResponse.json({
          methods: [{ method: "email", target: "a***@b.com" }],
          has_password: false,
        })
      ),
      http.post(`${BASE}/password/change/otp/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      ),
      http.post(`${BASE}/password/change/otp/verify/`, async ({ request }) => {
        expect(await request.json()).toEqual({
          method: "email",
          code: "123456",
          new_password: "new2",
        });
        return HttpResponse.json({ status: "ok" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasswordChangePanel />));
    await waitFor(() =>
      expect(screen.getByText("We'll send a code to a***@b.com")).toBeDefined()
    );
    expect(screen.queryByRole("tab")).toBeNull();
    screen.getByRole("button", { name: "Send code" }).click();

    await waitFor(() =>
      expect(screen.getAllByText("We'll send a code to a***@b.com").length).toBeGreaterThan(0)
    );
    for (let i = 0; i < 6; i++) {
      fireEvent.input(screen.getByLabelText(`OTP Input ${i + 1}`), { target: { value: "123456"[i] } });
    }
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new2" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new2" } });
    screen.getByRole("button", { name: "Change password" }).click();

    await screen.findByText("Password changed.");
  });

  it("a mismatched confirmation blocks submission (owner UX audit point 7)", async () => {
    let changeCalls = 0;
    server.use(
      http.get(`${BASE}/password/methods/`, () =>
        HttpResponse.json({ methods: [{ method: "password" }], has_password: true })
      ),
      http.post(`${BASE}/password/change/`, () => {
        changeCalls += 1;
        return HttpResponse.json({ status: "ok" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasswordChangePanel />));
    await waitFor(() => expect(screen.getByText("Current password")).toBeDefined());
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old1" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "typo" } });
    screen.getByRole("button", { name: "Change password" }).click();

    await screen.findByText("Passwords don't match.");
    expect(changeCalls).toBe(0); // the mismatch never reached the backend
  });
});

/**
 * Per-method capability caption (§68 promote/orphan fix follow-up, owner
 * directive point 5): `methodCapabilityLabel("password", …)` — see
 * `channels.test.ts` for the pure-logic coverage; these prove it's actually
 * WIRED into the widget, including the anonymous "portable guest account"
 * framing.
 */
describe("<PasswordChangePanel/> — capability caption", () => {
  const CAPS_BOTH = {
    methods: [
      { id: "password", enabled: true, can_login: true, can_register: true, placement: "overflow", order: 7, interaction: "modal", icon_svg: "" },
    ],
  };

  it("shows 'Sign-in and registration' for a non-anonymous viewer when password can do both", async () => {
    server.use(
      http.get(`${BASE}/password/methods/`, () =>
        HttpResponse.json({ methods: [{ method: "password" }], has_password: true })
      ),
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPS_BOTH))
    );
    // cookieMode: false + no persisted hint cookie in jsdom -> AuthProvider's
    // mount-time restore() bootstrap probe declines outright (no network
    // call) instead of racing a real /token/refresh/ and tearing the
    // explicitly adopted state back down to null (session.ts's
    // shouldRunBootstrapProbe/bootstrapProbe doc has the full contract).
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    runtime.session.adopt({
      status: "LOGGED_IN",
      user: testUser({ is_anonymous: false }),
      tokens: { access: "a", refresh: "r" },
    });
    render(wrap(runtime, <PasswordChangePanel />));
    await screen.findByTestId("password-capability-label");
    expect(screen.getByText("Sign-in and registration")).toBeDefined();
  });

  it("reframes password's login capability as guest-account portability for an ANONYMOUS viewer", async () => {
    server.use(
      http.get(`${BASE}/password/methods/`, () =>
        HttpResponse.json({ methods: [{ method: "password" }], has_password: true })
      ),
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPS_BOTH))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    runtime.session.adopt({
      status: "LOGGED_IN",
      user: testUser({ is_anonymous: true }),
      tokens: { access: "a", refresh: "r" },
    });
    render(wrap(runtime, <PasswordChangePanel />));
    await screen.findByTestId("password-capability-label");
    expect(
      screen.getByText("Sign in to your guest account from another device")
    ).toBeDefined();
    expect(screen.queryByText("Sign-in and registration")).toBeNull();
  });

  it("renders no caption when capabilities haven't carried a password entry", async () => {
    server.use(
      http.get(`${BASE}/password/methods/`, () =>
        HttpResponse.json({ methods: [{ method: "password" }], has_password: true })
      ),
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json({ methods: [] }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasswordChangePanel />));
    await waitFor(() => expect(screen.getByText("Current password")).toBeDefined());
    expect(screen.queryByTestId("password-capability-label")).toBeNull();
  });
});
