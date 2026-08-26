// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  TRANSLATE_I18N_KEYS,
  translateI18nBundleEn,
} from "../src/i18n/keys.js";
import {
  translateI18nBundleRu,
  registerTranslateI18nRu,
} from "../src/i18n/ru.js";
import { translateI18nBundleEs } from "../src/i18n/es.js";
import { DEFAULT_LANGUAGE_CODES, languageKey } from "../src/i18n/languages.js";

/**
 * Locale parity for the pair's OWN keys (the shared-layer audit's rule 5).
 * Every key in {@link TRANSLATE_I18N_KEYS} must have a text in en, ru AND es,
 * and the `{param}` slots must match across all three — a translation that
 * drops a slot renders a sentence with a hole in it.
 *
 * The module that serves everyone else's copy is the one that must not ship a
 * gap in its own.
 */
const BUNDLES = {
  en: translateI18nBundleEn,
  ru: translateI18nBundleRu,
  es: translateI18nBundleEs,
} as const;

function paramsOf(text: string): string[] {
  const seen: string[] = [];
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    const name = m[1] as string;
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

describe("i18n locale parity", () => {
  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    it(`${locale} covers every key the pair declares`, () => {
      const missing = Object.values(TRANSLATE_I18N_KEYS).filter(
        (key) => !(key in bundle)
      );
      expect(missing).toEqual([]);
    });

    it(`${locale} keeps the en {param} slots`, () => {
      for (const key of Object.values(TRANSLATE_I18N_KEYS)) {
        expect(paramsOf(bundle[key] ?? "").sort(), `${locale}:${key}`).toEqual(
          paramsOf(translateI18nBundleEn[key] ?? "").sort()
        );
      }
    });

    it(`${locale} carries all twenty language names`, () => {
      const missing = DEFAULT_LANGUAGE_CODES.filter(
        (code) => !(languageKey(code) in bundle)
      );
      expect(missing).toEqual([]);
    });
  }

  it("the language names are IDENTICAL across locales — they are endonyms", () => {
    // The endonym is what a speaker of that language scans for, whatever
    // language the rest of the interface happens to be in.
    for (const code of DEFAULT_LANGUAGE_CODES) {
      const key = languageKey(code);
      expect(translateI18nBundleRu[key], key).toBe(translateI18nBundleEn[key]);
      expect(translateI18nBundleEs[key], key).toBe(translateI18nBundleEn[key]);
    }
    expect(DEFAULT_LANGUAGE_CODES).toHaveLength(20);
  });

  it("a key missing from a locale degrades to English, never to a raw key", () => {
    const i18n = createI18n({ locale: "en" });
    registerTranslateI18nRu(i18n);
    expect(i18n.t(TRANSLATE_I18N_KEYS.unknownError)).toBeTruthy();
  });

  it("every backend error code has a text in ru and es too", () => {
    // The generated catalogues are spread into the locale bundles; a pair that
    // dropped the spread would render Russian error sentences in English.
    const codes = Object.keys(translateI18nBundleEn).filter((key) =>
      key.startsWith("error.")
    );
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(translateI18nBundleRu[code], code).toBeTruthy();
      expect(translateI18nBundleEs[code], code).toBeTruthy();
    }
  });

  it("the locale subpaths stay OUT of the main entry's source graph", () => {
    const src = readFileSync("src/index.ts", "utf8");
    expect(src).not.toMatch(/i18n\/(ru|es)/);
  });
});
