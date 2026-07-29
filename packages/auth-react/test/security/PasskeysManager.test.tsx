/**
 * `<PasskeysManager/>` (owner directive point 5): list/remove use the
 * existing `usePasskeys`/`useRemovePasskey` hooks; adding uses the existing
 * `PasskeyRegistration` headless flow. WebAuthn (MODULE.md "WebAuthn
 * binding"): the ceremony runs on the pair's built-in browser binding, an
 * injected `webauthnCreate` overrides it, and in an environment with no
 * WebAuthn API (jsdom here, an old browser in the wild) `awaitingCredential`
 * shows the honest unsupported copy instead of silently hanging — all three
 * covered here.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

  /**
   * Owner UX audit 2026-07-17 (interaction canon, frontend-guidelines.md
   * §8): passkey = direct trigger, never a modal or a name-entry dialog —
   * the browser's own WebAuthn prompt IS the UI. Clicking "Add a passkey"
   * begins the ceremony immediately.
   */
  it("add flow (no WebAuthn API here): the button directly begins the ceremony — no dialog, no name prompt", async () => {
    let beginCalls = 0;
    server.use(
      http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [] })),
      http.post(`${BASE}/passkey/register/begin/`, () => {
        beginCalls += 1;
        return HttpResponse.json({ options: { challenge: "c1" } });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add a passkey" })).toBeDefined());
    screen.getByRole("button", { name: "Add a passkey" }).click();

    // No name-entry dialog anywhere — straight to the ceremony.
    expect(screen.queryByPlaceholderText("e.g. My laptop")).toBeNull();
    // jsdom has no `navigator.credentials`: the default binding cannot run,
    // so the panel says so rather than pointing at a prompt that will never
    // appear (the begin call still happened — the flow is parked, not dead).
    await screen.findByText(
      "This browser can't use passkeys. Try another browser or device, or pick a different method."
    );
    expect(beginCalls).toBe(1);
  });

  /**
   * The ordinary browser: nothing injected, the pair's own binding drives
   * `navigator.credentials.create()` and the ceremony finishes. This is the
   * case that used to hang forever in every host that did not write a
   * binding (the closed "Thin-WebAuthn TODO").
   */
  it("add flow (default binding): a real navigator.credentials completes it with nothing injected", async () => {
    server.use(
      http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [] })),
      http.post(`${BASE}/passkey/register/begin/`, () =>
        HttpResponse.json({
          options: { challenge: "AQID", user: { id: "BAUG", name: "ada", displayName: "Ada" } },
        })
      ),
      http.post(`${BASE}/passkey/register/complete/`, () => HttpResponse.json(passkey()))
    );
    const create = vi.fn().mockResolvedValue({
      id: "cred-id",
      rawId: new Uint8Array([1, 2, 3]).buffer,
      type: "public-key",
      response: {
        clientDataJSON: new Uint8Array([4, 5]).buffer,
        attestationObject: new Uint8Array([6, 7]).buffer,
      },
    });
    Object.defineProperty(navigator, "credentials", {
      value: { create, get: vi.fn() },
      configurable: true,
      writable: true,
    });
    (globalThis as Record<string, unknown>)["PublicKeyCredential"] = {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
    };
    try {
      const runtime = createAuthRuntime({ baseUrl: BASE });
      render(wrap(runtime, <PasskeysManager />));
      screen.getByRole("button", { name: "Add a passkey" }).click();

      await screen.findByText("Passkey added.");
      const options = create.mock.calls[0]?.[0] as { publicKey: Record<string, unknown> };
      // Decoded on the way in — the browser gets buffers, not base64url.
      expect(new Uint8Array(options.publicKey["challenge"] as ArrayBuffer)).toEqual(
        new Uint8Array([1, 2, 3])
      );
    } finally {
      Reflect.deleteProperty(navigator, "credentials");
      Reflect.deleteProperty(globalThis as Record<string, unknown>, "PublicKeyCredential");
    }
  });

  it("add flow (webauthnCreate supplied): auto-drives the ceremony end to end, direct-triggered", async () => {
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

    await waitFor(() => expect(webauthnCreate).toHaveBeenCalledWith({ challenge: "c1" }));
    await screen.findByText("Passkey added.");
  });
});
