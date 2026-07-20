import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMeCachePersister } from "../src/query.js";
import { createSessionManager } from "../src/session.js";

// jsdom provides `localStorage` — the same environment `query.test.ts` and
// `repository.test.ts` rely on for their persistence coverage.

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createMeCachePersister — cache-first /me-class persistence", () => {
  it("hydrates persisted /me-class data SYNCHRONOUSLY, before any network call could resolve", () => {
    const writerClient = freshClient();
    const writer = createMeCachePersister({
      queryClient: writerClient,
      queryKeys: [["auth", "me"]],
    });
    writerClient.setQueryData(["auth", "me"], { id: "u1", name: "Ada" });
    writer.flushPersist();

    // A brand-new QueryClient, standing in for a fresh page load. No
    // `await`, no microtask flush — if hydration were async this would
    // still observe an empty cache.
    const readerClient = freshClient();
    createMeCachePersister({
      queryClient: readerClient,
      queryKeys: [["auth", "me"]],
    });

    expect(readerClient.getQueryData(["auth", "me"])).toEqual({
      id: "u1",
      name: "Ada",
    });
  });

  it("persists ONLY the selected /me-class keys, not the rest of the query cache (selective dehydration)", () => {
    const client = freshClient();
    const persister = createMeCachePersister({
      queryClient: client,
      queryKeys: [["auth", "me"], ["profiles", "me"]],
    });
    client.setQueryData(["auth", "me"], { id: "u1" });
    client.setQueryData(["profiles", "me"], { bio: "hi" });
    client.setQueryData(["auth", "sessions"], [{ id: "s1" }]); // NOT /me-class
    client.setQueryData(["some", "unrelated", "list"], [1, 2, 3]);
    persister.flushPersist();

    const raw = localStorage.getItem("stapel-me-cache");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      queries: { queryKey: unknown[] }[];
    };
    const persistedKeys = parsed.queries.map((q) => q.queryKey);
    expect(persistedKeys).toContainEqual(["auth", "me"]);
    expect(persistedKeys).toContainEqual(["profiles", "me"]);
    expect(persistedKeys).not.toContainEqual(["auth", "sessions"]);
    expect(persistedKeys).not.toContainEqual(["some", "unrelated", "list"]);
    expect(persistedKeys).toHaveLength(2);
  });

  it("revalidation (a fresh setQueryData, standing in for the network response) updates the persisted value", () => {
    const client = freshClient();
    const persister = createMeCachePersister({
      queryClient: client,
      queryKeys: [["auth", "me"]],
    });
    client.setQueryData(["auth", "me"], { id: "u1", name: "stale-cache-name" });
    persister.flushPersist();

    // Background revalidation resolves with fresher data.
    client.setQueryData(["auth", "me"], { id: "u1", name: "fresh-network-name" });
    persister.flushPersist();

    const nextLoadClient = freshClient();
    createMeCachePersister({
      queryClient: nextLoadClient,
      queryKeys: [["auth", "me"]],
    });
    expect(nextLoadClient.getQueryData(["auth", "me"])).toEqual({
      id: "u1",
      name: "fresh-network-name",
    });
  });

  it("logout wipes the persisted /me cache through the SAME registry createRepository uses — no cross-user leak", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    manager.markAuthenticated();

    // User A's session: persist their /me.
    const clientA = freshClient();
    const persisterA = createMeCachePersister({
      queryClient: clientA,
      queryKeys: [["auth", "me"]],
    });
    clientA.setQueryData(["auth", "me"], { id: "user-A", name: "Ada" });
    persisterA.flushPersist();
    expect(localStorage.getItem("stapel-me-cache")).not.toBeNull();

    // A logs out.
    await manager.logout();
    expect(localStorage.getItem("stapel-me-cache")).toBeNull();

    // User B cold-loads the SAME device/browser afterward.
    const clientB = freshClient();
    createMeCachePersister({
      queryClient: clientB,
      queryKeys: [["auth", "me"]],
    });

    expect(clientB.getQueryData(["auth", "me"])).toBeUndefined();
  });

  it("also wipes on an involuntary sessionLost(), not just explicit logout()", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    manager.markAuthenticated();
    const client = freshClient();
    const persister = createMeCachePersister({
      queryClient: client,
      queryKeys: [["auth", "me"]],
    });
    client.setQueryData(["auth", "me"], { id: "user-A" });
    persister.flushPersist();
    expect(localStorage.getItem("stapel-me-cache")).not.toBeNull();

    await manager.sessionLost("expired");
    expect(localStorage.getItem("stapel-me-cache")).toBeNull();
  });

  it("first-ever load with no persisted cache: hydration is a safe no-op", () => {
    expect(localStorage.getItem("stapel-me-cache")).toBeNull();
    const client = freshClient();
    expect(() =>
      createMeCachePersister({ queryClient: client, queryKeys: [["auth", "me"]] })
    ).not.toThrow();
    expect(client.getQueryData(["auth", "me"])).toBeUndefined();
  });

  it("is SSR-safe: no `localStorage` global does not throw on construction, hydrate, or persist", () => {
    vi.stubGlobal("localStorage", undefined);
    const client = freshClient();
    const persister = createMeCachePersister({
      queryClient: client,
      queryKeys: [["auth", "me"]],
    });
    expect(() => client.setQueryData(["auth", "me"], { id: "u1" })).not.toThrow();
    expect(() => persister.flushPersist()).not.toThrow();
  });

  it("respects a custom storageKey (multiple persisters can coexist without clobbering each other)", () => {
    const authClient = freshClient();
    const authPersister = createMeCachePersister({
      queryClient: authClient,
      queryKeys: [["auth", "me"]],
      storageKey: "stapel-me-cache:auth",
    });
    authClient.setQueryData(["auth", "me"], { id: "u1" });
    authPersister.flushPersist();

    const profileClient = freshClient();
    const profilePersister = createMeCachePersister({
      queryClient: profileClient,
      queryKeys: [["profiles", "me"]],
      storageKey: "stapel-me-cache:profiles",
    });
    profileClient.setQueryData(["profiles", "me"], { bio: "hi" });
    profilePersister.flushPersist();

    expect(localStorage.getItem("stapel-me-cache:auth")).not.toBeNull();
    expect(localStorage.getItem("stapel-me-cache:profiles")).not.toBeNull();

    const rehydrated = freshClient();
    createMeCachePersister({
      queryClient: rehydrated,
      queryKeys: [["auth", "me"]],
      storageKey: "stapel-me-cache:auth",
    });
    expect(rehydrated.getQueryData(["auth", "me"])).toEqual({ id: "u1" });
    expect(rehydrated.getQueryData(["profiles", "me"])).toBeUndefined();
  });
});
