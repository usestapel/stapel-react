import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  SEARCH_ERROR_CODES,
  SEARCH_I18N_KEYS,
  SEARCH_I18N_PLURAL_KEYS,
  explainSearchError,
  registerSearchI18n,
  searchI18nBundleEn,
} from "../src/index.js";
import { registerSearchI18nRu, searchI18nBundleRu } from "../src/i18n/ru.js";
import { registerSearchI18nEs, searchI18nBundleEs } from "../src/i18n/es.js";

const PLURAL_KEYS = new Set<string>(SEARCH_I18N_PLURAL_KEYS);
const UI_KEYS = Object.values(SEARCH_I18N_KEYS).filter(
  (key) => !PLURAL_KEYS.has(key)
);

/**
 * The categories a locale can actually SELECT — asked of `Intl.PluralRules`
 * rather than listed here, because "how many forms does this language have"
 * is a fact about the language. A bundle is complete when it carries a
 * message for every form its locale can land on.
 */
function selectableCategories(locale: string): readonly string[] {
  const rules = new Intl.PluralRules(locale);
  const seen = new Set<string>();
  // 0..200 covers every cardinal rule these locales use (ru's `many` needs
  // teens; `other` is reached by a fraction, which is why 0.5 is in here).
  for (const n of [0.5, ...Array.from({ length: 201 }, (_, i) => i)]) {
    seen.add(rules.select(n));
  }
  return [...seen];
}

describe("every key the pair renders has copy in every locale it ships", () => {
  it("en covers the UI keys", () => {
    for (const key of UI_KEYS) expect(searchI18nBundleEn[key]).toBeTruthy();
  });

  it("ru covers the UI keys — it is the storefront's default language", () => {
    for (const key of UI_KEYS) expect(searchI18nBundleRu[key]).toBeTruthy();
  });

  it("es covers the UI keys", () => {
    for (const key of UI_KEYS) expect(searchI18nBundleEs[key]).toBeTruthy();
  });
});

describe("a plural family carries every form its locale can select", () => {
  for (const [locale, bundle] of [
    ["en", searchI18nBundleEn],
    ["ru", searchI18nBundleRu],
    ["es", searchI18nBundleEs],
  ] as const) {
    it(`${locale} covers each category of each family`, () => {
      for (const family of SEARCH_I18N_PLURAL_KEYS) {
        // The flat family key is GONE on purpose: it is the shape the live
        // page rendered as one Russian ending for every number.
        expect(bundle[family]).toBeUndefined();
        for (const category of selectableCategories(locale)) {
          expect(bundle[`${family}.${category}`]).toBeTruthy();
        }
      }
    });
  }
});

describe("the backend error registry reaches every locale", () => {
  it("en carries all generated codes", () => {
    for (const code of SEARCH_ERROR_CODES) {
      expect(searchI18nBundleEn[code]).toBeTruthy();
    }
  });

  it("ru and es carry all generated codes (core's catalogue merged under the module's)", () => {
    for (const code of SEARCH_ERROR_CODES) {
      expect(searchI18nBundleRu[code]).toBeTruthy();
      expect(searchI18nBundleEs[code]).toBeTruthy();
    }
  });

  it("carries the twelve search-owned codes by name", () => {
    for (const code of [
      "error.400.search_bad_cursor",
      "error.400.search_bad_geo",
      "error.400.search_bad_range",
      "error.400.search_query_too_long",
      "error.400.search_sort_needs_center",
      "error.400.search_too_many_facets",
      "error.400.search_too_many_ranges",
      "error.400.search_unknown_doc_type",
      "error.400.search_unknown_sort",
      "error.400.search_window_exceeded",
      "error.403.search_forbidden",
      "error.503.search_backend_unavailable",
    ]) {
      expect(SEARCH_ERROR_CODES).toContain(code);
      expect(explainSearchError(code)).toBeTruthy();
    }
  });

  it("answers `undefined` for a code this module does not own", () => {
    expect(explainSearchError("error.418.teapot")).toBeUndefined();
  });
});

describe("the engine resolves what the pair registers", () => {
  it("layers ru over the en floor", () => {
    const engine = createI18n({ locale: "ru" });
    registerSearchI18n(engine);
    registerSearchI18nRu(engine);
    expect(engine.t(SEARCH_I18N_KEYS.resultsEmpty)).toBe(
      "По этому запросу ничего не нашлось."
    );
    // Interpolation reaches the degradation sentences, which carry the only
    // placeholders a person is likely to see on this surface.
    expect(
      engine.t(SEARCH_I18N_KEYS.degradedScorer, { scorer: "geo_decay" })
    ).toContain("geo_decay");
  });

  it("counts in Russian with the form the number takes, not one ending for all", () => {
    const engine = createI18n({ locale: "ru" });
    registerSearchI18n(engine);
    registerSearchI18nRu(engine);
    const family = SEARCH_I18N_KEYS.resultsCountExact;
    expect(engine.tPlural(family, { count: 1 })).toBe("1 объявление");
    expect(engine.tPlural(family, { count: 3 })).toBe("3 объявления");
    expect(engine.tPlural(family, { count: 17 })).toBe("17 объявлений");
    expect(engine.tPlural(SEARCH_I18N_KEYS.resultsCountApproximate, { count: 21 })).toBe(
      "Примерно 21 объявление"
    );
    // A LOWER BOUND takes the same endings — the "+" is not a word, so the
    // many-form must not come back in the one-form.
    const atLeast = SEARCH_I18N_KEYS.resultsCountAtLeast;
    expect(engine.tPlural(atLeast, { count: 1 })).toBe("1+ объявление");
    expect(engine.tPlural(atLeast, { count: 3 })).toBe("3+ объявления");
    expect(engine.tPlural(atLeast, { count: 1000 })).toBe("1000+ объявлений");
  });

  it("counts in English through the same call", () => {
    const engine = createI18n({ locale: "en" });
    registerSearchI18n(engine);
    expect(engine.tPlural(SEARCH_I18N_KEYS.resultsCountExact, { count: 1 })).toBe(
      "1 result"
    );
    expect(engine.tPlural(SEARCH_I18N_KEYS.resultsCountExact, { count: 4 })).toBe(
      "4 results"
    );
    expect(
      engine.tPlural(SEARCH_I18N_KEYS.resultsCountAtLeast, { count: 1200 })
    ).toBe("1200+ results");
  });

  it("layers es the same way", () => {
    const engine = createI18n({ locale: "es" });
    registerSearchI18n(engine);
    registerSearchI18nEs(engine);
    expect(engine.t(SEARCH_I18N_KEYS.resultsPromoted)).toBe("Promocionado");
  });
});
