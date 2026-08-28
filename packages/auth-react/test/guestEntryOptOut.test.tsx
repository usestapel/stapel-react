/**
 * The guest button, and the deployment that must not draw one.
 *
 * `<AuthPanel variant="login">` offers "Continue as a guest" whenever the
 * backend reports `registration.anonymous`. That is right for a host where
 * guest entry is a CHOICE somebody makes on the sign-in screen.
 *
 * It is wrong for a host that mints guest accounts automatically. There the
 * account appears when the person saves a listing or writes to a seller, and
 * a button on the sign-in screen does something worse than nothing: it mints
 * a session and leaves them exactly where they were, because a guest is not
 * a member and no part of the sign-in screen changes for one. That silent
 * press is precisely why one deployment closed `AUTH_ANONYMOUS` rather than
 * fix the panel — the capability was fine, the manual control was not.
 *
 * So the capability and the control are separated: the server keeps saying
 * guest accounts exist, and the host says whether they are obtained by
 * pressing this.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
// The cold-load refresh probe fires on every mount; answer it "no session"
// so the log carries only what a test is asserting on.
beforeEach(() =>
  server.use(
    http.get(`${BASE}/token/refresh/`, () =>
      HttpResponse.json({ localizable_error: "error.401.unauthorized" }, { status: 401 })
    )
  )
);
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** The one capability shape this file is about: guests are offered. */
const GUESTS_ALLOWED = {
  registration: {
    phone: false,
    email: true,
    password: false,
    oauth: [],
    sso: false,
    anonymous: true,
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
  methods: [
    {
      id: "email",
      enabled: true,
      placement: "main" as const,
      order: 0,
      interaction: "inline" as const,
      icon_svg: "",
    },
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

function serveCapabilities(): void {
  server.use(
    http.get(`${BASE}/capabilities/`, () => HttpResponse.json(GUESTS_ALLOWED))
  );
}

describe("<AuthPanel showGuestEntry>", () => {
  it("draws the guest button by default when the server allows guests", async () => {
    serveCapabilities();
    render(wrap(createAuthRuntime({ baseUrl: BASE }), <AuthPanel variant="login" />));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send code" })).toBeDefined()
    );
    expect(screen.getByRole("button", { name: /guest/i })).toBeDefined();
  });

  it("drops it for a host that mints guests automatically", async () => {
    serveCapabilities();
    render(
      wrap(
        createAuthRuntime({ baseUrl: BASE }),
        <AuthPanel variant="login" showGuestEntry={false} />
      )
    );
    // The screen still works — this is an opt-out of ONE control, not of the
    // sign-in surface.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send code" })).toBeDefined()
    );
    expect(screen.queryByRole("button", { name: /guest/i })).toBeNull();
  });

  it("still has no guest button when the server does not allow guests", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () =>
        HttpResponse.json({
          ...GUESTS_ALLOWED,
          registration: { ...GUESTS_ALLOWED.registration, anonymous: false },
        })
      )
    );
    render(wrap(createAuthRuntime({ baseUrl: BASE }), <AuthPanel variant="login" />));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send code" })).toBeDefined()
    );
    expect(screen.queryByRole("button", { name: /guest/i })).toBeNull();
  });

  it("never draws it on the registration surface, opted out or not", async () => {
    serveCapabilities();
    render(
      wrap(createAuthRuntime({ baseUrl: BASE }), <AuthPanel variant="register" />)
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /guest/i })).toBeNull()
    );
  });
});
