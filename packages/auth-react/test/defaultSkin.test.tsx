/**
 * §54 proof: the default skin `<AuthPanel/>` renders a working, themed sign-in
 * screen straight from the headless layer, and its Ant Design theme is driven
 * by `@stapel/tokens-antd` — switching `mode` flips antd's RUNTIME token to the
 * user's `@stapel/tokens` light/dark palette. No hand-written UI, no manual
 * token wiring.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, theme as antdTheme } from "antd";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { colors, bridgeColorRoles } from "@stapel/tokens";
import { toAntdThemeConfig } from "@stapel/tokens-antd";
import { createAuthRuntime } from "../src/model/runtime.js";
import type { AuthRuntime } from "../src/model/runtime.js";
import { AuthProvider } from "../src/headless/AuthProvider.js";
import { registerAuthI18n } from "../src/i18n/keys.js";
import { AuthPanel } from "../src/default/index.js";
import { BASE } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup(); // unmount between renders: isolates DOM queries + clears antd timers
  server.resetHandlers();
});
afterAll(() => server.close());

const CAPABILITIES = {
  registration: {
    phone: false,
    email: true,
    password: false,
    oauth: [],
    sso: false,
    anonymous: false,
  },
  login: {
    // 5 channels enabled, no methods[] (pre-0.6.0 fallback): email/phone →
    // main, qr/passkey → bottom, password → overflow (owner-directive defaults).
    phone: true,
    email: true,
    password: true,
    oauth: [],
    sso: false,
    qr: true,
    passkey: true,
    magic_link: false,
  },
};

function wrap(runtime: AuthRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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

describe("<AuthPanel/> — the §54 default skin renders out of the box", () => {
  it("renders the four-zone themed screen from useCapabilities (zero manual UI)", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPABILITIES))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));

    // Zone A title.
    await waitFor(() =>
      expect(screen.getByText("Sign in")).toBeDefined()
    );
    // Zone B main tabs: email/phone (both default to "main").
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined();
    });
    expect(screen.getByRole("tab", { name: "Phone" })).toBeDefined();
    expect(screen.queryByRole("tab", { name: "Passkey" })).toBeNull();
    // The active email panel shows its primary submit — a real working form.
    expect(screen.getByRole("button", { name: "Send code" })).toBeDefined();
    // Exactly one primary button on screen (ПРАВИЛО 5).
    const primaries = document.querySelectorAll(".ant-btn-primary");
    expect(primaries.length).toBe(1);
  });

  it("mounts in dark mode without a throw (same headless panel, dark theme)", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPABILITIES))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="dark" />));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined()
    );
  });
});

/**
 * The theme-switch proof, isolated to the exact bridge AuthPanel uses: a probe
 * reads antd's RESOLVED runtime token under `toAntdThemeConfig(mode)` and shows
 * it maps to `@stapel/tokens`' light/dark core values — the same call AuthPanel
 * makes in its `<ConfigProvider>`.
 */
function TokenProbe(): ReactElement {
  const { token } = antdTheme.useToken();
  return <span data-testid="bg">{token.colorBgContainer}</span>;
}

/**
 * Owner directive point 3 (OTP UX): no "Confirm" button — the code auto-
 * submits the instant every cell is filled, the digit count comes from the
 * backend's `otp_code_length` (fallback 6), and a wrong code clears the
 * cells + refocuses rather than leaving stale digits sitting there.
 */
describe("<AuthPanel/> — OTP auto-submit (owner directive point 3)", () => {
  const EMAIL_ONLY_CAPS = (emailCodeLength?: number) => ({
    registration: {
      phone: false,
      email: true,
      password: false,
      oauth: [],
      sso: false,
      anonymous: false,
    },
    login: {
      phone: false,
      email: true,
      password: false,
      oauth: [],
      sso: false,
      qr: false,
      passkey: false,
      magic_link: false,
    },
    mfa: { totp: false, passkey: false },
    methods: [],
    ...(emailCodeLength !== undefined
      ? {
          otp: {
            email_code_length: emailCodeLength,
            phone_code_length: emailCodeLength,
            totp_code_length: 6,
            ttl_seconds: 600,
            resend_cooldown_seconds: 30,
          },
        }
      : {}),
  });

  function fillOtp(code: string): void {
    for (let i = 0; i < code.length; i++) {
      const cell = screen.getByLabelText(`OTP Input ${i + 1}`) as HTMLInputElement;
      fireEvent.input(cell, { target: { value: code[i] } });
    }
  }

  it("auto-submits (no button) once every cell is filled, honouring a custom otp_code_length", async () => {
    let verifyCalls = 0;
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(EMAIL_ONLY_CAPS(4))),
      http.post(`${BASE}/email/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      ),
      http.post(`${BASE}/email/verify/`, async ({ request }) => {
        verifyCalls += 1;
        const body = (await request.json()) as { code: string };
        expect(body.code).toBe("1234"); // exactly 4 digits — the plan's otp_code_length
        return HttpResponse.json({
          status: "LOGGED_IN",
          user: {
            id: "u1", username: "a", email: "a@b.com", phone: null,
            auth_type: "email", is_email_verified: true, is_phone_verified: false,
            is_anonymous: false, is_staff: false, is_superuser: false,
            oauth_provider: null, created_at: "2026-01-01T00:00:00Z", last_login: null,
          },
          tokens: { access: "a", refresh: "r" },
        });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));

    const emailInput = await screen.findByPlaceholderText("you@example.com");
    fireEvent.change(emailInput, { target: { value: "a@b.com" } });
    screen.getByRole("button", { name: "Send code" }).click();

    await screen.findByLabelText("OTP Input 1");
    expect(screen.queryByLabelText("OTP Input 5")).toBeNull(); // exactly 4 cells
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull(); // no confirm button anywhere

    fillOtp("1234");

    await waitFor(() => expect(verifyCalls).toBe(1));
    // Filling never re-triggers a second call (anti-dup-submit guard).
    expect(verifyCalls).toBe(1);
  });

  it("defaults to 6 digits when the backend omits otp_code_length", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(EMAIL_ONLY_CAPS())),
      http.post(`${BASE}/email/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    const emailInput = await screen.findByPlaceholderText("you@example.com");
    fireEvent.change(emailInput, { target: { value: "a@b.com" } });
    screen.getByRole("button", { name: "Send code" }).click();
    await screen.findByLabelText("OTP Input 6");
    expect(screen.queryByLabelText("OTP Input 7")).toBeNull();
  });

  it("clears the cells and refocuses the first one on a wrong code", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(EMAIL_ONLY_CAPS(4))),
      http.post(`${BASE}/email/request/`, () =>
        HttpResponse.json({ message: "sent", target: "a***@b.com" })
      ),
      http.post(`${BASE}/email/verify/`, () =>
        HttpResponse.json(
          { localizable_error: "error.400.invalid_code", error: "Wrong code" },
          { status: 400 }
        )
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    const emailInput = await screen.findByPlaceholderText("you@example.com");
    fireEvent.change(emailInput, { target: { value: "a@b.com" } });
    screen.getByRole("button", { name: "Send code" }).click();
    await screen.findByLabelText("OTP Input 1");

    fillOtp("1234");
    await screen.findByText("That code is incorrect.");

    // Cells cleared and refocused — ready for a fresh attempt, not stuck on
    // 4 stale wrong digits.
    const first = screen.getByLabelText("OTP Input 1") as HTMLInputElement;
    await waitFor(() => expect(first.value).toBe(""));
    expect(document.activeElement).toBe(first);
  });
});

/**
 * Owner directive (tuning §54's pilot, points 1/3/4): the "three-dot" overflow
 * menu used to `setActive()` a channel absent from the tab strip's own
 * `items` — nothing ever rendered. This proves the fix: picking an overflow
 * channel opens a DIALOG with its real panel, and it does NOT add a 4th tab.
 */
describe("<AuthPanel/> — alt-method dialog (owner directive: overflow/bottom never overlay the main tabs)", () => {
  const MANY_CHANNELS = {
    registration: {
      phone: false,
      email: true,
      password: false,
      oauth: [],
      sso: false,
      anonymous: false,
    },
    login: {
      // 6 channels enabled, no methods[] (pre-0.6.0 fallback): email/phone →
      // main, qr/passkey → bottom, password/magic_link → overflow.
      phone: true,
      email: true,
      password: true,
      oauth: [],
      sso: false,
      qr: true,
      passkey: true,
      magic_link: true,
    },
  };

  it("picking a channel from the overflow menu opens it in a dialog — never a phantom tab", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(MANY_CHANNELS))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined()
    );
    // Still exactly 2 main tabs — main never grows past ПРАВИЛО 4's cap.
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: "Password" })).toBeNull();

    // No dialog yet.
    expect(screen.queryByRole("dialog")).toBeNull();

    screen.getByText("More ways to sign in").click();
    const passwordItem = await screen.findByText("Password");
    passwordItem.click();

    // The dialog now renders the REAL password panel — the bug this fixes is
    // that this content used to render nowhere at all.
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Password");
  });

  it("the bottom icon row shows qr/passkey; picking qr opens the dialog with the QR panel", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(MANY_CHANNELS))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    await waitFor(() =>
      expect(screen.getByTestId("auth-bottom-row")).toBeDefined()
    );
    const row = screen.getByTestId("auth-bottom-row");
    expect(row.textContent).toContain("QR code");

    screen.getByText("QR code").click();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("canvas")).not.toBeNull(); // antd <QRCode/>
  });

  it("SSO is never a tab — it defaults to the bottom row and opens as a dialog form", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json({
          registration: {
            phone: false,
            email: true,
            password: false,
            oauth: [],
            sso: false,
            anonymous: false,
          },
          login: {
            phone: false,
            email: true,
            password: false,
            oauth: [],
            sso: true,
            qr: false,
            passkey: false,
            magic_link: false,
          },
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    await waitFor(() =>
      expect(screen.getByTestId("auth-bottom-row")).toBeDefined()
    );
    expect(screen.queryByRole("tab", { name: "SSO" })).toBeNull();
    screen.getByText("SSO").click();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Work email domain");
  });

  it("OAuth renders as direct provider buttons — no dialog, never a tab", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json({
          registration: {
            phone: false,
            email: true,
            password: false,
            oauth: [{ id: "google", name: "Google" }],
            sso: false,
            anonymous: false,
          },
          login: {
            phone: false,
            email: true,
            password: false,
            oauth: [{ id: "google", name: "Google" }],
            sso: false,
            qr: false,
            passkey: false,
            magic_link: false,
          },
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    const googleButton = await screen.findByRole("link", { name: /Google/ });
    expect(googleButton.getAttribute("href")).toContain("/oauth/google/authorize/");
    expect(screen.queryByRole("tab", { name: "Social" })).toBeNull();
    googleButton.click();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the magic-link channel now reads 'Email link', not 'Magic link'", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(MANY_CHANNELS))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined()
    );
    screen.getByText("More ways to sign in").click();
    expect(await screen.findByText("Email link")).toBeDefined();
    expect(screen.queryByText("Magic link")).toBeNull();
  });
});

/**
 * Waylot UX reference (owner directive): the alt-method dialog should behave
 * like a bottom sheet on mobile, not a centred dialog — cheap here because
 * `@stapel/core`'s `useBreakpoint()` already exists; this is just an
 * additional render path on the SAME `openChannel` state.
 */
describe("<AuthPanel/> — alt-method surface is responsive (Modal on desktop, bottom sheet on phone)", () => {
  const ONE_OVERFLOW_CHANNEL = {
    registration: {
      phone: false,
      email: true,
      password: false,
      oauth: [],
      sso: false,
      anonymous: false,
    },
    login: {
      // 6 enabled → main=[email,phone,passkey], bottom=[qr], overflow=[password,magic_link].
      phone: true,
      email: true,
      password: true,
      oauth: [],
      sso: false,
      qr: true,
      passkey: true,
      magic_link: true,
    },
  };

  function setViewportWidth(width: number): void {
    Object.defineProperty(window, "innerWidth", { value: width, writable: true });
    window.dispatchEvent(new Event("resize"));
  }

  it("uses a centred Modal at desktop width", async () => {
    setViewportWidth(1440);
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(ONE_OVERFLOW_CHANNEL))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined()
    );
    screen.getByText("More ways to sign in").click();
    (await screen.findByText("Password")).click();
    await screen.findByRole("dialog");
    expect(document.querySelector(".ant-modal")).not.toBeNull();
    expect(document.querySelector(".ant-drawer")).toBeNull();
  });

  it("uses a bottom Drawer ('sheet') at phone width — same content, different surface", async () => {
    setViewportWidth(375);
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(ONE_OVERFLOW_CHANNEL))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined()
    );
    screen.getByText("More ways to sign in").click();
    (await screen.findByText("Password")).click();
    await waitFor(() => expect(document.querySelector(".ant-drawer")).not.toBeNull());
    expect(document.querySelector(".ant-drawer")?.className).toContain("ant-drawer-bottom");
    expect(document.querySelector(".ant-modal")).toBeNull();
    setViewportWidth(1440); // restore for subsequent tests in this file
  });
});

describe("toAntdThemeConfig drives antd's runtime token (AuthPanel's theme source)", () => {
  it("light mode resolves to the tokens' light container colour", () => {
    render(
      <ConfigProvider theme={toAntdThemeConfig("light")}>
        <TokenProbe />
      </ConfigProvider>
    );
    expect(screen.getByTestId("bg").textContent).toBe(
      colors[bridgeColorRoles.bgContainer].light
    );
  });

  it("dark mode flips it to the tokens' dark container colour", () => {
    render(
      <ConfigProvider theme={toAntdThemeConfig("dark")}>
        <TokenProbe />
      </ConfigProvider>
    );
    expect(screen.getByTestId("bg").textContent).toBe(
      colors[bridgeColorRoles.bgContainer].dark
    );
  });
});
