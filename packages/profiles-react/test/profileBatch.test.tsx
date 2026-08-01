import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createProfilesRuntime } from "../src/model/runtime.js";
import type { ProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import { useProfile, useProfilesBatch } from "../src/model/queries.js";
import {
  profileBatchById,
  profileBatchEntry,
} from "../src/model/profileBatch.js";
import { profilesQueryKeys } from "../src/model/queryKeys.js";

/**
 * Batch profile lookup (profiles-react against stapel-profiles 0.9.0, #111).
 * Reds out against 0.13.0: there was no `POST /batch` method, no hook and no
 * way to tell "no profile row" from "not asked".
 */

const BASE = "https://profiles.stapel.test/profiles/api/v1";
const ALICE = "b3f1c0de-0000-4000-8000-0000000000a1";
const BOB = "b3f1c0de-0000-4000-8000-0000000000b2";
const NOBODY = "b3f1c0de-0000-4000-8000-0000000000c3";
const NEVER_ASKED = "b3f1c0de-0000-4000-8000-0000000000d4";

function publicProfile(userId: string, name: string) {
  return {
    user_id: userId,
    display_name: name,
    avatar: null,
    location_display_name_narrow: null,
    location_display_name_broad: null,
    relationship_status: "neutral",
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrap(
  runtime: ProfilesRuntime,
  queryClient: QueryClient,
  children: ReactNode
): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfilesProvider runtime={runtime}>{children}</ProfilesProvider>
    </QueryClientProvider>
  );
}

describe("useProfilesBatch (POST /batch)", () => {
  it("resolves many ids in ONE request", async () => {
    let calls = 0;
    let sent: unknown = null;
    server.use(
      http.post(`${BASE}/batch`, async ({ request }) => {
        calls += 1;
        sent = await request.json();
        return HttpResponse.json({
          profiles: [
            publicProfile(ALICE, "Alice"),
            publicProfile(BOB, "Bob"),
          ],
          missing: [NOBODY],
        });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(
      () => useProfilesBatch([ALICE, BOB, NOBODY, ALICE]),
      { wrapper: ({ children }) => wrap(runtime, queryClient, children) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toBe(1);
    // Duplicates collapse before the wire — one id, one lookup.
    expect(sent).toEqual({ user_ids: [ALICE, BOB, NOBODY].sort() });
    expect(result.current.data?.profiles).toHaveLength(2);
    expect(result.current.data?.missing).toEqual([NOBODY]);
  });

  it("KEEPS `missing` apart from `not_requested` — the whole point", async () => {
    server.use(
      http.post(`${BASE}/batch`, () =>
        HttpResponse.json({
          profiles: [publicProfile(ALICE, "Alice")],
          missing: [NOBODY],
        })
      )
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useProfilesBatch([ALICE, NOBODY]), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const batch = result.current.data;

    // Three different answers, three different renders: a profile, a
    // placeholder, and "you never asked about this one". Collapsing the last
    // two into `undefined` is the defect that turned a 16-tile grid into 16
    // red console lines.
    const found = profileBatchEntry(batch, ALICE);
    expect(found.status).toBe("found");
    expect(found.profile?.display_name).toBe("Alice");

    expect(profileBatchEntry(batch, NOBODY)).toEqual({
      status: "missing",
      profile: null,
    });
    expect(profileBatchEntry(batch, NEVER_ASKED)).toEqual({
      status: "not_requested",
      profile: null,
    });
    // …and they are pairwise distinguishable, not just individually labelled.
    expect(profileBatchEntry(batch, NOBODY).status).not.toBe(
      profileBatchEntry(batch, NEVER_ASKED).status
    );
    expect(profileBatchEntry(batch, NOBODY).status).not.toBe(
      profileBatchEntry(batch, ALICE).status
    );

    // A `missing` id must NOT be invented into a placeholder profile.
    expect(profileBatchById(batch).has(NOBODY)).toBe(false);
    expect(profileBatchById(batch).get(ALICE)?.display_name).toBe("Alice");
  });

  it("answers `unknown` before there is an answer — not `missing`", () => {
    expect(profileBatchEntry(undefined, ALICE)).toEqual({
      status: "unknown",
      profile: null,
    });
    // "Still loading" and "this person has no profile" are different screens.
    expect(profileBatchEntry(undefined, ALICE).status).not.toBe("missing");
    expect(
      profileBatchEntry({ profiles: [], missing: [] }, ALICE).status
    ).toBe("not_requested");
    expect(
      profileBatchEntry({ profiles: [], missing: [ALICE] }, ALICE).status
    ).toBe("missing");
  });

  it("seeds each found profile into its own detail cache", async () => {
    let detailCalls = 0;
    server.use(
      http.post(`${BASE}/batch`, () =>
        HttpResponse.json({
          profiles: [publicProfile(ALICE, "Alice")],
          missing: [NOBODY],
        })
      ),
      http.get(`${BASE}/${ALICE}`, () => {
        detailCalls += 1;
        return HttpResponse.json(publicProfile(ALICE, "Alice"));
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const batch = renderHook(() => useProfilesBatch([ALICE, NOBODY]), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    await waitFor(() => expect(batch.result.current.isSuccess).toBe(true));

    const detail = renderHook(() => useProfile(ALICE), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    // Painted from what the grid already fetched — no second round-trip.
    expect(detail.result.current.data?.display_name).toBe("Alice");
    expect(detailCalls).toBe(0);
    // Nothing was invented for the missing id.
    expect(
      queryClient.getQueryData(profilesQueryKeys.profile(NOBODY))
    ).toBeUndefined();
  });

  it("surfaces the refusal over the id ceiling instead of truncating", async () => {
    server.use(
      http.post(`${BASE}/batch`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.400.too_many_ids",
            error: "Too many ids",
            params: { requested: 120, limit: 100 },
          },
          { status: 400 }
        )
      )
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useProfilesBatch([ALICE, BOB]), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("error.400.too_many_ids");
    // Both numbers ride along so a caller can chunk by the REAL limit.
    expect(result.current.error?.params).toEqual({
      requested: 120,
      limit: 100,
    });
  });

  it("fetches nothing for an empty roster", async () => {
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useProfilesBatch([]), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});
