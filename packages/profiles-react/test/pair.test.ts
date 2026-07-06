import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  profilesQueryKeys,
  profilesI18nBundleEn,
  registerProfilesI18n,
} from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(profilesQueryKeys.all[0]).toBe("profiles");
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(profilesI18nBundleEn["profiles.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerProfilesI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["profiles.error.unknown"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    // vitest runs from the package root, so a cwd-relative path is stable
    // across node/jsdom (jsdom's import.meta.url is not a file:// URL).
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/profiles-react");
    expect(manifest.backend.module).toBe("stapel-profiles");
    // backend.contract (gen:manifest ← MANIFEST_BACKEND_PYPROJECT): the semver
    // range this surface was generated against — a backend minor bump reddens
    // the drift gate (frontend-core §2.4 / §3.4.2).
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });
});
