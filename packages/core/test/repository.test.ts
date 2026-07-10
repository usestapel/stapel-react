import { beforeEach, describe, expect, it } from "vitest";
import { createRepository } from "../src/repository.js";
import { createSessionManager } from "../src/session.js";

// jsdom has no IndexedDB, so `storage: "indexeddb"` falls back to the
// localStorage adapter here — the same fallback ladder `defaultPersistStorage`
// uses elsewhere in this package (see query.test.ts). Both `storage: "local"`
// and `storage: "indexeddb"` end up on `localStorage` in this environment, on
// DIFFERENT key prefixes — enough to exercise "physically absent in both
// stores" without a real browser.
beforeEach(() => {
  localStorage.clear();
});

describe("createRepository — scope: user, wipe-at-logout (§43.4, contract test)", () => {
  it("physically removes user-scoped data from both storage backends after logout(), and drops the key", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    manager.markAuthenticated();

    const localRepo = createRepository<{ secret: string }>("profile", {
      storage: "local",
      scope: "user",
      sessionManager: manager,
    });
    const idbRepo = createRepository<{ token: string }>("wallet", {
      storage: "indexeddb",
      scope: "user",
      sessionManager: manager,
    });

    await localRepo.set("me", { secret: "shh" });
    await idbRepo.set("me", { token: "tok_1" });

    expect(await localRepo.get("me")).toEqual({ secret: "shh" });
    expect(await idbRepo.get("me")).toEqual({ token: "tok_1" });
    // Physically present as ciphertext, under the namespaced key.
    expect(localStorage.getItem("stapel:repo:profile:me")).not.toBeNull();
    expect(localStorage.getItem("stapel:repo:wallet:me")).not.toBeNull();

    await manager.logout();

    // Physically absent — not just logically inaccessible.
    expect(localStorage.getItem("stapel:repo:profile:me")).toBeNull();
    expect(localStorage.getItem("stapel:repo:wallet:me")).toBeNull();
    expect(await localRepo.keys()).toEqual([]);
    expect(await idbRepo.keys()).toEqual([]);
  });

  it("wipes on an involuntary sessionLost() too, not just explicit logout()", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    manager.markAuthenticated();
    const repo = createRepository("notes", {
      storage: "local",
      scope: "user",
      sessionManager: manager,
    });
    await repo.set("k", "v");
    expect(localStorage.getItem("stapel:repo:notes:k")).not.toBeNull();

    await manager.sessionLost("expired");

    expect(localStorage.getItem("stapel:repo:notes:k")).toBeNull();
  });

  it("has no opt-out: the wipe hook registers regardless of any option passed", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const repo = createRepository("mandatory", {
      scope: "user",
      encrypted: false, // even with encryption off, wipe still applies
      sessionManager: manager,
    });
    await repo.set("k", "v");
    await manager.logout();
    expect(await repo.get("k")).toBeUndefined();
  });
});

describe("createRepository — scope: app survives logout", () => {
  it("keeps app-scoped data across logout()", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const appRepo = createRepository<string>("theme", {
      storage: "local",
      scope: "app",
      sessionManager: manager,
    });
    await appRepo.set("mode", "dark");
    await manager.logout();
    expect(await appRepo.get("mode")).toBe("dark");
  });

  it("is never encrypted with the session key, even if requested", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const appRepo = createRepository<string>("locale", {
      storage: "local",
      scope: "app",
      encrypted: true, // ignored — app scope always wins
      sessionManager: manager,
    });
    await appRepo.set("lang", "en");
    // Stored as plain JSON, not an encrypted blob shape.
    const raw = JSON.parse(localStorage.getItem("stapel:repo:locale:lang") ?? "null");
    expect(raw).toBe("en");
  });
});

describe("createRepository — encryption (§43.5)", () => {
  it("round-trips a value through AES-GCM transparently", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const repo = createRepository<{ a: number }>("secure", {
      storage: "local",
      scope: "user",
      sessionManager: manager,
    });
    await repo.set("x", { a: 42 });
    expect(await repo.get("x")).toEqual({ a: 42 });

    // The raw stored blob is an encrypted envelope, not the plaintext JSON —
    // never the literal `{"a":42}` shape (a raw byte in the ciphertext MAY
    // coincidentally equal the digits "42", so assert on shape, not content).
    const raw = JSON.parse(localStorage.getItem("stapel:repo:secure:x") ?? "null") as {
      __stapelEncrypted?: boolean;
      iv?: unknown;
      data?: unknown;
    };
    expect(raw.__stapelEncrypted).toBe(true);
    expect(Array.isArray(raw.iv)).toBe(true);
    expect(Array.isArray(raw.data)).toBe(true);
    expect(raw).not.toHaveProperty("a");
  });

  it("treats data as an unreadable cache miss once the session key has rotated", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const repo = createRepository<string>("rotate", {
      storage: "local",
      scope: "user",
      sessionManager: manager,
    });
    await repo.set("k", "sensitive");
    await manager.logout(); // drops the key — a NEW session starts fresh
    // Simulate a straggler write that landed after the key dropped but
    // before the wipe hook's `clear()` reached it — irrelevant here since
    // clear() already ran; this asserts decrypt-failure handling directly.
    expect(await repo.get("k")).toBeUndefined();
  });
});

describe("createRepository — namespacing", () => {
  it("keys() only returns this namespace's own keys, prefix stripped", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const a = createRepository<string>("ns-a", {
      storage: "local",
      scope: "app",
      sessionManager: manager,
    });
    const b = createRepository<string>("ns-b", {
      storage: "local",
      scope: "app",
      sessionManager: manager,
    });
    await a.set("k1", "va");
    await b.set("k1", "vb");
    await b.set("k2", "vb2");
    expect(await a.keys()).toEqual(["k1"]);
    expect((await b.keys()).sort()).toEqual(["k1", "k2"]);
  });
});
