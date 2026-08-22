import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  navEntries,
  registerSearchI18n,
  searchI18nBundleEn,
  searchQueryKeys,
} from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(searchQueryKeys.all[0]).toBe("search");
  });

  it("keys a query on the SAME object the request is built from", () => {
    // If the key were a hand-picked subset, a parameter could change the
    // request and not the key — new filter, cached rows.
    const params = { type: "listing", "f.brand": ["bosch"] } as const;
    expect(searchQueryKeys.query(params)[2]).toBe(params);
  });

  it("normalizes an absent ranking type to null so it cannot cache twice", () => {
    expect(searchQueryKeys.ranking()).toEqual(["search", "ranking", null]);
    expect(searchQueryKeys.ranking(undefined)).toEqual(searchQueryKeys.ranking());
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(searchI18nBundleEn["search.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerSearchI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["search.error.unknown"]).toBeTruthy();
  });
});

describe("nav manifest (the pair's public surface)", () => {
  it("declares unique ids under the module namespace", () => {
    const ids = navEntries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("search.")).toBe(true);
  });

  it("declares surface explicitly on every entry, and both are public", () => {
    // The derivation from `requiresAuth` would agree today; the explicit
    // declaration is what keeps an entry in the anonymous tree if it ever
    // gains an auth requirement for an unrelated reason.
    for (const entry of navEntries) {
      expect(entry.surface).toBe("public");
      expect(entry.requiresAuth).toBe(false);
    }
  });

  it("routes are absolute and parameterless, and neither is a menu item", () => {
    expect(navEntries.map((e) => e.route.path)).toEqual([
      "/s",
      "/ranking-disclosure",
    ]);
    for (const entry of navEntries) expect(entry.menuVisibleDefault).toBe(false);
  });

  it("every component it names is actually exported from ./default", async () => {
    // Otherwise the failure surfaces only when a container is assembled —
    // two weeks later, in somebody else's repository.
    const skin = (await import("../src/default/index.js")) as Record<string, unknown>;
    for (const entry of navEntries) {
      expect(entry.component?.subpath).toBe("default");
      expect(skin[entry.component?.export ?? ""]).toBeTypeOf("function");
    }
  });

  it("labels every entry with a key the pair's own bundle carries", () => {
    for (const entry of navEntries) {
      expect(searchI18nBundleEn[entry.labelKey]).toBeTruthy();
    }
  });

  it("matches the generated nav-manifest.json", () => {
    const emitted = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    expect(emitted.package).toBe("@stapel/search-react");
    expect(emitted.entries.map((e: { id: string }) => e.id)).toEqual(
      navEntries.map((e) => e.id)
    );
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/search-react");
    expect(manifest.backend.module).toBe("stapel-search");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });
});
