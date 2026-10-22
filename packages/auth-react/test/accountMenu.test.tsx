/**
 * `<AccountMenu/>` — the `auth.account_menu` embed. What a shell relies on:
 * nothing drawn for a visitor, the signed-in identity in the control's name,
 * "Account" only when there is somewhere to open, and sign-out that really
 * ends the session.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import type { AuthRuntime } from "../src/model/runtime.js";
import { AuthProvider } from "../src/headless/AuthProvider.js";
import { registerAuthI18n } from "../src/i18n/keys.js";
import { AccountMenu, accountIdentity } from "../src/default/index.js";
import { navEmbeds } from "../src/nav/manifest.js";
import { BASE, authResponse, testUser } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function wrap(runtime: AuthRuntime, children: ReactNode): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerAuthI18n(i18n);
  return (
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider i18n={i18n}>
        <AuthProvider runtime={runtime}>{children}</AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function signedIn(): AuthRuntime {
  const runtime = createAuthRuntime({ baseUrl: BASE });
  runtime.session.adopt(authResponse("LOGGED_IN"));
  return runtime;
}

async function openMenu(): Promise<void> {
  fireEvent.click(screen.getByTestId("account-menu"));
  await waitFor(() => expect(screen.getByText("Sign out")).toBeDefined());
}

describe("<AccountMenu/>", () => {
  it("draws nothing for a visitor", () => {
    const runtime = createAuthRuntime({ baseUrl: BASE });
    const { container } = render(wrap(runtime, <AccountMenu />));
    expect(container.textContent).toBe("");
    expect(screen.queryByTestId("account-menu")).toBeNull();
  });

  it("names the signed-in account on the control and in the menu", async () => {
    render(wrap(signedIn(), <AccountMenu />));
    expect(screen.getByTestId("account-menu").getAttribute("aria-label")).toBe(
      "Account menu, signed in as a@b.com"
    );
    await openMenu();
    expect(screen.getByText("a@b.com")).toBeDefined();
  });

  it("offers Account only when there is somewhere to open", async () => {
    const onOpen = vi.fn();
    const { unmount } = render(wrap(signedIn(), <AccountMenu />));
    await openMenu();
    expect(screen.queryByText("Account")).toBeNull();
    unmount();

    render(wrap(signedIn(), <AccountMenu onOpen={onOpen} />));
    await openMenu();
    fireEvent.click(screen.getByText("Account"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("signs out: revokes on the server, clears the session, then reports", async () => {
    let revoked = 0;
    server.use(
      http.post(`${BASE}/logout/`, () => {
        revoked += 1;
        return HttpResponse.json({ message: "ok" });
      })
    );
    const runtime = signedIn();
    const onSignedOut = vi.fn();
    render(wrap(runtime, <AccountMenu onSignedOut={onSignedOut} />));
    await openMenu();
    fireEvent.click(screen.getByText("Sign out"));
    await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1));
    expect(revoked).toBe(1);
    expect(runtime.session.getState().status).toBe("anonymous");
    await waitFor(() => expect(screen.queryByTestId("account-menu")).toBeNull());
  });

  it("identity falls back e-mail → phone → username", () => {
    expect(accountIdentity(testUser())).toBe("a@b.com");
    expect(accountIdentity(testUser({ email: null, phone: "+15550100" }))).toBe("+15550100");
    expect(accountIdentity(testUser({ email: null, phone: null }))).toBe("ada");
  });

  it("is declared as a member embed at the trailing edge of the top bar", () => {
    expect(navEmbeds).toEqual([
      {
        id: "auth.account_menu",
        slot: "topbar.end",
        component: { export: "AccountMenu", subpath: "default" },
        order: 90,
        surface: "member",
        opens: "account.root",
      },
    ]);
  });
});
