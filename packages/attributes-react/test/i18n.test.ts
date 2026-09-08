/**
 * Locale parity, and the two claims this package makes about copy:
 *
 *  1. every key it renders exists in every bundle it ships — a locale with a
 *     hole shows a raw key to exactly the people who cannot read the fallback;
 *  2. the thirteen engine error keys come from
 *     `stapel_attributes.errors.ATTRIBUTES_ERRORS` — GENERATED from the
 *     library's own `docs/errors.json` and `translations/errors.<lang>.json`
 *     since 0.9.4, in all three languages — so a refusal caught by the mirror
 *     and one caught by the server are ONE sentence, not two.
 *
 * The second claim used to be enforced by reading; it is enforced by
 * construction now, and what is left to assert here is that the pair authors
 * NO error string of its own in any language. `authoredErrorKeys` reads the
 * source files, not the merged bundles: a re-added hand-written copy would
 * pass every key-set check and drift from upstream on the next reword.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import { ATTRIBUTES_ERROR_CODES } from "../src/i18n/generated/errors.gen.js";

/** The codes `stapel_attributes` itself owns — the rest of the registry is
 * core's cross-cutting families, which arrive through the same generated
 * bundles and belong to `@stapel/core`. */
const OWNED = ATTRIBUTES_ERROR_CODES.filter(
  (code) =>
    code.startsWith("error.400.feature_") ||
    code === "error.400.description_too_short" ||
    code === "error.400.description_too_long"
);

/** The `error.*` keys a locale file writes BY HAND. The generated bundle
 * arrives as a spread, so it contributes no literal key here — which is what
 * makes this readable as "what did the pair author". */
function authoredErrorKeys(locale: "ru" | "es" | "keys"): string[] {
  // Resolved from the package root (`process.cwd()`), where both `vitest` and
  // `turbo run test` start.
  const src = readFileSync(resolve(process.cwd(), `src/i18n/${locale}.ts`), "utf8");
  return [...src.matchAll(/^\s*"(error\.[^"]+)":/gm)].map((m) => m[1] as string).sort();
}

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
  it("carries all thirteen ATTRIBUTES_ERRORS keys", () => {
    // Thirteen since 0.5.0: `error.400.feature_invalid_rules`, raised when a
    // feature's `rules` break the closed grammar. The bundle is the whole
    // registry now (13 owned + core's 42 cross-cutting), so the assertion is
    // over the owned slice rather than over the bundle's length.
    expect(OWNED).toHaveLength(13);
    for (const code of OWNED) {
      expect(ATTRIBUTES_ERROR_BUNDLE_EN[code], code).toBeTypeOf("string");
    }
    expect(ATTRIBUTES_ERROR_BUNDLE_EN["error.400.feature_invalid_rules"]).toContain("{feature}");
  });

  it("is generated, not authored — in every language this pair ships", () => {
    // stapel-attributes 0.9.4 emits docs/errors.json, so `pnpm gen:errors`
    // reads the registry and both catalogues directly. The thirteen ru/es
    // lines this pair used to author are gone, and so is the retyped en floor.
    // One refusal, one sentence, one source.
    for (const locale of ["keys", "ru", "es"] as const) {
      expect(authoredErrorKeys(locale), locale).toEqual([]);
    }
  });

  it("the locale bundles carry the owned thirteen from upstream's catalogues", () => {
    for (const bundle of [attributesI18nBundleRu, attributesI18nBundleEs]) {
      for (const code of OWNED) {
        expect(bundle[code], code).toBeTypeOf("string");
      }
    }
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
