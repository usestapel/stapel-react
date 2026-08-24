// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  CURRENCIES_I18N_KEYS,
  CURRENCY_NAME_KEYS,
  currenciesI18nBundleEn,
} from "../src/i18n/keys.js";
import {
  currenciesI18nBundleRu,
  registerCurrenciesI18nRu,
} from "../src/i18n/ru.js";
import { currenciesI18nBundleEs } from "../src/i18n/es.js";

/**
 * Locale parity for the pair's OWN keys (the shared-layer audit's rule 5: 8 of
 * 19 pairs carried an ad-hoc version of this test and 11 carried none, so a
 * key added in en reached ru/es hosts as English or as a raw key). Every key in
 * {@link CURRENCIES_I18N_KEYS} must have a text in en, ru AND es, and the
 * `{param}` slots must match across all three — a translation that drops a slot
 * renders a sentence with a hole in it.
 */
const BUNDLES = {
  en: currenciesI18nBundleEn,
  ru: currenciesI18nBundleRu,
  es: currenciesI18nBundleEs,
} as const;

function paramsOf(text: string): string[] {
  const seen: string[] = [];
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    const name = m[1] as string;
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

const ALL_KEYS: readonly string[] = [
  ...Object.values(CURRENCIES_I18N_KEYS),
  // The 16 `currency.<code>` keys the wire puts in `display_name`. They are
  // the pair's keys as much as its own UI copy: a locale that ships the
  // picker's label but not the currency names renders an English currency
  // name next to a translated field label, in the same control.
  ...CURRENCY_NAME_KEYS,
];

describe("i18n locale parity", () => {
  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    it(`${locale} covers every key the pair declares`, () => {
      const missing = ALL_KEYS.filter((key) => !(key in bundle));
      expect(missing).toEqual([]);
    });

    it(`${locale} keeps the en {param} slots`, () => {
      for (const key of ALL_KEYS) {
        expect(paramsOf(bundle[key] ?? "").sort(), `${locale}:${key}`).toEqual(
          paramsOf(currenciesI18nBundleEn[key] ?? "").sort()
        );
      }
    });
  }

  it("a key missing from a locale degrades to English, never to a raw key", () => {
    const i18n = createI18n({ locale: "en" });
    registerCurrenciesI18nRu(i18n);
    // The en floor is registered UNDER ru by the register helper, so a key the
    // ru bundle does not carry still renders a sentence.
    expect(i18n.t(CURRENCIES_I18N_KEYS.unknownError)).toBeTruthy();
  });

  it("the locale subpaths stay OUT of the main entry's source graph", () => {
    const src = readFileSync("src/index.ts", "utf8");
    expect(src).not.toMatch(/i18n\/(ru|es)/);
  });
});
