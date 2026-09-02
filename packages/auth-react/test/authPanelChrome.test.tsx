/**
 * `chrome="bare"` — the host keeps its own frame (owner ruling 2026-09-02).
 *
 * The 0.17 default skin started painting its OWN page ground and card
 * (`PAGE_STYLE`/`CARD_STYLE`), with no way for a host to opt out. A host that
 * already wraps `<AuthPanel/>` in its own branded card got a card-in-card
 * squeezed to ~200px with truncated tab labels, plus the dev-only brand
 * `SlotPlaceholder` box inside its frame (verified live on a host).
 *
 * The ruling: pair visuals must never force themselves on a host.
 * `chrome="card"` (the default) is the 0.17 behaviour, unchanged —
 * `defaultSkin.test.tsx` staying green untouched is the proof. `chrome="bare"`
 * renders NO page surface and NO card: zones A–D land directly in the host's
 * own frame, the antd token algorithm still applies (`SkinTheme
 * surface="bare"` paints nothing), and the brand/legal slots render ONLY when
 * passed — a host that owns the chrome states its identity outside the
 * panel, so no `SlotPlaceholder` appears even in a dev build.
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
import { AuthPanel } from "../src/default/index.js";
import { BASE } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** A minimal, complete `AuthMethodInfo` for a fixture's `methods[]` entry. */
function method(
  id: string,
  placement: "main" | "bottom" | "overflow",
  order: number,
  interaction: "inline" | "modal" | "redirect" = placement === "main" ? "inline" : id === "oauth" ? "redirect" : "modal"
) {
  return { id, enabled: true, placement, order, interaction, icon_svg: "" };
}

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
    phone: true,
    email: true,
    password: true,
    oauth: [],
    sso: false,
    qr: true,
    passkey: true,
    magic_link: false,
  },
  methods: [
    method("email", "main", 0),
    method("phone", "main", 1),
    method("qr", "bottom", 0),
    method("passkey", "bottom", 1),
    method("password", "overflow", 0),
  ],
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

function serveCapabilities(): AuthRuntime {
  server.use(
    http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPABILITIES))
  );
  return createAuthRuntime({ baseUrl: BASE });
}

describe("<AuthPanel chrome/> — the host keeps its own frame", () => {
  it("defaults to the card chrome: page surface, raised card, dev brand placeholder (0.17 behaviour, untouched)", async () => {
    const runtime = serveCapabilities();
    render(wrap(runtime, <AuthPanel mode="light" />));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined()
    );
    // The panel's own page ground and its raised card are both there.
    const page = screen.getByTestId("auth-panel-page");
    expect(page.getAttribute("data-stapel-skin-surface")).toBe("base");
    expect(
      page.querySelector('[data-stapel-skin-surface="raised"]')
    ).not.toBeNull();
    // Unfilled slots are visible to the developer wiring the card chrome.
    expect(document.querySelector('[data-stapel-slot="brand"]')).not.toBeNull();
  });

  it("chrome='bare' paints no page and no card — the zones land in the host's frame", async () => {
    const runtime = serveCapabilities();
    render(wrap(runtime, <AuthPanel mode="light" chrome="bare" />));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined()
    );
    // No page ground of ours...
    expect(screen.queryByTestId("auth-panel-page")).toBeNull();
    // ...no raised card of ours...
    expect(
      document.querySelector('[data-stapel-skin-surface="raised"]')
    ).toBeNull();
    // ...but the theme still applies, unpainted.
    const root = document.querySelector('[data-stapel-skin-root]');
    expect(root?.getAttribute("data-stapel-skin-surface")).toBe("bare");
    expect(root?.getAttribute("data-stapel-skin-mode")).toBe("light");
    // Zones A–D are all present and working.
    expect(screen.getByTestId("auth-panel")).toBeDefined();
    expect(screen.getByText("Sign in")).toBeDefined(); // zone A title
    expect(screen.getByRole("tab", { name: "Phone" })).toBeDefined(); // zone B
    expect(screen.getByTestId("auth-bottom-row")).toBeDefined(); // zone C
    // Zone C's overflow menu (password is an overflow channel here).
    expect(
      screen.getByRole("button", { name: "More ways to sign in" })
    ).toBeDefined();
  });

  it("chrome='bare' renders NO SlotPlaceholder even in a dev build — the host already states its identity", async () => {
    const runtime = serveCapabilities();
    render(wrap(runtime, <AuthPanel mode="light" chrome="bare" />));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Email" })).toBeDefined()
    );
    expect(document.querySelector("[data-stapel-slot]")).toBeNull();
  });

  it("chrome='bare' still renders the brand and legal slots when the host passes them", async () => {
    const runtime = serveCapabilities();
    render(
      wrap(
        runtime,
        <AuthPanel
          mode="light"
          chrome="bare"
          brand={<span data-testid="host-brand">Northgate</span>}
          legal={<span data-testid="host-legal">Terms</span>}
        />
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("host-brand")).toBeDefined()
    );
    expect(screen.getByTestId("host-legal")).toBeDefined();
  });
});
