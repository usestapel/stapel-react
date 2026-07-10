import { describe, expect, it, vi } from "vitest";
import { createModuleRuntime } from "../src/module.js";
import { createSessionManager } from "../src/session.js";

// The pair-template contract (§43.7): every `@stapel/<module>-react` pair
// built on `createModuleRuntime` gets a logout hook registered — a no-op by
// default — so the call site mechanically exists even for a pair that
// currently caches nothing of its own (core's query layer and
// `createRepository` already wipe themselves).
describe("createModuleRuntime — default logout hook (§43.7)", () => {
  it("registers a no-op hook on the active SessionManager when none is given", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const registerLogoutHook = vi.spyOn(manager, "registerLogoutHook");

    createModuleRuntime((client) => ({ client }), { baseUrl: "/x/api" });

    expect(registerLogoutHook).toHaveBeenCalledTimes(1);
    // The registered no-op does not throw when the registry runs it.
    await expect(manager.logout()).resolves.toBeUndefined();
  });

  it("registers the pair's own onLogout callback when supplied", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const onLogout = vi.fn();

    createModuleRuntime((client) => ({ client }), {
      baseUrl: "/x/api",
      onLogout,
    });

    await manager.logout();
    expect(onLogout).toHaveBeenCalledWith("logout");
  });
});
