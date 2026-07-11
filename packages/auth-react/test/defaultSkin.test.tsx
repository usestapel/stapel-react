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
