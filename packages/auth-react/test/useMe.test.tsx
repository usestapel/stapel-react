/**
 * `useMe` cache-first / stale-while-revalidate contract (owner directive):
 * with `@stapel/core`'s `createMeCachePersister` hydrated into the
 * QueryClient before mount (the same wiring `<StapelProvider
 * meCacheQueryKeys={[authQueryKeys.me()]}>` does), the very first render
 * shows the last-known user from localStorage — BEFORE the network call
 * resolves — then updates once it does.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { createMeCachePersister } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import type { AuthRuntime } from "../src/model/runtime.js";
import { AuthProvider } from "../src/headless/AuthProvider.js";
import { authQueryKeys } from "../src/model/queryKeys.js";
import { useMe } from "../src/model/queries.js";
import { BASE, testUser } from "./helpers.js";

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

function MeProbe(): ReactElement {
  const { data, isFetching } = useMe();
  return (
    <div>
      <span data-testid="username">{data ? data.username : "none"}</span>
      <span data-testid="fetching">{String(isFetching)}</span>
    </div>
  );
}

function renderWithClient(queryClient: QueryClient, runtime: AuthRuntime): void {
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider runtime={runtime}>
        <MeProbe />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("useMe — cache-first render, then background revalidation", () => {
  it("renders the persisted user INSTANTLY (before the network call resolves), then updates", async () => {
    // Server will eventually answer with a DIFFERENT user than the cache —
    // proof that what's on screen at first paint really is the persisted
    // snapshot, not a lucky-fast fetch.
    let released: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      released = resolve;
    });
    server.use(
      http.get(`${BASE}/me/`, async () => {
        await gate;
        return HttpResponse.json(testUser({ username: "network-ada" }));
      })
    );

    // Seed the persisted /me cache — simulates a previous session.
    const seedClient = new QueryClient();
    const seedWriter = createMeCachePersister({
      queryClient: seedClient,
      queryKeys: [authQueryKeys.me()],
    });
    seedClient.setQueryData(authQueryKeys.me(), testUser({ username: "cached-ada" }));
    seedWriter.flushPersist();
    expect(localStorage.getItem("stapel-me-cache")).not.toBeNull();

    // Cold-load reader: hydration runs synchronously at construction, before
    // this component ever renders.
    const readerClient = new QueryClient();
    createMeCachePersister({
      queryClient: readerClient,
      queryKeys: [authQueryKeys.me()],
    });
    const runtime = createAuthRuntime({ baseUrl: BASE });

    renderWithClient(readerClient, runtime);

    // No `waitFor` — the network request is still gated shut.
    expect(screen.getByTestId("username").textContent).toBe("cached-ada");

    // Let the network respond; the query revalidates in the background
    // (staleTime: 0 on useMe guarantees refetchOnMount fires regardless of
    // how fresh the persisted snapshot looked).
    released?.();
    await waitFor(() =>
      expect(screen.getByTestId("username").textContent).toBe("network-ada")
    );
  });

  it("first-ever load with no persisted cache: shows loading, then the fetched user (no crash, no leak)", async () => {
    expect(localStorage.getItem("stapel-me-cache")).toBeNull();
    server.use(
      http.get(`${BASE}/me/`, () => HttpResponse.json(testUser({ username: "brand-new" })))
    );

    const readerClient = new QueryClient();
    createMeCachePersister({
      queryClient: readerClient,
      queryKeys: [authQueryKeys.me()],
    });
    const runtime = createAuthRuntime({ baseUrl: BASE });

    renderWithClient(readerClient, runtime);

    expect(screen.getByTestId("username").textContent).toBe("none");
    await waitFor(() =>
      expect(screen.getByTestId("username").textContent).toBe("brand-new")
    );
  });

  it("SECURITY: after user A logs out, user B's cold load never sees A's cached /me", async () => {
    server.use(
      http.get(`${BASE}/me/`, async () => {
        await delay("infinite");
        return HttpResponse.json(testUser());
      })
    );

    // User A's runtime FIRST — its SessionManager becomes the "active"
    // manager the persister below registers its wipe hook against (core's
    // `__registerWipeWhenActive` binds to whichever manager is active AT
    // PERSISTER-CONSTRUCTION TIME, same as `createRepository`).
    const runtimeA = createAuthRuntime({ baseUrl: BASE });
    runtimeA.session.getSessionManager().markAuthenticated();

    // User A's session persists their /me.
    const clientA = new QueryClient();
    const writerA = createMeCachePersister({
      queryClient: clientA,
      queryKeys: [authQueryKeys.me()],
    });
    clientA.setQueryData(authQueryKeys.me(), testUser({ username: "user-a" }));
    writerA.flushPersist();
    expect(localStorage.getItem("stapel-me-cache")).not.toBeNull();

    // A logs out.
    await runtimeA.session.getSessionManager().logout();
    expect(localStorage.getItem("stapel-me-cache")).toBeNull();

    // User B cold-loads the same browser/device afterward.
    const clientB = new QueryClient();
    createMeCachePersister({
      queryClient: clientB,
      queryKeys: [authQueryKeys.me()],
    });
    const runtimeB = createAuthRuntime({ baseUrl: BASE });

    renderWithClient(clientB, runtimeB);

    // Must NOT show user A's cached name — the fetch is gated forever, so
    // any leak would show up as "user-a" right here, synchronously.
    expect(screen.getByTestId("username").textContent).toBe("none");
  });
});
