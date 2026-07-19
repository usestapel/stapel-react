/**
 * `<AuditLogPanel/>` — default skin for `AuditLogViewSet` (auth-sa.md §16),
 * dropped during the ironmemo port and re-added here. Built entirely on the
 * pair's EXISTING `useAuditLog(page)` query.
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
import { AuditLogPanel } from "../../src/default/security/AuditLogPanel.js";
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

describe("<AuditLogPanel/>", () => {
  it("renders recent events with their timestamp and IP", async () => {
    server.use(
      http.get(`${BASE}/security/audit/`, () =>
        HttpResponse.json({
          results: [
            {
              id: "e1",
              event_type: "user.login",
              ip_address: "1.2.3.4",
              user_agent: "Chrome",
              metadata: {},
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          count: 1,
          next: null,
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuditLogPanel />));

    await waitFor(() => expect(screen.getByTestId("audit-log-panel")).toBeDefined());
    await waitFor(() => expect(screen.getByText("User login")).toBeDefined());
    expect(screen.getByText(/IP 1\.2\.3\.4/)).toBeDefined();
    // Only one page — no "Load more" affordance.
    expect(screen.queryByText("Load more")).toBeNull();
  });

  it("shows the empty state when there is no activity", async () => {
    server.use(
      http.get(`${BASE}/security/audit/`, () => HttpResponse.json({ results: [], count: 0, next: null }))
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuditLogPanel />));

    await waitFor(() => expect(screen.getByText("No recent activity.")).toBeDefined());
  });

  it("shows an error state when the audit request fails", async () => {
    server.use(
      http.get(`${BASE}/security/audit/`, () =>
        HttpResponse.json({ code: "error.500.internal", message: "boom" }, { status: 500 })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuditLogPanel />));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  });

  it("'Load more' advances to the next page", async () => {
    let requestedPage = "1";
    server.use(
      http.get(`${BASE}/security/audit/`, ({ request }) => {
        requestedPage = new URL(request.url).searchParams.get("page") ?? "1";
        return HttpResponse.json(
          requestedPage === "2"
            ? {
                results: [
                  {
                    id: "e2",
                    event_type: "user.session_revoked",
                    ip_address: null,
                    user_agent: "curl",
                    metadata: {},
                    created_at: "2026-01-02T00:00:00Z",
                  },
                ],
                count: 2,
                next: null,
              }
            : {
                results: [
                  {
                    id: "e1",
                    event_type: "user.login",
                    ip_address: "1.2.3.4",
                    user_agent: "Chrome",
                    metadata: {},
                    created_at: "2026-01-01T00:00:00Z",
                  },
                ],
                count: 2,
                next: 2,
              }
        );
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AuditLogPanel />));

    await waitFor(() => expect(screen.getByText("User login")).toBeDefined());
    screen.getByText("Load more").click();

    await waitFor(() => expect(screen.getByText("User session revoked")).toBeDefined());
    expect(requestedPage).toBe("2");
  });
});
