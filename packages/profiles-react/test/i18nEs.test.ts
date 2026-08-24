// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import { PROFILES_ERRORS, PROFILES_ERROR_CODES } from "../src/i18n/errorsMap.js";
import type { ProfilesErrorCode } from "../src/i18n/errorsMap.js";
import {
  PROFILES_I18N_KEYS,
  profilesI18nBundleEn,
  registerProfilesI18n,
} from "../src/i18n/keys.js";
import {
  profilesErrorBundleEs,
  profilesI18nBundleEs,
  registerProfilesI18nEs,
} from "../src/i18n/es.js";

/**
 * The es locale contour of the pair (i18n-shipping.md §2/§3). Mirrors the ru
 * contour with ONE deliberate inversion: Spanish covers the backend error
 * registry completely but the pair-owned UI keys only PARTIALLY, so the
 * UI-coverage suite asserts both halves key by key — a key the es bundle
 * carries resolves to its Spanish text, a key it does not resolves to its
 * ENGLISH text (never to a raw key). Partial coverage as a declared, tested
 * state rather than an accident.
 */

const PKG_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function paramsOf(text: string): string[] {
  const seen: string[] = [];
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    const name = m[1] as string;
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

/** First registry code carrying `{param}` slots — kept dynamic so the test
 *  survives the registry changing shape under it. */
function codeWithParams(): ProfilesErrorCode {
  for (const code of PROFILES_ERROR_CODES) {
    if (PROFILES_ERRORS[code].params.length > 0) return code;
  }
  throw new Error("no param-bearing error code in the registry");
}

/** First registry code with no interpolation — safe to compare verbatim. */
function codeWithoutParams(): ProfilesErrorCode {
  for (const code of PROFILES_ERROR_CODES) {
    if (PROFILES_ERRORS[code].params.length === 0) return code;
  }
  throw new Error("no param-free error code in the registry");
}

describe("generated es error bundle", () => {
  it("covers exactly the backend registry (every code, nothing else)", () => {
    expect(Object.keys(profilesErrorBundleEs).sort()).toEqual(
      [...PROFILES_ERROR_CODES].sort()
    );
  });

  it("every es text preserves the canon's {param} slots", () => {
    for (const code of PROFILES_ERROR_CODES) {
      expect(paramsOf(profilesErrorBundleEs[code]).sort(), code).toEqual(
        [...PROFILES_ERRORS[code].params].sort()
      );
    }
  });

  it("param-bearing keys interpolate in es", async () => {
    const code = codeWithParams();
    const params = Object.fromEntries(
      PROFILES_ERRORS[code].params.map((name, i) => [name, `v${i}`])
    );
    const i18n = createI18n({ locale: "en" });
    registerProfilesI18nEs(i18n);
    await i18n.setLocale("es");
    const text = i18n.t(code, params);
    for (const name of PROFILES_ERRORS[code].params) {
      expect(text).not.toContain(`{${name}}`);
    }
    expect(text).toContain("v0");
  });
});

describe("declared coverage: Spanish errors, partly-Spanish UI (no raw keys)", () => {
  it("every registry code resolves to its SPANISH text under locale es", async () => {
    const i18n = createI18n({ locale: "en" });
    registerProfilesI18nEs(i18n);
    await i18n.setLocale("es");
    const code = codeWithoutParams();
    expect(i18n.t(code)).toBe(profilesErrorBundleEs[code]);
  });

  it("a pair-owned UI key resolves to its SPANISH text where the bundle has one, to ENGLISH where it does not — never to a raw key", async () => {
    // The inversion of the ru suite: Spanish UI copy is partial, so the en
    // floor under the locale is what a host reads for every key the es bundle
    // does not carry. Both halves are asserted, so adding es copy for a key is
    // a one-line change here and forgetting the en floor is still a failure.
    const i18n = createI18n({ locale: "en" });
    registerProfilesI18n(i18n);
    registerProfilesI18nEs(i18n);
    await i18n.setLocale("es");
    for (const key of Object.values(PROFILES_I18N_KEYS)) {
      const expected = profilesI18nBundleEs[key] ?? profilesI18nBundleEn[key] ?? "";
      expect(i18n.t(key), key).toBe(expected);
      expect(i18n.t(key), key).not.toBe(key);
    }
  });

  it("the es bundle carries the whole error registry plus only pair-owned UI keys", () => {
    const uiKeys = new Set<string>(Object.values(PROFILES_I18N_KEYS));
    const codes = new Set<string>(PROFILES_ERROR_CODES);
    // Nothing in the bundle that is neither a registry code nor a key this
    // pair owns — a typo'd key would otherwise sit there translating nothing.
    const stray = Object.keys(profilesI18nBundleEs).filter(
      (k) => !codes.has(k) && !uiKeys.has(k)
    );
    expect(stray).toEqual([]);
    // The error registry is still covered completely.
    const carriedCodes = Object.keys(profilesI18nBundleEs).filter((k) => codes.has(k));
    expect(carriedCodes.sort()).toEqual([...PROFILES_ERROR_CODES].sort());
    // The UI keys that DO have Spanish copy today — an explicit inventory, so
    // adding or losing one is a deliberate edit rather than silent drift.
    const carriedUi = Object.keys(profilesI18nBundleEs).filter((k) => uiKeys.has(k));
    expect(carriedUi.sort()).toEqual([PROFILES_I18N_KEYS.actionClose]);
  });
});

describe("locale switching through the core engine", () => {
  it("setLocale('es') switches error texts; back to en restores them", async () => {
    const code = codeWithoutParams();
    const i18n = createI18n({ locale: "en" });
    registerProfilesI18n(i18n); // en floor + polish under "en"
    registerProfilesI18nEs(i18n); // es locale from the subpath

    expect(i18n.t(code)).toBe(profilesI18nBundleEn[code] ?? i18n.t(code));
    await i18n.setLocale("es");
    expect(i18n.t(code)).toBe(profilesErrorBundleEs[code]);
    await i18n.setLocale("en");
    expect(i18n.t(code)).not.toBe(profilesErrorBundleEs[code]);
  });

  it("a host bundle registered AFTER the pair's es wins (override without a fork)", async () => {
    const code = codeWithoutParams();
    const i18n = createI18n({ locale: "en" });
    registerProfilesI18nEs(i18n);
    i18n.registerBundle("es", { [code]: "Texto propio" });
    await i18n.setLocale("es");
    expect(i18n.t(code)).toBe("Texto propio");
  });
});

describe("tree-shake purity: es is NOT in the main entry", () => {
  it("dist/index.js module graph never reaches the es modules", () => {
    const entry = resolve(PKG_DIR, "dist/index.js");
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(
        /(?:^|\n)\s*(?:import|export)[^"']*from\s*["'](\.[^"']+)["']/g
      )) {
        queue.push(resolve(dirname(file), m[1] as string));
      }
    }
    const leaked = [...seen].filter((f) => /i18n\/(es|generated\/errors\.es)/.test(f));
    expect(leaked).toEqual([]);
    expect(seen.size).toBeGreaterThan(5);
  });

  it("index.ts source does not import the es subpath", () => {
    const src = readFileSync(resolve(PKG_DIR, "src/index.ts"), "utf8");
    expect(src).not.toMatch(/i18n\/es/);
    expect(src).not.toMatch(/errors\.es\.gen/);
  });
});
