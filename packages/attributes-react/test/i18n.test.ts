/**
 * Locale parity, and the two claims this package makes about copy:
 *
 *  1. every key it renders exists in every bundle it ships — a locale with a
 *     hole shows a raw key to exactly the people who cannot read the fallback;
 *  2. the twelve engine error keys are carried verbatim from
 *     `stapel_attributes.errors.ATTRIBUTES_ERRORS`, so a refusal caught by the
 *     mirror and one caught by the server are ONE sentence, not two.
 */
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  ATTRIBUTES_ERROR_BUNDLE_EN,
  ATTRIBUTES_I18N_KEYS,
  attributesI18nBundleEn,
  registerAttributesI18n,
} from "../src/i18n/keys.js";
import { attributesI18nBundleRu, registerAttributesI18nRu } from "../src/i18n/ru.js";
import { attributesI18nBundleEs, registerAttributesI18nEs } from "../src/i18n/es.js";
import { ERROR_CODE_TO_KEY, VALIDATION_ERROR_CODES } from "../src/errors.js";

const BUNDLES = {
  en: attributesI18nBundleEn,
  ru: attributesI18nBundleRu,
  es: attributesI18nBundleEs,
};

describe("every key this package renders exists in every locale it ships", () => {
  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    it(`${locale} covers ATTRIBUTES_I18N_KEYS`, () => {
      const missing = Object.values(ATTRIBUTES_I18N_KEYS).filter(
        (key) => bundle[key] === undefined
      );
      expect(missing).toEqual([]);
    });

    it(`${locale} covers every error key a ValidationErrorCode maps to`, () => {
      const keys = [...new Set(VALIDATION_ERROR_CODES.map((c) => ERROR_CODE_TO_KEY[c]))];
      expect(keys.filter((key) => bundle[key] === undefined)).toEqual([]);
    });
  }

  it("the three bundles carry exactly the same key set — no locale has an extra or a hole", () => {
    const en = Object.keys(attributesI18nBundleEn).sort();
    expect(Object.keys(attributesI18nBundleRu).sort()).toEqual(en);
    expect(Object.keys(attributesI18nBundleEs).sort()).toEqual(en);
  });
});

describe("the engine's error catalogue, verbatim", () => {
  it("carries all twelve ATTRIBUTES_ERRORS keys", () => {
    expect(Object.keys(ATTRIBUTES_ERROR_BUNDLE_EN)).toHaveLength(12);
  });

  it("keeps the placeholders the engine's own templates interpolate", () => {
    expect(ATTRIBUTES_ERROR_BUNDLE_EN["error.400.feature_below_minimum"]).toContain("{feature}");
    expect(ATTRIBUTES_ERROR_BUNDLE_EN["error.400.description_too_short"]).toContain(
      "{min_length}"
    );
  });

  it("maps every ValidationErrorCode to a key the bundle actually has", () => {
    for (const code of VALIDATION_ERROR_CODES) {
      expect(attributesI18nBundleEn[ERROR_CODE_TO_KEY[code]]).toBeTypeOf("string");
    }
  });
});

describe("registration order", () => {
  it("a locale bundle overrides the English floor rather than merging under it", () => {
    const i18n = createI18n({ locale: "ru" });
    registerAttributesI18n(i18n);
    registerAttributesI18nRu(i18n);
    expect(i18n.t(ATTRIBUTES_I18N_KEYS.valueNotSet)).toBe("Не указано");
  });

  it("es likewise", () => {
    const i18n = createI18n({ locale: "es" });
    registerAttributesI18n(i18n);
    registerAttributesI18nEs(i18n);
    expect(i18n.t(ATTRIBUTES_I18N_KEYS.boolYes)).toBe("Sí");
  });

  it("keeps developer language out of the copy a person reads (C-DEVCOPY)", () => {
    const i18n = createI18n({ locale: "en" });
    registerAttributesI18n(i18n);
    // Two sentences used to leak our release process and a Python registry
    // identifier into a seller's form: "This build has no editor for the
    // “size_grid” attribute type". Neither interpolates a type any more.
    for (const key of [
      ATTRIBUTES_I18N_KEYS.unsupportedType,
      ATTRIBUTES_I18N_KEYS.valueUnreadable,
    ]) {
      const text = i18n.t(key);
      expect(text).not.toContain("{type}");
      expect(text).not.toContain("build");
    }
  });

  it("names the blocked submit by FEATURE, since that is what is on the screen", () => {
    const i18n = createI18n({ locale: "en" });
    registerAttributesI18n(i18n);
    expect(
      i18n.t(ATTRIBUTES_I18N_KEYS.submitBlockedUnsupportedType, { features: "Size grid" })
    ).toContain("Size grid");
  });
});
