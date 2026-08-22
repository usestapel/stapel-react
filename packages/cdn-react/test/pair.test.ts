import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createSessionManager } from "@stapel/core";
import {
  CDN_FLOWS,
  cdnI18nBundleEn,
  cdnQueryKeys,
  createCdnRuntime,
  createCdnApi,
  flowEndpoints,
  registerCdnI18n,
  targetAssetType,
} from "../src/index.js";
import { mockServer } from "./harness.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root and keys on the content hash", () => {
    expect(cdnQueryKeys.all[0]).toBe("cdn");
    expect(cdnQueryKeys.exists("a".repeat(64))).toEqual([
      "cdn",
      "exists",
      "a".repeat(64),
    ]);
  });

  it("two references to the same bytes share one key", () => {
    const hash = "a".repeat(64);
    expect(cdnQueryKeys.exists(hash)).toEqual(cdnQueryKeys.exists(hash));
  });
});

describe("the asset type a target produces", () => {
  it("the general image intake stores `product`, whatever ASSET_TYPES says", () => {
    // Not a guess: `ImageUploadView.post` writes the literal. The generated
    // TypeEnum says "avatar" because the schema is built from the library
    // default of a setting this endpoint never reads.
    expect(targetAssetType({ kind: "image" })).toBe("product");
  });

  it("the avatar intake stores `avatar`, and a typed one stores what it was given", () => {
    expect(targetAssetType({ kind: "avatar" })).toBe("avatar");
    expect(targetAssetType({ kind: "typed", assetType: "review" })).toBe("review");
  });
});

describe("the api surface stops where a browser's rights stop", () => {
  it("carries no refs/sync or random-image operation", () => {
    const api = createCdnApi(
      createCdnRuntime({ baseUrl: "/cdn/api/v1", fetch: mockServer({}).fetch }).client
    );
    // IsServiceRequest and IsStaffUser respectively — a screen that could call
    // them would only ever get a 403.
    expect(api).not.toHaveProperty("syncRefs");
    expect(api).not.toHaveProperty("randomImage");
  });

  it("escapes a caller-supplied asset type into the path", async () => {
    const server = mockServer({
      "/upload/": { status: 201, body: { image: {}, message: "ok" } },
    });
    const runtime = createCdnRuntime({ baseUrl: "/cdn/api/v1", fetch: server.fetch });
    await runtime.api.uploadTypedImage(
      "we ird",
      new File(["x"], "a.jpg", { type: "image/jpeg" })
    );
    expect(server.calls[0]?.url).toContain("/images/we%20ird/upload/");
  });
});

describe("the deployment's ceilings ride on the runtime", () => {
  it("defaults to stapel-cdn's own defaults", () => {
    const runtime = createCdnRuntime({ baseUrl: "/cdn/api/v1" });
    expect(runtime.limits.image.maxBytes).toBe(20 * 1024 * 1024);
    expect(runtime.limits.video.maxBytes).toBe(100 * 1024 * 1024);
  });

  it("takes a host's override", () => {
    const runtime = createCdnRuntime({
      baseUrl: "/cdn/api/v1",
      limits: { image: { maxBytes: 5 } },
    });
    expect(runtime.limits.image.maxBytes).toBe(5);
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(cdnI18nBundleEn["cdn.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerCdnI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["cdn.error.unknown"]).toBeTruthy();
  });
});

describe("zero-flow registry shim", () => {
  it("stapel-cdn annotates no flows, and the surface says so at that shape", () => {
    expect(CDN_FLOWS).toEqual({});
    expect(flowEndpoints("never" as never)).toEqual([]);
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as {
      package: string;
      backend: { module: string; contract: string };
      layers: unknown;
    };
    expect(manifest.package).toBe("@stapel/cdn-react");
    expect(manifest.backend.module).toBe("stapel-cdn");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("declares no nav surface, because it has no screen of its own", () => {
    // cdn-react is a building block: it renders INSIDE somebody else's route
    // (listings' composer, profiles' settings). A nav entry would put an
    // "Uploads" item in a menu that leads nowhere.
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(pkg.exports).not.toHaveProperty("./nav-manifest");
    expect(pkg.exports).not.toHaveProperty("./nav-manifest.json");
  });
});

describe("logout hook (frontend-core-architecture-v2 §43.7 — pair contract)", () => {
  it("registers a logout hook (no-op by default) on the active SessionManager", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const spy = vi.spyOn(manager, "registerLogoutHook");
    createCdnRuntime({ baseUrl: "/cdn/api/v1" });
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(manager.logout()).resolves.toBeUndefined();
  });
});
