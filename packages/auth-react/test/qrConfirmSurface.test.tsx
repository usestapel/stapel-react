/**
 * THE OTHER HALF OF THE `login_request` QR DANCE.
 *
 * The pair renders a `login_request` QR on the sign-in screen (`QrPanel`),
 * and stapel-auth's `/qr/{key}/scan/` redirects a signed-in scanner to
 * **`/qr-confirm?key=…`** — a front-end route the pair never shipped, never
 * listed in its nav manifest and never documented. Every host therefore
 * resolved it through its own catch-all: the phone landed on the home page,
 * `POST /qr/{key}/confirm/` was never called, and the desktop polled a key
 * nobody would ever fulfil. Nothing was logged anywhere, on either device.
 *
 * These tests hold the two halves of the closure: the confirm surface itself
 * (this file's subject) and the nav entry that tells a host to mount it.
 * The sign-in panel's own silence is covered in `qrSignInSilence.test.tsx`.
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
import { QrConfirmPanel } from "../src/default/index.js";
import { navEntries } from "../src/nav/manifest.js";
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

describe("<QrConfirmPanel/> — the scanner's confirmation screen", () => {
  it("approving posts the confirm and says the other device is in", async () => {
    const confirmed: string[] = [];
    server.use(
      http.post(`${BASE}/qr/:key/confirm/`, ({ params }) => {
        confirmed.push(String(params["key"]));
        return HttpResponse.json({ status: "confirmed" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrConfirmPanel qrKey="qr_1" />));

    const approve = await screen.findByRole("button", {
      name: "Yes, sign me in there",
    });
    approve.click();

    await screen.findByText("That device is now signed in. You can put this one down.");
    expect(confirmed).toEqual(["qr_1"]);
  });

  it("declining posts the reject — the waiting device is told, not left hanging", async () => {
    const rejected: string[] = [];
    server.use(
      http.post(`${BASE}/qr/:key/reject/`, ({ params }) => {
        rejected.push(String(params["key"]));
        return HttpResponse.json({ status: "rejected" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrConfirmPanel qrKey="qr_2" />));

    (await screen.findByRole("button", { name: "No, that wasn't me" })).click();

    await screen.findByText("Sign-in declined. Nothing was shared.");
    expect(rejected).toEqual(["qr_2"]);
  });

  it("a refused confirm states the reason — never a screen that just stops", async () => {
    server.use(
      http.post(`${BASE}/qr/:key/confirm/`, () =>
        HttpResponse.json(
          { localizable_error: "error.404.qr_not_found", error: "gone" },
          { status: 404 }
        )
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrConfirmPanel qrKey="qr_3" />));

    (await screen.findByRole("button", { name: "Yes, sign me in there" })).click();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent ?? "").not.toBe("")
    );
  });

  it("no key in the address is a stated problem, not a blank confirm screen", async () => {
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <QrConfirmPanel qrKey={null} />));

    await screen.findByText(
      "This link has no sign-in code in it. Scan the QR code again."
    );
    expect(
      screen.queryByRole("button", { name: "Yes, sign me in there" })
    ).toBeNull();
  });
});

describe("nav manifest — the host is told the route exists", () => {
  it("declares /qr-confirm, the path stapel-auth's scan redirect hardcodes", () => {
    const entry = navEntries.find((e) => e.id === "auth.qr_confirm");
    expect(entry).toBeDefined();
    expect(entry?.route.path).toBe("/qr-confirm");
    // The scanner is signed in by definition (an anonymous scan is bounced to
    // sign-in by the backend), but the route must not be behind the host's
    // auth gate redirect either — it is reached by a camera, cold.
    expect(entry?.menuVisibleDefault).toBe(false);
  });
});
