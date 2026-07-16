/**
 * `<SessionsList/>` (owner directive point 5, security-profile components):
 * built entirely on the EXISTING useSessions/useRevokeSession/
 * useRevokeOtherSessions/useConfirmSession hooks — no new backend surface,
 * so this is pure UI-shape coverage over a real, already-tested data layer.
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
import { SessionsList } from "../../src/default/security/SessionsList.js";
import { BASE } from "../helpers.js";
import type { AuthSession } from "../../src/api/types.js";

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

function session(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    id: "s1",
    device_type: "desktop",
    device_name: "Chrome on macOS",
    device_details: "",
    ip_address: "1.2.3.4",
    created_at: "2026-01-01T00:00:00Z",
    last_used_at: "2026-01-01T00:00:00Z",
    is_current: false,
    is_suspicious: false,
    ...overrides,
  };
}

describe("<SessionsList/>", () => {
  it("renders the current device and an other device, with revoke actions only on the other one", async () => {
    server.use(
      http.get(`${BASE}/sessions/`, () =>
        HttpResponse.json([
          session({ id: "cur", is_current: true, device_name: "This Mac" }),
          session({ id: "other", device_name: "Someone's Phone", device_type: "phone" }),
        ])
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SessionsList />));

    await waitFor(() => expect(screen.getByText("This Mac")).toBeDefined());
    expect(screen.getByText("Someone's Phone")).toBeDefined();
    expect(screen.getByText("This device")).toBeDefined();
    // Only the other session gets a "Sign out" action.
    expect(screen.getAllByText("Sign out")).toHaveLength(1);
  });

  it("shows a suspicious badge + 'This was me' action for a flagged session", async () => {
    server.use(
      http.get(`${BASE}/sessions/`, () =>
        HttpResponse.json([session({ id: "sus", is_suspicious: true })])
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SessionsList />));
    await waitFor(() => expect(screen.getByText("Unrecognized sign-in")).toBeDefined());
    expect(screen.getByText("This was me")).toBeDefined();
  });

  it("revoking a session calls DELETE /sessions/:id/ and refetches the list", async () => {
    let revoked: string | null = null;
    server.use(
      http.get(`${BASE}/sessions/`, () =>
        HttpResponse.json(
          revoked ? [] : [session({ id: "other", device_name: "Someone's Phone" })]
        )
      ),
      http.delete(`${BASE}/sessions/:id/`, ({ params }) => {
        revoked = params["id"] as string;
        return HttpResponse.json({ status: "ok" });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SessionsList />));
    await waitFor(() => expect(screen.getByText("Someone's Phone")).toBeDefined());

    screen.getByText("Sign out").click();
    const confirmButtons = await screen.findAllByRole("button", { name: "Sign out" });
    confirmButtons[confirmButtons.length - 1]?.click();

    await waitFor(() => expect(revoked).toBe("other"));
    await waitFor(() => expect(screen.getByText("No active sessions.")).toBeDefined());
  });

  it("'Sign out everyone else' only shows when there IS another session", async () => {
    server.use(
      http.get(`${BASE}/sessions/`, () =>
        HttpResponse.json([session({ id: "cur", is_current: true })])
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SessionsList />));
    await waitFor(() => expect(screen.getByTestId("sessions-list")).toBeDefined());
    expect(screen.queryByText("Sign out everyone else")).toBeNull();
  });
});
