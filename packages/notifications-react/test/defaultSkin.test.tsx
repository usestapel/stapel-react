/**
 * Coverage for the settings surfaces added to this pair per the owner
 * directive: the `<PushNotificationToggle/>` and `<NotificationFeedList/>`
 * default-skin components built on this pair's existing headless hooks.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createNotificationsRuntime } from "../src/model/runtime.js";
import type { NotificationsRuntime } from "../src/model/runtime.js";
import { NotificationsProvider } from "../src/headless/NotificationsProvider.js";
import { registerNotificationsI18n } from "../src/i18n/keys.js";
import { PushNotificationToggle, NotificationFeedList } from "../src/default/index.js";

const BASE = "https://notifications.stapel.test/notifications/api/v1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function wrap(runtime: NotificationsRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerNotificationsI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <NotificationsProvider runtime={runtime}>{children}</NotificationsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("<PushNotificationToggle/> (default skin)", () => {
  it("resolves a token via getToken() and registers it on toggle-on", async () => {
    let registeredToken: string | undefined;
    server.use(
      http.post(`${BASE}/devices/`, async ({ request }) => {
        const body = (await request.json()) as { token: string; platform: string };
        registeredToken = body.token;
        return HttpResponse.json(body, { status: 201 });
      })
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <PushNotificationToggle getToken={() => Promise.resolve("web-token-123")} />
      )
    );

    await waitFor(() => expect(screen.getByText("Push notifications")).toBeDefined());
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(registeredToken).toBe("web-token-123"));
    await waitFor(() => expect(screen.getByText("Push notifications enabled.")).toBeDefined());
  });

  it("unregisters the bound token on toggle-off", async () => {
    let unregisteredPath: string | undefined;
    server.use(
      http.post(`${BASE}/devices/`, async ({ request }) => {
        const body = (await request.json()) as { token: string };
        return HttpResponse.json(body, { status: 201 });
      }),
      http.delete(`${BASE}/devices/:token/`, ({ params }) => {
        unregisteredPath = params.token as string;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <PushNotificationToggle getToken={() => Promise.resolve("web-token-456")} />
      )
    );

    await waitFor(() => expect(screen.getByText("Push notifications")).toBeDefined());
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(screen.getByText("Push notifications enabled.")).toBeDefined());
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(unregisteredPath).toBe("web-token-456"));
  });
});

describe("<NotificationFeedList/> (default skin)", () => {
  it("renders the feed and loads the next page", async () => {
    server.use(
      http.get(`${BASE}/feed/`, ({ request }) => {
        const anchor = new URL(request.url).searchParams.get("anchor");
        if (!anchor) {
          return HttpResponse.json({
            items: [
              {
                id: "550e8400-e29b-41d4-a716-446655440001",
                notification_type: "listing_blocked",
                title: "Your listing has been blocked",
                body: "Blocked for guideline violations.",
                data: {},
                created_at: "2026-03-17T10:30:00Z",
              },
            ],
            next_anchor: "anchor-2",
            prev_anchor: null,
            has_next: true,
            has_prev: false,
            count: 1,
          });
        }
        return HttpResponse.json({
          items: [
            {
              id: "550e8400-e29b-41d4-a716-446655440002",
              notification_type: "system",
              title: "Weekly digest",
              body: "Here's what happened this week.",
              data: {},
              created_at: "2026-03-10T10:30:00Z",
            },
          ],
          next_anchor: null,
          prev_anchor: "anchor-1",
          has_next: false,
          has_prev: true,
          count: 1,
        });
      })
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <NotificationFeedList />));

    await waitFor(() =>
      expect(screen.getByText("Your listing has been blocked")).toBeDefined()
    );
    fireEvent.click(screen.getByText("Load more"));
    await waitFor(() => expect(screen.getByText("Weekly digest")).toBeDefined());
    await waitFor(() => expect(screen.getByText("You're all caught up.")).toBeDefined());
  });

  it("shows the empty state when the feed has nothing", async () => {
    server.use(
      http.get(`${BASE}/feed/`, () =>
        HttpResponse.json({
          items: [],
          next_anchor: null,
          prev_anchor: null,
          has_next: false,
          has_prev: false,
          count: 0,
        })
      )
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <NotificationFeedList />));

    await waitFor(() => expect(screen.getByText("No notifications yet.")).toBeDefined());
  });
});
