/**
 * The passkey flow is inverted — the SYSTEM prompt is the first screen.
 *
 * Owner ruling, 2026-08-24: clicking "passkey" used to open OUR dialog, which
 * contained a "Use a passkey" button, which raised the browser's prompt. Two
 * screens of ours in front of the one screen that decides anything, on neither
 * of which the person had a choice to make. Now the ceremony starts on the
 * click and this skin renders nothing until it has an outcome — and then only
 * if the outcome was not a sign-in.
 *
 * The failure paths are five, not one. A `navigator.credentials` rejection is
 * a `DOMException`, which is not a `StapelApiError`, so the generic fold
 * collapsed cancelled / no-credential / timed-out / insecure / refused into
 * "Something went wrong. Please try again." — advice that is wrong for four of
 * them and actively misleading for the most common.
 *
 * Everything is driven at the real seams: MSW for the wire, and a
 * `navigator.credentials` that rejects the way a browser does. Nothing here
 * hand-builds the value the code catches.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
  setViewport(1024);
});
afterAll(() => server.close());

function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

function method(id: string, placement: "main" | "bottom" | "overflow", order: number) {
  return {
    id,
    enabled: true,
    placement,
    order,
    interaction: placement === "main" ? "inline" : "modal",
    icon_svg: "",
  };
}

const CAPABILITIES = {
  registration: { phone: false, email: true, password: false, oauth: [], sso: false, anonymous: false },
  login: {
    phone: false,
    email: true,
    password: true,
    oauth: [],
    sso: false,
    qr: false,
    passkey: true,
    magic_link: false,
  },
  methods: [method("email", "main", 0), method("passkey", "bottom", 0), method("password", "overflow", 0)],
};

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

/** A `navigator.credentials` that behaves like a browser's: `get()` settles
 * however the test says, and its mere presence is what
 * `isWebauthnSupported()` reads. */
function installCredentials(get: () => Promise<unknown>): { calls: () => number } {
  let calls = 0;
  vi.stubGlobal("PublicKeyCredential", class {});
  vi.stubGlobal("navigator", {
    ...window.navigator,
    credentials: {
      create: () => Promise.reject(new Error("not used here")),
      get: () => {
        calls += 1;
        return get();
      },
    },
  });
  return { calls: () => calls };
}

/** A DOMException the way the platform throws one. `name` is the part the
 * spec defines and the part the classifier reads. */
function domException(name: string): unknown {
  const error = new Error(name);
  Object.defineProperty(error, "name", { value: name });
  return error;
}

async function renderPanel(): Promise<HTMLElement> {
  server.use(http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPABILITIES)));
  const runtime = createAuthRuntime({ baseUrl: BASE });
  render(wrap(runtime, <AuthPanel mode="light" />));
  return await screen.findByRole("button", { name: "Passkey" });
}

beforeEach(() => {
  setViewport(1024);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clicking passkey raises the system prompt, not a dialog", () => {
  it("calls navigator.credentials.get() on the click, and opens NOTHING of ours", async () => {
    let beginCalls = 0;
    server.use(
      http.post(`${BASE}/passkey/authenticate/begin/`, () => {
        beginCalls += 1;
        return HttpResponse.json({ session_key: "sk1", options: { challenge: "AQID" } });
      })
    );
    // A prompt that never settles: the state a person is in while the OS
    // sheet is up, and the state the old flow spent behind a modal of ours.
    const credentials = installCredentials(() => new Promise(() => undefined));

    const button = await renderPanel();
    button.click();

    await waitFor(() => {
      expect(credentials.calls()).toBe(1);
    });
    expect(beginCalls).toBe(1);
    // No sheet, no modal, no panel — the browser owns the screen right now.
    expect(screen.queryByTestId("auth-passkey-fallback")).toBeNull();
    expect(screen.queryByTestId("auth-channel-dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Use a passkey" })).toBeNull();
  });

  it("shows the fallback ONLY once the ceremony has failed", async () => {
    server.use(
      http.post(`${BASE}/passkey/authenticate/begin/`, () =>
        HttpResponse.json({ session_key: "sk1", options: { challenge: "AQID" } })
      )
    );
    installCredentials(() => Promise.reject(domException("NotAllowedError")));

    const button = await renderPanel();
    expect(screen.queryByTestId("auth-passkey-fallback-body")).toBeNull();
    button.click();
    await screen.findByTestId("auth-passkey-fallback-body");
  });
});

describe("the five outcomes are five outcomes", () => {
  async function failWith(name: string): Promise<HTMLElement> {
    server.use(
      http.post(`${BASE}/passkey/authenticate/begin/`, () =>
        HttpResponse.json({ session_key: "sk1", options: { challenge: "AQID" } })
      )
    );
    installCredentials(() => Promise.reject(domException(name)));
    const button = await renderPanel();
    button.click();
    return await screen.findByTestId("auth-passkey-fallback-body");
  }

  it("cancelled-or-no-credential says BOTH, and does not offer a pointless retry", async () => {
    // WebAuthn refuses to separate "dismissed" from "no credential here" —
    // reporting the difference would make the prompt an oracle for whether an
    // account exists on this device. So the copy says both, and the primary
    // action is the OTHER methods: telling someone with no passkey to "try
    // again" is telling them to repeat what cannot work.
    const body = await failWith("NotAllowedError");
    expect(body.textContent).toContain("this device has no passkey for us yet");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Use another method" })).toBeDefined();
  });

  it("a timeout says so, and DOES offer a retry", async () => {
    const body = await failWith("AbortError");
    expect(body.textContent).toContain("timed out");
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("an insecure origin says what is actually wrong, with nothing to retry", async () => {
    const body = await failWith("SecurityError");
    expect(body.textContent).toContain("secure connection");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("an authenticator that refused is retryable and says its own sentence", async () => {
    const body = await failWith("UnknownError");
    expect(body.textContent).toContain("could not complete the passkey check");
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("a browser with no WebAuthn never starts a ceremony at all", async () => {
    // The old shape ran a `begin` round trip and then parked on
    // `awaitingAssertion` behind a spinner, waiting for a prompt that this
    // browser will never raise.
    let beginCalls = 0;
    server.use(
      http.post(`${BASE}/passkey/authenticate/begin/`, () => {
        beginCalls += 1;
        return HttpResponse.json({ session_key: "sk1", options: {} });
      })
    );
    const button = await renderPanel();
    button.click();
    const body = await screen.findByTestId("auth-passkey-fallback-body");
    expect(body.textContent).toContain("This browser can't use passkeys");
    expect(beginCalls).toBe(0);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("none of them is the generic fallback sentence", async () => {
    for (const name of ["NotAllowedError", "AbortError", "SecurityError", "UnknownError"]) {
      const body = await failWith(name);
      expect(body.textContent, name).not.toContain("Something went wrong");
      cleanup();
      server.resetHandlers();
      vi.unstubAllGlobals();
    }
  });
});

describe("the dialogs inherit the fleet's surface rule", () => {
  it("the alt-method dialog is a bottom SHEET on a phone", async () => {
    setViewport(390);
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPABILITIES))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    // `password` is an overflow channel — it opens the shared dialog.
    const more = await screen.findByText("More ways to sign in");
    more.click();
    const item = await screen.findByRole("menuitem", { name: "Password" });
    item.click();
    const dialog = await screen.findByTestId("auth-channel-dialog");
    expect(dialog.dataset["stapelDialogSurface"]).toBe("sheet");
  });

  it("…and a centred modal on a desktop", async () => {
    setViewport(1280);
    server.use(
      http.get(`${BASE}/capabilities/`, () => HttpResponse.json(CAPABILITIES))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuthPanel mode="light" />));
    const more = await screen.findByText("More ways to sign in");
    more.click();
    const item = await screen.findByRole("menuitem", { name: "Password" });
    item.click();
    const dialog = await screen.findByTestId("auth-channel-dialog");
    expect(dialog.dataset["stapelDialogSurface"]).toBe("modal");
  });

  it("the passkey fallback is a sheet on a phone too", async () => {
    setViewport(390);
    server.use(
      http.post(`${BASE}/passkey/authenticate/begin/`, () =>
        HttpResponse.json({ session_key: "sk1", options: { challenge: "AQID" } })
      )
    );
    installCredentials(() => Promise.reject(domException("NotAllowedError")));
    const button = await renderPanel();
    button.click();
    const dialog = await screen.findByTestId("auth-passkey-fallback");
    expect(dialog.dataset["stapelDialogSurface"]).toBe("sheet");
    // …and a sheet has a keyboard-reachable way out, not only a swipe.
    expect(screen.getByTestId("stapel-sheet-handle").tagName).toBe("BUTTON");
  });
});
