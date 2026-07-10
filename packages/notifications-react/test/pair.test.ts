import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createSessionManager } from "@stapel/core";
import {
  notificationsQueryKeys,
  notificationsI18nBundleEn,
  registerNotificationsI18n,
} from "../src/index.js";
import { createNotificationsRuntime } from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(notificationsQueryKeys.all[0]).toBe("notifications");
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(notificationsI18nBundleEn["notifications.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerNotificationsI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["notifications.error.unknown"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    // vitest runs from the package root, so a cwd-relative path is stable
    // across node/jsdom (jsdom's import.meta.url is not a file:// URL).
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/notifications-react");
    expect(manifest.backend.module).toBe("stapel-notifications");
    // backend.contract (gen:manifest ← MANIFEST_BACKEND_PYPROJECT): the semver
    // range this surface was generated against — a backend minor bump reddens
    // the drift gate (frontend-core §2.4 / §3.4.2).
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });
});
describe("logout hook (frontend-core-architecture-v2 §43.7 — pair contract)", () => {
  it("registers a logout hook (no-op by default) on the active SessionManager", async () => {
    // The hook comes from core's createModuleRuntime — the one reviewed
    // template every standard pair binds — so the cleanup call site exists
    // mechanically even while this pair caches nothing of its own (core's
    // query layer and createRepository already wipe themselves).
    const manager = createSessionManager({ doRefresh: async () => null });
    const spy = vi.spyOn(manager, "registerLogoutHook");
    createNotificationsRuntime({ baseUrl: "/notifications/api" });
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(manager.logout()).resolves.toBeUndefined();
  });
});
