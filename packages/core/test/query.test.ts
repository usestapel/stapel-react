import { beforeEach, describe, expect, it } from "vitest";
import { createStapelQueryClient } from "../src/query.js";

// jsdom has no IndexedDB, so the runtime falls back to the localStorage
// adapter — which is exactly the fallback path we want covered.

beforeEach(() => {
  localStorage.clear();
});

describe("createStapelQueryClient persistence", () => {
  it("persists under a per-user namespace", async () => {
    const runtime = createStapelQueryClient({ cacheVersion: "1" });
    await runtime.setPersistUser("user-a");
    runtime.queryClient.setQueryData(["profile"], { name: "Ada" });
    await runtime.flushPersist();

    expect(localStorage.getItem("stapel-query:user-a")).not.toBeNull();
    expect(localStorage.getItem("stapel-query:user-b")).toBeNull();

    await runtime.setPersistUser("user-b");
    runtime.queryClient.setQueryData(["settings"], { theme: "dark" });
    await runtime.flushPersist();
    expect(localStorage.getItem("stapel-query:user-b")).not.toBeNull();
  });

  it("restores persisted state for the same user and version", async () => {
    const writer = createStapelQueryClient({ cacheVersion: "1" });
    await writer.setPersistUser("user-a");
    writer.queryClient.setQueryData(["profile"], { name: "Ada" });
    await writer.flushPersist();

    const reader = createStapelQueryClient({ cacheVersion: "1" });
    await reader.setPersistUser("user-a");
    expect(reader.queryClient.getQueryData(["profile"])).toEqual({
      name: "Ada",
    });
  });

  it("discards persisted state written under another cache version", async () => {
    const writer = createStapelQueryClient({ cacheVersion: "1" });
    await writer.setPersistUser("user-a");
    writer.queryClient.setQueryData(["profile"], { name: "Ada" });
    await writer.flushPersist();

    const reader = createStapelQueryClient({ cacheVersion: "2" });
    await reader.setPersistUser("user-a");
    expect(reader.queryClient.getQueryData(["profile"])).toBeUndefined();
    expect(localStorage.getItem("stapel-query:user-a")).toBeNull();
  });

  it("does not leak one user's cache into another user's namespace", async () => {
    const runtime = createStapelQueryClient({ cacheVersion: "1" });
    await runtime.setPersistUser("user-a");
    runtime.queryClient.setQueryData(["profile"], { name: "Ada" });
    await runtime.flushPersist();
    await runtime.setPersistUser(null);

    const fresh = createStapelQueryClient({ cacheVersion: "1" });
    await fresh.setPersistUser("user-b");
    expect(fresh.queryClient.getQueryData(["profile"])).toBeUndefined();
  });

  it("stops persisting after setPersistUser(null)", async () => {
    const runtime = createStapelQueryClient({ cacheVersion: "1" });
    await runtime.setPersistUser("user-a");
    await runtime.setPersistUser(null);
    runtime.queryClient.setQueryData(["profile"], { name: "Eve" });
    await runtime.flushPersist();

    const raw = localStorage.getItem("stapel-query:user-a");
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("Eve");
  });

  it("purgePersistedCache removes every namespace and clears memory (logout/GDPR)", async () => {
    const runtime = createStapelQueryClient({ cacheVersion: "1" });
    await runtime.setPersistUser("user-a");
    runtime.queryClient.setQueryData(["profile"], { name: "Ada" });
    await runtime.flushPersist();
    await runtime.setPersistUser("user-b");
    runtime.queryClient.setQueryData(["settings"], { theme: "dark" });
    await runtime.flushPersist();
    localStorage.setItem("unrelated-key", "keep-me");

    await runtime.purgePersistedCache();

    expect(localStorage.getItem("stapel-query:user-a")).toBeNull();
    expect(localStorage.getItem("stapel-query:user-b")).toBeNull();
    expect(localStorage.getItem("unrelated-key")).toBe("keep-me");
    expect(runtime.queryClient.getQueryData(["profile"])).toBeUndefined();
    expect(runtime.queryClient.getQueryData(["settings"])).toBeUndefined();
  });

  it("respects a custom cacheKeyPrefix", async () => {
    const runtime = createStapelQueryClient({
      cacheKeyPrefix: "acme-cache",
      cacheVersion: "1",
    });
    await runtime.setPersistUser("u");
    runtime.queryClient.setQueryData(["x"], 1);
    await runtime.flushPersist();
    expect(localStorage.getItem("acme-cache:u")).not.toBeNull();
  });
});
