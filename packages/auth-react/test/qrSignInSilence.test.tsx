/**
 * The sign-in QR channel must never fail quietly.
 *
 * `QrPanel` mapped every failure onto antd's `<QRCode status="expired">` and
 * nothing else — no message, no code, no retry. A refused generate (or a
 * refused poll: `error.403.qr_device_mismatch` is returned to any device that
 * polls a key it did not mint) therefore rendered as a slightly greyed square
 * that looks exactly like a code that simply aged out, while the console
 * stayed empty. Its sibling `QrDeviceLinkPanel` has always stated its errors;
 * this is the same rule applied to the surface people actually sign in on.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import type { AuthRuntime } from "../src/model/runtime.js";
import { AuthProvider } from "../src/headless/AuthProvider.js";
import { registerAuthI18n } from "../src/i18n/keys.js";
import { AuthPanel } from "../src/default/index.js";
import { BASE } from "./helpers.js";

// The session's own cold-start bootstrap probe fires on mount; answer it
// once here (initial handlers survive `resetHandlers`) so it is not noise.
const server = setupServer(
  http.get(`${BASE}/token/refresh/`, () =>
    HttpResponse.json({ localizable_error: "error.401.unauthorized" }, { status: 401 })
  )
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

const QR_ONLY_CAPS = {
  registration: {
    phone: false,
    email: false,
    password: false,
    oauth: [],
    sso: false,
    anonymous: false,
  },
  login: {
    phone: false,
    email: false,
    password: false,
    oauth: [],
    sso: false,
    qr: true,
    passkey: false,
    magic_link: false,
  },
  methods: [
    {
      id: "qr",
      enabled: true,
      placement: "main",
      order: 0,
      interaction: "inline",
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

describe("sign-in QR channel — a refusal is visible", () => {
  it("states why the code could not be minted, and offers a retry", async () => {
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(QR_ONLY_CAPS)),
      http.post(`${BASE}/qr/generate/`, () =>
        HttpResponse.json(
          { localizable_error: "error.404.qr_not_found", error: "no" },
          { status: 404 }
        )
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").not.toBe("");
    expect(await screen.findByRole("button", { name: "Try again" })).toBeDefined();
  });
});
