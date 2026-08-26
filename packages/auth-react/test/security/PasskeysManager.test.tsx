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
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { CONFIRM_OK_TESTID } from "@stapel/tokens-antd/skin";
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
    // The confirm is a `SkinDialog` (a bottom sheet on a phone, a modal above
    // the tablet breakpoint) rather than a `Popconfirm`: a popover anchored to
    // a small link button renders off-viewport on a phone, and this Ok deletes
    // a sign-in credential permanently. Scoped to the dialog by test id —
    // `findAllByRole("button", {name: "Remove"})` resolves on the ROW's button
    // the instant it exists and would never wait for the dialog at all.
    await screen.findByTestId("passkey-remove-confirm");
    screen.getByTestId(CONFIRM_OK_TESTID).click();

    await waitFor(() => expect(removed).toBe("pk1"));
    await waitFor(() => expect(screen.getByText("No passkeys yet.")).toBeDefined());
  });

  /**
   * Owner report 2026-08-24: the screen showed "a name plus a green LOG IN
   * button" to a person who is by definition already logged in. A row about a
   * stored credential has to answer what it is, when it arrived, whether it is
   * in use, and what can be done to it — and none of those answers is "sign
   * in".
   */
  it("the row says WHAT the credential is, when it arrived and whether it is in use", async () => {
    server.use(
      http.get(`${BASE}/passkey/`, () =>
        HttpResponse.json({
          passkeys: [
            passkey({ id: "a", device_name: "MacBook Touch ID", transports: ["internal"] }),
            passkey({
              id: "b",
              device_name: "YubiKey 5",
              transports: ["usb", "nfc"],
              last_used_at: "2026-02-03T00:00:00Z",
            }),
          ],
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getAllByTestId("passkey-row")).toHaveLength(2));

    const kinds = screen.getAllByTestId("passkey-kind").map((n) => n.textContent);
    expect(kinds).toEqual(["Built into a device", "Security key"]);

    const used = screen.getAllByTestId("passkey-last-used").map((n) => n.textContent);
    // "Never used" is a real fact about a credential, and the way a person
    // spots the key they enrolled and then lost. Saying nothing said nothing.
    expect(used[0]).toBe("Not used yet");
    expect(used[1]).toContain("Last used");

    expect(screen.getAllByText(/^Added /)).toHaveLength(2);
  });

  it("offers NO sign-in action anywhere on the screen", async () => {
    server.use(http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [passkey()] })));
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getByTestId("passkey-row")).toBeDefined());
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Log in" })).toBeNull();
  });

  it("finishing an add ends in Done, never in the sign-in button's copy", async () => {
    server.use(
      http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [] })),
      http.post(`${BASE}/passkey/register/begin/`, () =>
        HttpResponse.json({ options: { challenge: "AQID" } })
      ),
      http.post(`${BASE}/passkey/register/complete/`, () => HttpResponse.json(passkey()))
    );
    const create = vi.fn().mockResolvedValue({ id: "c", type: "public-key" });
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager webauthnCreate={create} />));
    (await screen.findByRole("button", { name: "Add a passkey" })).click();
    await screen.findByText("Passkey added.");
    expect(screen.getByRole("button", { name: "Done" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("the add label becomes 'Add another' once one exists", async () => {
    server.use(http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [passkey()] })));
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager webauthnCreate={vi.fn()} />));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add another" })).toBeDefined());
  });

  it("removal confirms in the fleet's dialog — a bottom SHEET on a phone", async () => {
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    server.use(http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [passkey()] })));
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getByTestId("passkey-row")).toBeDefined());
    screen.getByText("Remove").click();
    const dialog = await screen.findByTestId("passkey-remove-confirm");
    expect(dialog.dataset["stapelDialogSurface"]).toBe("sheet");
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
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
  it("no WebAuthn API here: Add is BLOCKED with its reason on screen, and starts nothing", async () => {
    // Owner sweep 2026-08-24, defect class (a): this used to be an ENABLED
    // button that ran a `begin` round trip and then parked forever on
    // `awaitingCredential`, spending the "this browser cannot" knowledge only
    // AFTER the click. The screen has that fact before the click, so it says
    // it before the click — as text beside the control, never as a tooltip on
    // a disabled button, which on a touch screen nobody can read.
    let beginCalls = 0;
    server.use(
      http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [] })),
      http.post(`${BASE}/passkey/register/begin/`, () => {
        beginCalls += 1;
        return HttpResponse.json({ options: { challenge: "c1" } });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    const { container } = render(wrap(runtime, <PasskeysManager />));
    const add = await screen.findByRole("button", { name: "Add a passkey" });
    expect(add.hasAttribute("disabled")).toBe(true);
    // The reason is rendered BESIDE the control by the shared `GatedButton`,
    // with `aria-describedby` pointing at it — not in a tooltip a disabled
    // button can never raise. `data-stapel-gated-reason` is the substrate's
    // stated handle for it.
    const reason = container.querySelector("[data-stapel-gated-reason]");
    expect(reason?.textContent).toBe(
      "This browser can't create passkeys. Open this page in another browser to add one."
    );
    add.click();
    // No name-entry dialog anywhere, and no ceremony either.
    expect(screen.queryByPlaceholderText("e.g. My laptop")).toBeNull();
    expect(beginCalls).toBe(0);
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

/**
 * THE INCIDENT, on the security screen (2026-08-09): a list read that failed
 * used to flatten to `[]` and render "No passkeys yet." — telling a person
 * their account has no second factor when the truth was that nobody could
 * ask. The three states are now three distinct renders, and the failed one
 * must never wear the empty one's sentence.
 */
describe("<PasskeysManager/> — loading vs empty vs failed", () => {
  it("while the read is in flight: a spinner, and no empty copy", async () => {
    server.use(
      http.get(`${BASE}/passkey/`, async () => {
        await delay("infinite");
        return HttpResponse.json({ passkeys: [] });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    const { container } = render(wrap(runtime, <PasskeysManager />));

    // The loading arm is the substrate's, stamped `data-stapel-load-state` —
    // a skeleton rather than a spinner, so the card does not jump height when
    // the rows arrive.
    await waitFor(() =>
      expect(container.querySelector('[data-stapel-load-state="loading"]')).not.toBeNull()
    );
    expect(screen.queryByText("No passkeys yet.")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("loaded and genuinely empty: the empty copy, and no alert", async () => {
    server.use(http.get(`${BASE}/passkey/`, () => HttpResponse.json({ passkeys: [] })));
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));

    await waitFor(() => expect(screen.getByText("No passkeys yet.")).toBeDefined());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("failed read: the failure is stated with a retry — NEVER 'No passkeys yet.'", async () => {
    server.use(
      http.get(`${BASE}/passkey/`, () =>
        HttpResponse.json({ code: "error.500.internal", message: "boom" }, { status: 500 })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.queryByText("No passkeys yet.")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("retry re-asks, and the rows appear once the read succeeds", async () => {
    let fail = true;
    server.use(
      http.get(`${BASE}/passkey/`, () =>
        fail
          ? HttpResponse.json({ code: "error.500.internal", message: "boom" }, { status: 500 })
          : HttpResponse.json({ passkeys: [passkey()] })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());

    fail = false;
    screen.getByRole("button", { name: "Try again" }).click();

    await waitFor(() => expect(screen.getByText("MacBook Touch ID")).toBeDefined());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/**
 * `PATCH /passkey/{id}/` — stapel-auth 0.28.0. `device_name` used to be
 * writable exactly once, at register-complete, so the row offered no rename
 * at all rather than a control that answers 405. These tests pin the three
 * facts that changed: the affordance exists, it sends the rename the contract
 * describes, and a 404 is read as "this row is stale", never as a permission
 * problem — the backend scopes by an ownership LOOKUP, so a stranger's id and
 * a deleted id are byte-identical answers.
 */
describe("<PasskeysManager/> — renaming a credential", () => {
  it("renames through PATCH /passkey/:id/ and shows the new label", async () => {
    let name = "MacBook Touch ID";
    let patched: unknown = null;
    server.use(
      http.get(`${BASE}/passkey/`, () =>
        HttpResponse.json({ passkeys: [passkey({ device_name: name })] })
      ),
      http.patch(`${BASE}/passkey/:id/`, async ({ request }) => {
        patched = await request.json();
        name = (patched as { device_name: string }).device_name;
        return HttpResponse.json(passkey({ device_name: name }));
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getByText("MacBook Touch ID")).toBeDefined());

    // The row's control NAMES the credential it acts on: a list of buttons all
    // called "Rename" is a list a screen-reader user cannot navigate.
    screen.getByRole("button", { name: "Rename MacBook Touch ID" }).click();
    const dialog = await screen.findByTestId("passkey-rename-dialog");
    const field = dialog.querySelector("input") as HTMLInputElement;
    // The dialog opens ON the current name — a rename box that starts empty
    // makes the person retype what they are only editing.
    expect(field.value).toBe("MacBook Touch ID");
    fireEvent.change(field, { target: { value: "Work laptop" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);

    await waitFor(() => expect(patched).toEqual({ device_name: "Work laptop" }));
    await waitFor(() => expect(screen.getByText("Work laptop")).toBeDefined());
  });

  it("a 404 says the credential is GONE and refetches — never 'you may not'", async () => {
    let reads = 0;
    server.use(
      http.get(`${BASE}/passkey/`, () => {
        reads += 1;
        return HttpResponse.json({ passkeys: reads > 1 ? [] : [passkey()] });
      }),
      http.patch(`${BASE}/passkey/:id/`, () =>
        HttpResponse.json(
          { localizable_error: "error.404.passkey_not_found" },
          { status: 404 }
        )
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PasskeysManager />));
    await waitFor(() => expect(screen.getByText("MacBook Touch ID")).toBeDefined());

    screen.getByRole("button", { name: "Rename MacBook Touch ID" }).click();
    const dialog = await screen.findByTestId("passkey-rename-dialog");
    const field = dialog.querySelector("input") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "Anything" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);

    const gone = await screen.findByTestId("passkey-gone");
    expect(gone.textContent).toContain("no longer on your account");
    // The stale row is not left on screen offering actions against something
    // that is not there: the list is re-read.
    await waitFor(() => expect(reads).toBeGreaterThan(1));
  });
});
