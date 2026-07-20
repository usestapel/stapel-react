/**
 * `useMyProfile` cache-first / stale-while-revalidate contract (owner
 * directive — same shape as auth-react's `useMe` test): with
 * `@stapel/core`'s `createMeCachePersister` hydrated into the QueryClient
 * before mount (the same wiring `<StapelProvider
 * meCacheQueryKeys={[profilesQueryKeys.me()]}>` does), the very first render
 * shows the last-known profile from localStorage — BEFORE the network call
 * resolves — then updates once it does.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { createMeCachePersister, createSessionManager } from "@stapel/core";
import { createProfilesRuntime } from "../src/model/runtime.js";
import type { ProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import { profilesQueryKeys } from "../src/model/queryKeys.js";
import { useMyProfile } from "../src/model/queries.js";
import type { MyProfile } from "../src/api/types.js";

const BASE = "https://profiles.stapel.test/profiles/api/v1";

function profile(overrides: Partial<MyProfile> = {}): MyProfile {
  return {
    user_id: "b3f1c0de-0000-4000-8000-000000000001",
    display_name: "cached-name",
    avatar: "avatar/ada",
    location_id: 0,
    location_display_name_narrow: "London",
    location_display_name_broad: "United Kingdom",
    currency_code: "GBP",
    measurement_units: "metric",
    theme: "system",
    app_language: "en",
    understands: ["en"],
    use_device_language: true,
    auto_detected_language: "en",
    auto_translate_content: false,
    email_messages: true,
    email_system: true,
    push_messages: true,
    push_system: true,
    essential_cookies_accepted: true,
    initial_setup_passed: true,
    followers_count: 12,
    following_count: 7,
    rating: 4.8,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    ...overrides,
  } as MyProfile;
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

function ProfileProbe(): ReactElement {
  const { data } = useMyProfile();
  return <span data-testid="displayName">{data ? data.display_name : "none"}</span>;
}

function renderWithClient(queryClient: QueryClient, runtime: ProfilesRuntime): void {
  render(
    <QueryClientProvider client={queryClient}>
      <ProfilesProvider runtime={runtime}>
        <ProfileProbe />
      </ProfilesProvider>
    </QueryClientProvider>
  );
}

describe("useMyProfile — cache-first render, then background revalidation", () => {
  it("renders the persisted profile INSTANTLY (before the network call resolves), then updates", async () => {
    let released: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      released = resolve;
    });
    server.use(
      http.get(`${BASE}/me`, async () => {
        await gate;
        return HttpResponse.json(profile({ display_name: "network-name" }));
      })
    );

    const seedClient = new QueryClient();
    const seedWriter = createMeCachePersister({
      queryClient: seedClient,
      queryKeys: [profilesQueryKeys.me()],
    });
    seedClient.setQueryData(profilesQueryKeys.me(), profile({ display_name: "cached-name" }));
    seedWriter.flushPersist();
    expect(localStorage.getItem("stapel-me-cache")).not.toBeNull();

    const readerClient = new QueryClient();
    createMeCachePersister({
      queryClient: readerClient,
      queryKeys: [profilesQueryKeys.me()],
    });
    const runtime = createProfilesRuntime({ baseUrl: BASE });

    renderWithClient(readerClient, runtime);

    expect(screen.getByTestId("displayName").textContent).toBe("cached-name");

    released?.();
    await waitFor(() =>
      expect(screen.getByTestId("displayName").textContent).toBe("network-name")
    );
  });

  it("first-ever load with no persisted cache: shows loading, then the fetched profile", async () => {
    expect(localStorage.getItem("stapel-me-cache")).toBeNull();
    server.use(
      http.get(`${BASE}/me`, () => HttpResponse.json(profile({ display_name: "brand-new" })))
    );

    const readerClient = new QueryClient();
    createMeCachePersister({
      queryClient: readerClient,
      queryKeys: [profilesQueryKeys.me()],
    });
    const runtime = createProfilesRuntime({ baseUrl: BASE });

    renderWithClient(readerClient, runtime);

    expect(screen.getByTestId("displayName").textContent).toBe("none");
    await waitFor(() =>
      expect(screen.getByTestId("displayName").textContent).toBe("brand-new")
    );
  });

  it("SECURITY: after user A logs out, user B's cold load never sees A's cached profile", async () => {
    server.use(
      http.get(`${BASE}/me`, async () => {
        await delay("infinite");
        return HttpResponse.json(profile());
      })
    );

    // A SessionManager becomes "active" the moment it's created — the
    // persister below registers its wipe hook against WHICHEVER manager is
    // active at that moment (mirrors createRepository's wiring).
    const manager = createSessionManager({ doRefresh: async () => null });
    manager.markAuthenticated();

    const clientA = new QueryClient();
    const writerA = createMeCachePersister({
      queryClient: clientA,
      queryKeys: [profilesQueryKeys.me()],
    });
    clientA.setQueryData(profilesQueryKeys.me(), profile({ display_name: "user-a-profile" }));
    writerA.flushPersist();
    expect(localStorage.getItem("stapel-me-cache")).not.toBeNull();

    await manager.logout();
    expect(localStorage.getItem("stapel-me-cache")).toBeNull();

    const clientB = new QueryClient();
    createMeCachePersister({
      queryClient: clientB,
      queryKeys: [profilesQueryKeys.me()],
    });
    const runtimeB = createProfilesRuntime({ baseUrl: BASE });

    renderWithClient(clientB, runtimeB);

    expect(screen.getByTestId("displayName").textContent).toBe("none");
  });
});
