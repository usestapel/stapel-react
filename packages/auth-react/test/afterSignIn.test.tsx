/**
 * The sign-in panel leaves the sign-in page once a sign-in lands.
 *
 * After an OTP "Verified" the panel stayed on `/login` with nothing to do
 * (Tier-0 e2e D13). The panel now reports the transition to a non-guest
 * session through `onAuthenticated` (or leaves for `?next=` / `/` itself).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import type { AuthRuntime } from "../src/model/runtime.js";
import { AuthProvider } from "../src/headless/AuthProvider.js";
import { registerAuthI18n } from "../src/i18n/keys.js";
import { AuthPanel } from "../src/default/index.js";
import { BASE, authResponse, testUser } from "./helpers.js";
import { vi } from "vitest";

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

describe("<AuthPanel onAuthenticated/>", () => {
  it("fires once when a sign-in lands on the open panel", async () => {
    const runtime = serveCapabilities();
    const onAuthenticated = vi.fn();
    render(wrap(runtime, <AuthPanel mode="light" onAuthenticated={onAuthenticated} />));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Email" })).toBeDefined());
    expect(onAuthenticated).not.toHaveBeenCalled();
    act(() => {
      runtime.session.adopt(authResponse("LOGGED_IN"));
    });
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
  });

  it("does not fire for a guest session", async () => {
    const runtime = serveCapabilities();
    const onAuthenticated = vi.fn();
    render(wrap(runtime, <AuthPanel mode="light" onAuthenticated={onAuthenticated} />));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Email" })).toBeDefined());
    act(() => {
      runtime.session.adopt({
        ...authResponse("LOGGED_IN"),
        user: testUser({ is_anonymous: true }),
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});
