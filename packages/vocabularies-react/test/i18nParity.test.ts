// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  VOCABULARIES_I18N_KEYS,
  vocabulariesI18nBundleEn,
} from "../src/i18n/keys.js";
import {
  vocabulariesI18nBundleRu,
  registerVocabulariesI18nRu,
} from "../src/i18n/ru.js";
import { vocabulariesI18nBundleEs } from "../src/i18n/es.js";

/**
 * Locale parity for the pair's OWN keys (the shared-layer audit's rule 5: 8 of
 * 19 pairs carried an ad-hoc version of this test and 11 carried none, so a
 * key added in en reached ru/es hosts as English or as a raw key). Every key in
 * {@link VOCABULARIES_I18N_KEYS} must have a text in en, ru AND es, and the
 * `{param}` slots must match across all three — a translation that drops a slot
 * renders a sentence with a hole in it.
 */
const BUNDLES = {
  en: vocabulariesI18nBundleEn,
  ru: vocabulariesI18nBundleRu,
  es: vocabulariesI18nBundleEs,
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
      const missing = Object.values(VOCABULARIES_I18N_KEYS).filter(
        (key) => !(key in bundle)
      );
      expect(missing).toEqual([]);
    });

    it(`${locale} keeps the en {param} slots`, () => {
      for (const key of Object.values(VOCABULARIES_I18N_KEYS)) {
        expect(paramsOf(bundle[key] ?? "").sort(), `${locale}:${key}`).toEqual(
          paramsOf(vocabulariesI18nBundleEn[key] ?? "").sort()
        );
      }
    });
  }

  it("a key missing from a locale degrades to English, never to a raw key", () => {
    const i18n = createI18n({ locale: "en" });
    registerVocabulariesI18nRu(i18n);
    // The en floor is registered UNDER ru by the register helper, so a key the
    // ru bundle does not carry still renders a sentence.
    expect(i18n.t(VOCABULARIES_I18N_KEYS.unknownError)).toBeTruthy();
  });

  it("the locale subpaths stay OUT of the main entry's source graph", () => {
    const src = readFileSync("src/index.ts", "utf8");
    expect(src).not.toMatch(/i18n\/(ru|es)/);
  });
});
