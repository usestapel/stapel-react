import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATEGORIES_ERROR_CODES,
  categoriesQueryKeys,
  catalogKeyOptions,
  categoriesI18nBundleEn,
  createCategoriesApi,
  explainCategoriesError,
  navEntries,
  registerCategoriesI18n,
} from "../src/index.js";
import { createStapelClient } from "@stapel/core";
import { BASE, mockServer } from "./harness.js";
import { FULL_PAGE, FEATURES } from "./fixtures.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(categoriesQueryKeys.all[0]).toBe("categories");
  });

  it("normalizes tree options so undefined and false cannot cache twice", () => {
    expect(catalogKeyOptions()).toEqual(catalogKeyOptions({}));
    expect(catalogKeyOptions({ includeDeleted: false })).toEqual(
      catalogKeyOptions()
    );
    expect(catalogKeyOptions({ includeDeleted: true })).not.toEqual(
      catalogKeyOptions()
    );
  });

  it("keys the catalogue on ONE entry, not on the pages of its walk", () => {
    // The pages of a sync are the implementation of producing one value.
    // Keying them individually would cache the intermediate states of a
    // protocol whose whole point is that they are never shown.
    expect(categoriesQueryKeys.catalog(catalogKeyOptions())).toHaveLength(3);
  });
});

describe("the API surface is the PUBLIC half of the contract", () => {
  const api = createCategoriesApi(
    createStapelClient({ baseUrl: BASE, fetch: mockServer({}).fetch })
  );

  it("exposes exactly the five anonymous reads", () => {
    const methods = Object.keys(api).filter((k) => k !== "client").sort();
    expect(methods).toEqual([
      "carousel",
      "children",
      "features",
      "list",
      "revision",
    ]);
  });

  it("exposes no write, no feature editor and no translation-keys feed", () => {
    // Every non-safe method on this contract is `IsStaffUser` or, for
    // translation-keys, `IsServiceRequest`. A pair that surfaced them would
    // invite a public screen to call something only staff may — and
    // `validate-dto` is a POST, so it is staff-only despite reading like a
    // public helper.
    for (const forbidden of [
      "create",
      "update",
      "destroy",
      "bulkAdd",
      "bulkCommands",
      "undelete",
      "featureEditor",
      "validateDto",
      "validateConfigs",
      "translationKeys",
      "dataJson",
    ]) {
      expect(api).not.toHaveProperty(forbidden);
    }
  });

  it("hits the module's own paths", async () => {
    const server = mockServer({
      "/features/": { body: FEATURES },
      "/categories/carousel/": { body: [] },
      "/categories/revision/": { body: { revision: 7 } },
      "/categories/": { body: FULL_PAGE },
    });
    const wired = createCategoriesApi(
      createStapelClient({ baseUrl: BASE, fetch: server.fetch })
    );
    await wired.list();
    await wired.children(1);
    await wired.carousel();
    await wired.features(1);
    await wired.revision();
    expect(server.calls.map((c) => c.url.replace(BASE, ""))).toEqual([
      "categories/",
      "categories/1/children/",
      "categories/carousel/",
      "categories/1/features/",
      "categories/revision/",
    ]);
  });
});

describe("errors", () => {
  it("carries the whole registry with a remediation each", () => {
    // 63 since stapel-categories 0.7.0: the embedded stapel_attributes
    // registry gained error.400.feature_invalid_rules with the rule grammar.
    expect(CATEGORIES_ERROR_CODES.length).toBe(63);
    expect(CATEGORIES_ERROR_CODES).toContain("error.400.feature_invalid_rules");
    for (const code of CATEGORIES_ERROR_CODES) {
      expect(explainCategoriesError(code)).toBeTruthy();
    }
  });

  it("answers undefined for a code this module does not own", () => {
    expect(explainCategoriesError("error.418.teapot")).toBeUndefined();
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(categoriesI18nBundleEn["categories.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerCategoriesI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["categories.error.unknown"]).toBeTruthy();
  });

  it("ships NO category name — the catalogue is a deployment's content", () => {
    // A library that shipped `category.electronics: "Electronics"` would be
    // guessing at a tree it has never seen.
    for (const key of Object.keys(categoriesI18nBundleEn)) {
      expect(key.startsWith("category.")).toBe(false);
      expect(key.startsWith("feature.")).toBe(false);
    }
  });
});

describe("nav manifest (the pair's public surface)", () => {
  it("declares unique ids under the module namespace", () => {
    const ids = navEntries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("categories.")).toBe(true);
  });

  it("declares surface explicitly on every entry, and both are public", () => {
    for (const entry of navEntries) {
      expect(entry.surface).toBe("public");
      expect(entry.requiresAuth).toBe(false);
    }
  });

  it("claims /c and /c/:slug — and NOT the container's composed landing", () => {
    // `/` is "categories + search" (spec §5.1): a composed route belongs to
    // the container that composes it, and a pair claiming it would decide the
    // landing page of every host that installs it.
    expect(navEntries.map((e) => e.route.path)).toEqual(["/c", "/c/:slug"]);
    expect(navEntries.some((e) => e.route.path === "/")).toBe(false);
  });

  it("keeps the parameterized route out of the menu", () => {
    expect(
      navEntries.find((e) => e.id === "categories.category")?.menuVisibleDefault
    ).toBe(false);
    expect(
      navEntries.find((e) => e.id === "categories.catalog")?.menuVisibleDefault
    ).toBe(true);
  });

  it("every component it names is actually exported from ./default", async () => {
    // Otherwise the failure surfaces only when a container is assembled —
    // two weeks later, in somebody else's repository.
    const skin = (await import("../src/default/index.js")) as Record<
      string,
      unknown
    >;
    for (const entry of navEntries) {
      expect(entry.component?.subpath).toBe("default");
      expect(skin[entry.component?.export ?? ""]).toBeTypeOf("function");
    }
  });

  it("labels every entry with a key the pair's own bundle carries", () => {
    for (const entry of navEntries) {
      expect(categoriesI18nBundleEn[entry.labelKey]).toBeTruthy();
    }
  });

  it("matches the generated nav-manifest.json", () => {
    const emitted = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    expect(emitted.package).toBe("@stapel/categories-react");
    expect(emitted.entries.map((e: { id: string }) => e.id)).toEqual(
      navEntries.map((e) => e.id)
    );
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/categories-react");
    expect(manifest.backend.module).toBe("stapel-categories");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("lists the WHOLE contract, including the staff operations", () => {
    // Nothing is hidden by the surface split: the manifest is the contract,
    // `CategoriesApi` is this pair's slice of it.
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    const ops = Object.keys(manifest.operations);
    expect(ops.length).toBeGreaterThan(20);
    expect(
      ops.some((op) => op.includes("feature_editor") || op.includes("feature-editor"))
    ).toBe(true);
  });
});
