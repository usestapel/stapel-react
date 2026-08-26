/**
 * `<VerificationPreferences/>` — the settings half of step-up verification
 * (auth-sa.md §11).
 *
 * The assertion this file exists for is the UNDECIDED row. `GET
 * /verification/preferences/` is sparse: a scope with no row follows a level
 * the client is never told, so the honest render is "nothing selected, and
 * here is what it follows instead". A component that drew a switch in the off
 * position would pass a naive test and lie to a person about a security
 * setting — so the test names the state, not the pixels.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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
import { VerificationPreferences } from "../../src/default/security/VerificationPreferences.js";
import { BASE } from "../helpers.js";

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

/** The two options of one row, in DOM order. antd renders a radio group as
 *  labelled inputs, so the checked state is readable without touching a
 *  class name. */
function optionsOf(row: HTMLElement): HTMLInputElement[] {
  return [...row.querySelectorAll("input[type='radio']")] as HTMLInputElement[];
}

describe("<VerificationPreferences/>", () => {
  it("a scope with NO row is undecided: nothing selected, and it says what it follows", async () => {
    server.use(
      http.get(`${BASE}/verification/preferences/`, () =>
        HttpResponse.json({ preferences: [] })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <VerificationPreferences />));

    const row = await screen.findByTestId("verify-scope-row");
    // NOT "off": the endpoint's own level is unknown to the client, so an
    // off-looking control would be a confident answer nobody has.
    expect(optionsOf(row).some((input) => input.checked)).toBe(false);
    expect(screen.getByTestId("verify-scope-default").textContent).toContain(
      "Follows this app's default"
    );
  });

  it("a scope WITH a row carries its decision", async () => {
    server.use(
      http.get(`${BASE}/verification/preferences/`, () =>
        HttpResponse.json({
          preferences: [{ scope: "verification.settings", enabled: true }],
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <VerificationPreferences />));

    const row = await screen.findByTestId("verify-scope-row");
    await waitFor(() => expect(optionsOf(row)[0]?.checked).toBe(true));
    expect(screen.queryByTestId("verify-scope-default")).toBeNull();
  });

  it("says switching a scope OFF needs proof BEFORE the press, not after the 403", async () => {
    server.use(
      http.get(`${BASE}/verification/preferences/`, () =>
        HttpResponse.json({ preferences: [] })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <VerificationPreferences />));

    const note = await screen.findByTestId("verify-disable-note");
    expect(note.textContent).toContain("confirm it's you first");
  });

  it("choosing a decision writes it and re-reads the list", async () => {
    let written: unknown = null;
    let reads = 0;
    server.use(
      http.get(`${BASE}/verification/preferences/`, () => {
        reads += 1;
        return HttpResponse.json({
          preferences: written === null ? [] : [written],
        });
      }),
      http.put(`${BASE}/verification/preferences/`, async ({ request }) => {
        written = await request.json();
        return HttpResponse.json(written);
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <VerificationPreferences />));

    const row = await screen.findByTestId("verify-scope-row");
    optionsOf(row)[0]?.click();

    await waitFor(() =>
      expect(written).toEqual({ scope: "verification.settings", enabled: true })
    );
    await waitFor(() => expect(reads).toBeGreaterThan(1));
  });

  it("host scopes join the declared ones, and the server's rows are never dropped", async () => {
    server.use(
      http.get(`${BASE}/verification/preferences/`, () =>
        HttpResponse.json({
          preferences: [{ scope: "wallet.withdraw", enabled: false }],
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <VerificationPreferences />));

    // Declared by the component's default + returned by the server = two rows,
    // even though only one of them has a decision.
    await waitFor(() =>
      expect(screen.getAllByTestId("verify-scope-row")).toHaveLength(2)
    );
    expect(screen.getByTestId("verify-scope-wallet.withdraw")).toBeDefined();
  });

  it("a failed read is STATED — never an empty set of choices", async () => {
    server.use(
      http.get(`${BASE}/verification/preferences/`, () =>
        HttpResponse.json(
          { localizable_error: "stapel.http.500" },
          { status: 500 }
        )
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <VerificationPreferences />));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.queryByTestId("verify-scope-row")).toBeNull();
  });
});
