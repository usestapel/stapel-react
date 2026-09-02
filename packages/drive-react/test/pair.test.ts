import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createSessionManager } from "@stapel/core";
import {
  createDriveRuntime,
  driveI18nBundleEn,
  driveQueryKeys,
  explainDriveError,
  registerDriveI18n,
} from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(driveQueryKeys.all[0]).toBe("drive");
    expect(driveQueryKeys.search({ workspaceId: "w", q: "x" })[0]).toBe("drive");
  });

  it("does NOT collide with the docs pair's namespace", () => {
    // The two live in one cache: the rows come from "docs", the drive-only
    // reads from "drive". A shared root would make a docs invalidation drop
    // this pair's caches and vice versa.
    expect(driveQueryKeys.all[0]).not.toBe("docs");
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(driveI18nBundleEn["drive.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerDriveI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["drive.error.unknown"]).toBeTruthy();
    // The backend floor rides along, so a host that registers only this pair
    // still gets a sentence for every refusal the drive can surface.
    expect(seen["error.507.docs_workspace_quota"]).toBeTruthy();
  });
});

describe("the error map", () => {
  it("answers the remediation the backend declared", () => {
    expect(explainDriveError("error.507.docs_workspace_quota")).toBeTruthy();
    expect(explainDriveError("error.503.docs_thumbnails_unavailable")).toBe(
      "retry"
    );
  });

  it("has no entry for the pair's own client-side key", () => {
    expect(explainDriveError("drive.error.unknown")).toBeUndefined();
  });
});

describe("self-description (frontend-core §2.4 — manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    // vitest runs from the package root, so a cwd-relative path is stable
    // across node/jsdom (jsdom's import.meta.url is not a file:// URL).
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/drive-react");
    expect(manifest.backend.module).toBe("stapel-docs");
    // The whole reason this package exists is the 0.5 surface; a manifest
    // announcing an older range would be announcing a wire it cannot call.
    expect(manifest.backend.contract).toBe(">=0.5 <0.6");
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("declares one nav entry, and it routes away from the docs pair's /files", () => {
    const nav = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    expect(nav.package).toBe("@stapel/drive-react");
    expect(nav.entries).toHaveLength(1);
    expect(nav.entries[0].route.path).toBe("/drive");
    expect(nav.entries[0].component.export).toBe("DriveScreen");
  });
});

describe("logout hook (frontend-core-architecture-v2 §43.7 — pair contract)", () => {
  it("registers a logout hook (no-op by default) on the active SessionManager", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const spy = vi.spyOn(manager, "registerLogoutHook");
    createDriveRuntime({ baseUrl: "/docs/api/v1" });
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(manager.logout()).resolves.toBeUndefined();
  });
});
