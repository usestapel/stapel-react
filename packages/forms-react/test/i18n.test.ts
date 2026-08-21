/**
 * Locale coverage. A key that exists in `en` and not in `ru`/`es` is a screen
 * that silently falls back to English mid-sentence, which is worse than an
 * untranslated app — so the three bundles are pinned to the same key set.
 */
import { describe, expect, it } from "vitest";
import {
  FEATURE_ERROR_KEYS,
  FORMS_ERROR_CODES,
  formsI18nBundleEn,
} from "../src/index.js";
import { formsI18nBundleRu } from "../src/i18n/ru.js";
import { formsI18nBundleEs } from "../src/i18n/es.js";
import { FEATURE_ERROR_CODES } from "../src/widgets/validate.js";

const LOCALES = [
  ["ru", formsI18nBundleRu],
  ["es", formsI18nBundleEs],
] as const;

describe("locale bundles cover the English key set", () => {
  it.each(LOCALES)("%s carries every key en does", (_locale, bundle) => {
    const missing = Object.keys(formsI18nBundleEn).filter(
      (key) => !(key in bundle)
    );
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("%s adds no key en does not have", (_locale, bundle) => {
    const extra = Object.keys(bundle).filter((key) => !(key in formsI18nBundleEn));
    expect(extra).toEqual([]);
  });

  it.each(LOCALES)("%s translates the pair's own UI copy, not just errors", (_locale, bundle) => {
    // A bundle that merely re-exported the generated error map would pass the
    // coverage check above while leaving every button in English.
    const uiKeys = Object.keys(formsI18nBundleEn).filter((k) =>
      k.startsWith("forms.")
    );
    expect(uiKeys.length).toBeGreaterThan(40);
    const untranslated = uiKeys.filter(
      (key) =>
        bundle[key] === formsI18nBundleEn[key] &&
        !IDENTICAL_BY_LANGUAGE.has(key)
    );
    expect(untranslated).toEqual([]);
  });
});

/**
 * Keys whose correct translation genuinely equals the English string, so the
 * "did you actually translate it" check must not flag them. Kept as an
 * explicit, short allowlist rather than a fuzzy heuristic: the alternative is
 * writing a WRONG translation to satisfy a test, which is how "Nó" gets
 * shipped to Spanish speakers.
 *
 * `forms.fill.bool_no` — Spanish for "No" is "No".
 */
const IDENTICAL_BY_LANGUAGE = new Set(["forms.fill.bool_no"]);

describe("the error.400.feature_* family the generated snapshot omits", () => {
  it("is carried by the pair in all three locales", () => {
    // stapel-forms' docs/errors.json holds 63 keys and not one feature_* among
    // them, yet services.py:278 returns exactly these codes for a per-field
    // submit refusal. The pair hand-carries them until the backend's registry
    // snapshot includes the attributes catalogue (spec delta filed).
    expect(FEATURE_ERROR_KEYS.length).toBe(10);
    for (const key of FEATURE_ERROR_KEYS) {
      expect(formsI18nBundleEn[key], `en ${key}`).toBeTruthy();
      expect(formsI18nBundleRu[key], `ru ${key}`).toBeTruthy();
      expect(formsI18nBundleEs[key], `es ${key}`).toBeTruthy();
    }
  });

  it("is genuinely absent from the generated registry — the reason this exists", () => {
    const generatedFeatureKeys = FORMS_ERROR_CODES.filter((code) =>
      code.startsWith("error.400.feature_")
    );
    expect(generatedFeatureKeys).toEqual([]);
  });

  it("covers every code the client-side mirror can raise", () => {
    // The mirror emits the SERVER's keys so both halves render one sentence;
    // a mirror code with no copy would be the one place that breaks down.
    const uncovered = FEATURE_ERROR_CODES.filter(
      (code) => !FEATURE_ERROR_KEYS.includes(code)
    );
    expect(uncovered).toEqual([]);
  });
});

describe("interpolation slots line up across locales", () => {
  it.each(LOCALES)("%s keeps the same {placeholders} as en", (_locale, bundle) => {
    const slots = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
    const mismatched: string[] = [];
    for (const [key, en] of Object.entries(formsI18nBundleEn)) {
      const translated = bundle[key];
      if (typeof en !== "string" || typeof translated !== "string") continue;
      if (slots(en).join(",") !== slots(translated).join(",")) {
        mismatched.push(key);
      }
    }
    // A dropped {count} renders a sentence with a hole in it; an invented one
    // renders a literal "{foo}".
    expect(mismatched).toEqual([]);
  });
});
