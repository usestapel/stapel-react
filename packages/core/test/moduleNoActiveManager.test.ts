import { describe, expect, it } from "vitest";
import { createModuleRuntime } from "../src/module.js";

// Isolated in its own file — no earlier `createSessionManager()` call has set
// an ambient "active" manager for this module instance (see
// repositoryNoActiveManager.test.ts for why file isolation matters here).
describe("createModuleRuntime — no SessionManager active anywhere", () => {
  it("still builds the runtime without throwing (the hook registration is best-effort)", () => {
    expect(() =>
      createModuleRuntime((client) => ({ client }), { baseUrl: "/x/api" })
    ).not.toThrow();
  });
});
