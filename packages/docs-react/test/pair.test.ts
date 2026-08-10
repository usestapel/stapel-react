import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createSessionManager } from "@stapel/core";
import {
  docsQueryKeys,
  docsI18nBundleEn,
  registerDocsI18n,
  createDocsRuntime,
} from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(docsQueryKeys.all[0]).toBe("docs");
    expect(docsQueryKeys.document("d-1")[0]).toBe("docs");
    expect(docsQueryKeys.content("d-1")[0]).toBe("docs");
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(docsI18nBundleEn["docs.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerDocsI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["docs.error.unknown"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    // vitest runs from the package root, so a cwd-relative path is stable
    // across node/jsdom (jsdom's import.meta.url is not a file:// URL).
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/docs-react");
    expect(manifest.backend.module).toBe("stapel-docs");
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
    createDocsRuntime({ baseUrl: "/docs/api/v1" });
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(manager.logout()).resolves.toBeUndefined();
  });
});
