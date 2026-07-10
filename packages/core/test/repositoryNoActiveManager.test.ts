import { describe, expect, it } from "vitest";
import { createRepository } from "../src/repository.js";

// Isolated in its own file so no earlier test's `createSessionManager()` call
// has already set an ambient "active" manager (see session.ts's
// `__setActiveSessionManager` — the last-created manager wins for the whole
// module instance, which vitest scopes per test FILE, not per `it()`).
describe("createRepository — scope: user with no SessionManager anywhere", () => {
  it("throws a clear error instead of silently using an unmanaged key", async () => {
    const repo = createRepository("orphan", { scope: "user" });
    await expect(repo.set("k", "v")).rejects.toThrow(/SessionManager/);
  });
});
