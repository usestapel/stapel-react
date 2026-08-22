import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  SEARCH_ERROR_CODES,
  SEARCH_I18N_KEYS,
  explainSearchError,
  registerSearchI18n,
  searchI18nBundleEn,
} from "../src/index.js";
import { registerSearchI18nRu, searchI18nBundleRu } from "../src/i18n/ru.js";
import { registerSearchI18nEs, searchI18nBundleEs } from "../src/i18n/es.js";

const UI_KEYS = Object.values(SEARCH_I18N_KEYS);

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

  it("layers es the same way", () => {
    const engine = createI18n({ locale: "es" });
    registerSearchI18n(engine);
    registerSearchI18nEs(engine);
    expect(engine.t(SEARCH_I18N_KEYS.resultsPromoted)).toBe("Promocionado");
  });
});
