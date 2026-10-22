/**
 * Every field id on the sign-in panel is unique in the document.
 *
 * antd derives a field's DOM id from `<form name>_<field name>`, and a form
 * with no name gives the bare field name. The email and phone tabs are the
 * same `OtpPanel` with a field named `value`, so once both panes had been
 * shown the page carried two `id="value"` inputs (found by the SPA e2e):
 * a label's `for`, autofill and `getElementById` could reach the wrong tab.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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
import { AuthPanel } from "../src/default/index.js";
import { BASE } from "./helpers.js";

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

describe("<AuthPanel/> field ids", () => {
  it("the email and phone tabs do not share an input id", async () => {
    const runtime = serveCapabilities();
    render(wrap(runtime, <AuthPanel mode="light" />));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Phone" })).toBeDefined()
    );
    fireEvent.click(screen.getByRole("tab", { name: "Phone" }));
    await waitFor(() =>
      expect(document.querySelectorAll("form input").length).toBeGreaterThanOrEqual(2)
    );
    const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(repeated).toEqual([]);
    expect(document.getElementById("value")).toBeNull();
  });
});
