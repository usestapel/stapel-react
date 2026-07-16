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
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    // 5 channels enabled → 3 primary tabs + 2 secondary buttons (ПРАВИЛО 4).
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
    // Zone B primary tabs: email/phone/passkey (first 3 by priority).
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined();
    });
    expect(screen.getByRole("tab", { name: "Phone" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Passkey" })).toBeDefined();
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
      // 6 channels enabled → 3 main tabs, qr in the bottom row, password +
      // magic_link behind the overflow menu.
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
    // Still exactly 3 tabs — main never grows past ПРАВИЛО 4's cap.
    expect(screen.getAllByRole("tab")).toHaveLength(3);
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

  it("SSO is never a tab — it renders behind the overflow menu as a dialog form", async () => {
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
      expect(screen.getByText(/Send code|SSO/)).toBeDefined()
    );
    expect(screen.queryByRole("tab", { name: "SSO" })).toBeNull();
    screen.getByText("More ways to sign in").click();
    const ssoItem = await screen.findByText("SSO");
    ssoItem.click();
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
