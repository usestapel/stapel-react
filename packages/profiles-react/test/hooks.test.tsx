import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createProfilesRuntime } from "../src/model/runtime.js";
import type { ProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import { MyProfile } from "../src/headless/MyProfile.js";
import { Relationship } from "../src/headless/Relationship.js";
import { ConnectionList } from "../src/headless/ConnectionList.js";
import { useMyProfile, useProfile } from "../src/model/queries.js";

/** Base the msw handlers mount on (mirrors stapel-profiles `/profiles/api`). */
const BASE = "https://profiles.stapel.test/profiles/api";
const USER = "b3f1c0de-0000-4000-8000-0000000000aa";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const MY_PROFILE = {
  user_id: "b3f1c0de-0000-4000-8000-000000000001",
  display_name: "Ada Lovelace",
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
};

function wrap(runtime: ProfilesRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ProfilesProvider runtime={runtime}>{children}</ProfilesProvider>
    </QueryClientProvider>
  );
}

describe("useMyProfile (happy path)", () => {
  it("fetches and returns the caller's profile", async () => {
    server.use(http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)));
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useMyProfile(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.display_name).toBe("Ada Lovelace");
    expect(result.current.data?.followers_count).toBe(12);
  });
});

describe("<MyProfile> (view + save)", () => {
  it("loads the profile and flips to saved after a PATCH", async () => {
    server.use(
      http.get(`${BASE}/me`, () => HttpResponse.json(MY_PROFILE)),
      http.patch(`${BASE}/me`, async ({ request }) => {
        const patch = (await request.json()) as { display_name?: string };
        return HttpResponse.json({ ...MY_PROFILE, ...patch });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <MyProfile>
          {({ profile, isSaved, save }) => (
            <div>
              <span data-testid="name">{profile?.display_name ?? "none"}</span>
              <span data-testid="saved">{String(isSaved)}</span>
              <button onClick={() => save({ display_name: "Ada C. Lovelace" })}>
                save
              </button>
            </div>
          )}
        </MyProfile>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("name").textContent).toBe("Ada Lovelace")
    );
    screen.getByText("save").click();
    await waitFor(() =>
      expect(screen.getByTestId("saved").textContent).toBe("true")
    );
    expect(screen.getByTestId("name").textContent).toBe("Ada C. Lovelace");
  });
});

describe("<Relationship> (follow flips status)", () => {
  it("starts neutral and becomes following after follow()", async () => {
    server.use(
      http.get(`${BASE}/:userId/relationship`, ({ params }) =>
        HttpResponse.json({ user_id: params.userId, status: "neutral" })
      ),
      http.post(`${BASE}/:userId/follow`, () =>
        HttpResponse.json({ success: true, status: "following" })
      )
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <Relationship userId={USER}>
          {({ status, isFollowing, follow }) => (
            <div>
              <span data-testid="status">{status ?? "loading"}</span>
              <span data-testid="following">{String(isFollowing)}</span>
              <button onClick={follow}>follow</button>
            </div>
          )}
        </Relationship>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("neutral")
    );
    screen.getByText("follow").click();
    await waitFor(() =>
      expect(screen.getByTestId("following").textContent).toBe("true")
    );
    expect(screen.getByTestId("status").textContent).toBe("following");
  });
});

describe("<ConnectionList> (followers)", () => {
  it("renders the follower ids and count", async () => {
    server.use(
      http.get(`${BASE}/me/followers`, () =>
        HttpResponse.json({
          followers: [
            "b3f1c0de-0000-4000-8000-000000000101",
            "b3f1c0de-0000-4000-8000-000000000102",
          ],
          count: 2,
        })
      )
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <ConnectionList kind="followers">
          {({ ids, count }) => (
            <div>
              <span data-testid="count">{count}</span>
              <span data-testid="ids">{ids.length}</span>
            </div>
          )}
        </ConnectionList>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("2")
    );
    expect(screen.getByTestId("ids").textContent).toBe("2");
  });
});

describe("useProfile (localizable error)", () => {
  it("surfaces a StapelApiError code on a 404 profile lookup", async () => {
    server.use(
      http.get(`${BASE}/:userId`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.404.profile_not_found",
            error: "Profile not found",
            params: {},
          },
          { status: 404 }
        )
      )
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useProfile("ghost"), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("error.404.profile_not_found");
  });
});
