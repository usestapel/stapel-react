/**
 * `<PasskeysManager/>` (owner directive point 5): list/remove use the
 * existing `usePasskeys`/`useRemovePasskey` hooks; adding uses the existing
 * `PasskeyRegistration` headless flow. THIN WebAuthn (MODULE.md): without a
 * `webauthnCreate` binding, `awaitingCredential` shows guidance copy instead
 * of silently hanging — covered here; the auto-driven path (binding
 * supplied) is covered too.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
import { PasskeysManager } from "../../src/default/security/PasskeysManager.js";
import { BASE } from "../helpers.js";
import type { Passkey } from "../../src/api/types.js";

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

function passkey(overrides: Partial<Passkey> = {}): Passkey {
  return {
    id: "pk1",
    device_name: "MacBook Touch ID",
    aaguid: "aaguid-1",
    transports: ["internal"],
    created_at: "2026-01-01T00:00:00Z",
    last_used_at: null,
    ...overrides,
  };
}

describe("<PasskeysManager/>", () => {
  it("lists passkeys and removes one via confirm", async () => {
    let removed: string | null = null;
    server.use(
      http.get(`${BASE}/passkey/`, () =>
        HttpResponse.json({ passkeys: removed ? [] : [passkey()] })
      ),
      http.delete(`${BASE}/passkey/:id/`, ({ params }) => {
        removed = params["id"] as string;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getByText("MacBook Touch ID")).toBeDefined());

    screen.getByText("Remove").click();
    const confirmButtons = await screen.findAllByRole("button", { name: "Remove" });
    confirmButtons[confirmButtons.length - 1]?.click();

    await waitFor(() => expect(removed).toBe("pk1"));
    await waitFor(() => expect(screen.getByText("No passkeys yet.")).toBeDefined());
  });

  it("shows an empty state when there are none", async () => {
    server.use(http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [] })));
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getByText("No passkeys yet.")).toBeDefined());
  });

  it("add flow (thin, no webauthnCreate): shows guidance instead of hanging on awaitingCredential", async () => {
    server.use(
      http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [] })),
      http.post(`${BASE}/passkey/register/begin/`, () =>
        HttpResponse.json({ options: { challenge: "c1" } })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add a passkey" })).toBeDefined());
    screen.getByRole("button", { name: "Add a passkey" }).click();

    const nameInput = await screen.findByPlaceholderText("e.g. My laptop");
    fireEvent.change(nameInput, { target: { value: "My laptop" } });
    screen.getByRole("button", { name: "Continue" }).click();

    await screen.findByText(
      "Follow your browser or device's prompt to finish adding this passkey."
    );
  });

  it("add flow (webauthnCreate supplied): auto-drives the ceremony end to end", async () => {
    server.use(
      http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [] })),
      http.post(`${BASE}/passkey/register/begin/`, () =>
        HttpResponse.json({ options: { challenge: "c1" } })
      ),
      http.post(`${BASE}/passkey/register/complete/`, () => HttpResponse.json(passkey()))
    );
    const webauthnCreate = vi.fn().mockResolvedValue({ id: "cred1" });
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager webauthnCreate={webauthnCreate} />));
    screen.getByRole("button", { name: "Add a passkey" }).click();
    const nameInput = await screen.findByPlaceholderText("e.g. My laptop");
    fireEvent.change(nameInput, { target: { value: "My laptop" } });
    screen.getByRole("button", { name: "Continue" }).click();

    await waitFor(() => expect(webauthnCreate).toHaveBeenCalledWith({ challenge: "c1" }));
    await screen.findByText("Passkey added.");
  });
});
