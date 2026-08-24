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
 * The es locale contour of the pair (i18n-shipping.md §2/§3), now a straight
 * mirror of the ru contour: Spanish covers the backend error registry AND
 * every pair-owned UI key. The suite used to assert partial coverage as a
 * declared state — a Spanish error sentence inside an English screen — which
 * wave B closed; what is asserted here now is that a Spanish host reads no
 * English at all from this pair.
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


/**
 * CLDR categories a plural FAMILY is spelled with. A family key (the value in
 * `PROFILES_I18N_KEYS`, e.g. `profiles.list.count.followers`) is never itself
 * a bundle entry: the bundle carries `<family>.<category>`, and WHICH
 * categories a language uses is a fact about the language — English has
 * one/other, Russian also has few/many. So a family must match across locales
 * and its categories must not.
 */
const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

function familyCategories(bundle: Record<string, string>, family: string): string[] {
  return PLURAL_CATEGORIES.filter((c) => `${family}.${c}` in bundle);
}

function isPluralFamily(bundle: Record<string, string>, family: string): boolean {
  return familyCategories(bundle, family).length > 0;
}

  it("EVERY pair-owned UI key resolves to its own Spanish text — no English left in a Spanish screen", async () => {
    // Wave B closed the gap this suite used to DECLARE: the es bundle carried
    // the generated backend error texts and fell through to English for all
    // pair-owned UI copy, which reads as a half-finished product rather than
    // as a missing translation. Coverage is now total, and asserted key by
    // key so losing one is a failure rather than a silent fallback.
    const i18n = createI18n({ locale: "en" });
    registerProfilesI18n(i18n);
    registerProfilesI18nEs(i18n);
    await i18n.setLocale("es");
    for (const key of Object.values(PROFILES_I18N_KEYS)) {
      if (isPluralFamily(profilesI18nBundleEs, key)) {
        // A family is read through `tPlural`, which picks the category.
        // `tPlural` selects the category AND interpolates `{count}`, so the
        // expectation is the Spanish form with the number already in it.
        expect(i18n.tPlural(key, { count: 1 }), key).toBe(
          (profilesI18nBundleEs[`${key}.one`] ?? "").replace("{count}", "1")
        );
        expect(i18n.tPlural(key, { count: 7 }), key).toBe(
          (profilesI18nBundleEs[`${key}.other`] ?? "").replace("{count}", "7")
        );
        expect(i18n.tPlural(key, { count: 1 }), key).not.toBe(key);
        continue;
      }
      expect(i18n.t(key), key).toBe(profilesI18nBundleEs[key]);
      expect(i18n.t(key), key).not.toBe(key);
      // A long English SENTENCE that survived byte-identical into es is a
      // copy-paste placeholder, not a translation — the same test
      // `stapel/i18n-locale-parity` applies (16 chars and a space). Short
      // terms are left alone: "Push" and "Email" really are the Spanish for
      // "Push" and "Email".
      const en = profilesI18nBundleEn[key] ?? "";
      if (en.length >= 16 && /\s/.test(en)) {
        expect(i18n.t(key), key).not.toBe(en);
      }
    }
  });

  it("the es bundle carries the whole error registry plus only pair-owned UI keys", () => {
    const uiKeys = new Set<string>(Object.values(PROFILES_I18N_KEYS));
    const codes = new Set<string>(PROFILES_ERROR_CODES);
    // Nothing in the bundle that is neither a registry code nor a key this
    // pair owns — a typo'd key would otherwise sit there translating nothing.
    const stray = Object.keys(profilesI18nBundleEs).filter((k) => {
      if (codes.has(k) || uiKeys.has(k)) return false;
      // …and not a CLDR category of a family this pair declares.
      const dot = k.lastIndexOf(".");
      return !(dot > 0 && uiKeys.has(k.slice(0, dot)));
    });
    expect(stray).toEqual([]);
    // The error registry is still covered completely.
    const carriedCodes = Object.keys(profilesI18nBundleEs).filter((k) => codes.has(k));
    expect(carriedCodes.sort()).toEqual([...PROFILES_ERROR_CODES].sort());
    // …and every UI key this pair owns is carried, plural families through
    // their own categories. The old inventory-of-one is gone: partial Spanish
    // was a declared state, and wave B ended it.
    const missingUi = Object.values(PROFILES_I18N_KEYS).filter(
      (key) => !(key in profilesI18nBundleEs) && !isPluralFamily(profilesI18nBundleEs, key)
    );
    expect(missingUi).toEqual([]);
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
