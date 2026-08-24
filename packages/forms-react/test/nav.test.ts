/**
 * The nav manifest — the pair's contribution to the scripted-fullstack
 * navigation contract.
 *
 * Three failures this file exists to catch, all of which ship silently:
 *
 *  1. a `labelKey` no bundle defines — the shell renders a raw key in a menu;
 *  2. a `component.export` the `/default` barrel does not export — the
 *     container generates a route that does not compile;
 *  3. `nav-manifest.json` drifting from `src/nav/manifest.ts` — the published
 *     artifact is what a scaffold reads, and nothing else re-derives it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { navEntries, ACCOUNT_ROOT_ID } from "../src/nav/manifest.js";
import { formsI18nBundleEn } from "../src/i18n/keys.js";
import { formsI18nBundleRu } from "../src/i18n/ru.js";
import { formsI18nBundleEs } from "../src/i18n/es.js";
import * as skin from "../src/default/index.js";

/** vitest runs with the package as its root, so package-relative is enough —
 * and it does not depend on `import.meta.url` being a file URL, which it is
 * not under every transform. */
function readPackageFile(name: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), name), "utf8"));
}

const pkg = readPackageFile("package.json") as {
  name: string;
  version: string;
};
const published = readPackageFile("nav-manifest.json") as {
  package: string;
  version: string;
  entries: unknown[];
};

describe("nav entries", () => {
  it("declares the three routable admin surfaces", () => {
    expect(navEntries.map((e) => e.id)).toEqual([
      "forms.list",
      "forms.builder",
      "forms.responses",
    ]);
  });

  it("has NO entry for the anonymous fill surface", () => {
    // `<StapelForm>` is embedded by a host at an address the shell does not
    // know and cannot enumerate. A route for it would be a claim this pair
    // cannot honour.
    expect(navEntries.some((e) => e.component.export === "StapelForm")).toBe(
      false
    );
  });

  it("names a labelKey every locale this pair ships can translate", () => {
    for (const entry of navEntries) {
      expect(formsI18nBundleEn[entry.labelKey], entry.id).toBeTruthy();
      expect(formsI18nBundleRu[entry.labelKey], entry.id).toBeTruthy();
      expect(formsI18nBundleEs[entry.labelKey], entry.id).toBeTruthy();
    }
  });

  it("names a component the /default barrel actually exports", () => {
    for (const entry of navEntries) {
      expect(entry.component.subpath).toBe("default");
      expect(
        (skin as Record<string, unknown>)[entry.component.export],
        entry.id
      ).toBeTypeOf("function");
    }
  });

  it("hangs every screen off the container-owned cabinet", () => {
    // `account.root` is synthesised by the container (stapel-tools'
    // NAV_CONTAINER_PARENTS default), so `resolveNav` never drops these the
    // way it drops the fleet's orphaned `admin.root` entries.
    for (const entry of navEntries) {
      expect(entry.placement.level).toBe("submenu");
      expect(entry.placement.parentId).toBe(ACCOUNT_ROOT_ID);
    }
  });

  it("uses RELATIVE route paths, never an API operation path", () => {
    // An absolute "/forms" is byte-for-byte the catalogued
    // `forms_api_v1_forms_create` path; `stapel/no-string-paths` refuses a
    // literal a reader cannot tell apart from an API call.
    for (const entry of navEntries) {
      expect(entry.route.path.startsWith("/")).toBe(false);
    }
  });

  it("keeps the parameterised routes out of the menu", () => {
    for (const entry of navEntries) {
      const parameterised = entry.route.path.includes(":");
      if (parameterised) expect(entry.menuVisibleDefault).toBe(false);
    }
  });

  it("declares surface explicitly on every entry", () => {
    for (const entry of navEntries) {
      expect(entry.surface).toBe("member");
      expect(entry.requiresAuth).toBe(true);
    }
  });
});

describe("the published nav-manifest.json", () => {
  it("matches src/nav/manifest.ts and this package's own version", () => {
    expect(published.package).toBe(pkg.name);
    expect(published.version).toBe(pkg.version);
    expect(published.entries).toEqual(JSON.parse(JSON.stringify(navEntries)));
  });
});
