import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ROOT_ID,
  navEntries,
  registerVideoI18n,
  videoI18nBundleEn,
  videoQueryKeys,
} from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(videoQueryKeys.all[0]).toBe("video");
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(videoI18nBundleEn["video.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerVideoI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["video.error.unknown"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    // vitest runs from the package root, so a cwd-relative path is stable
    // across node/jsdom (jsdom's import.meta.url is not a file:// URL).
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/video-react");
    expect(manifest.backend.module).toBe("stapel-video");
    // backend.contract (gen:manifest ← MANIFEST_BACKEND_PYPROJECT): the semver
    // range this surface was generated against — a backend minor bump reddens
    // the drift gate (frontend-core §2.4 / §3.4.2).
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });
});

describe("navigation contract", () => {
  it("declares exactly one screen, under the workspace admin area", () => {
    expect(navEntries.length).toBe(1);
    const entry = navEntries[0];
    expect(entry?.id).toBe("admin.usage");
    expect(entry?.placement).toEqual({
      level: "submenu",
      parentId: ADMIN_ROOT_ID,
    });
  });

  it("names a component that this pair's /default actually exports", async () => {
    const skin = (await import("../src/default/index.js")) as Record<
      string,
      unknown
    >;
    const entry = navEntries[0];
    expect(entry?.component.subpath).toBe("default");
    expect(skin[entry?.component.export ?? ""]).toBeTypeOf("function");
  });

  it("declares its surface explicitly — a session is not a mandate", () => {
    // The pane behind this route answers the uniform 404 to a signed-in
    // person who is not an admin of the workspace, so the axis must never be
    // left to the `requiresAuth ? "member" : "public"` derivation.
    expect(navEntries[0]?.surface).toBe("member");
    expect(navEntries[0]?.requiresAuth).toBe(true);
  });

  it("labels the entry with a KEY that both bundles carry, never a literal", async () => {
    const labelKey = navEntries[0]?.labelKey ?? "";
    const { videoI18nBundleRu } = await import("../src/i18n/ru.js");
    expect(labelKey.startsWith("video.")).toBe(true);
    expect(videoI18nBundleEn[labelKey]).toBeTruthy();
    expect(videoI18nBundleRu[labelKey]).toBeTruthy();
  });

  it("the generated nav-manifest.json matches the source of truth", () => {
    const generated = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    expect(generated.package).toBe("@stapel/video-react");
    expect(generated.entries).toEqual(navEntries);
  });
});
