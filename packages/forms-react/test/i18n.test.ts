/**
 * Locale coverage. A key that exists in `en` and not in `ru`/`es` is a screen
 * that silently falls back to English mid-sentence, which is worse than an
 * untranslated app — so the three bundles are pinned to the same key set.
 */
import { describe, expect, it } from "vitest";
import {
  FEATURE_ERROR_KEYS,
  FORMS_ERROR_CODES,
  formsErrorBundleEn,
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

describe("the stapel_attributes error family", () => {
  it("has English from the registry and pair-authored ru/es", () => {
    // Attributes ships English only — no translations/ directory — so its 12
    // keys can appear in no locale catalog and gen:errors runs for this module
    // with ERRORS_LOCALE_EXEMPT_OWNERS=stapel_attributes. English is
    // authoritative from the artifact; ru/es stay pair-authored until upstream
    // localizes them (stapel-forms MODULE.md §12.6).
    expect(FEATURE_ERROR_KEYS.length).toBe(10);
    for (const key of FEATURE_ERROR_KEYS) {
      expect(formsI18nBundleEn[key], `en ${key}`).toBeTruthy();
      expect(formsI18nBundleRu[key], `ru ${key}`).toBeTruthy();
      expect(formsI18nBundleEs[key], `es ${key}`).toBeTruthy();
    }
  });

  it("now comes FROM the registry — the hand-carried English is gone", () => {
    // The inverse of the test this replaces. stapel-forms 0.1.0 omitted the
    // stapel_attributes family from docs/errors.json while returning those
    // codes, so the pair hand-carried the English; 0.2.0 put them in the
    // contract (75 keys, 12 attributes-owned) and the workaround was deleted.
    // This asserts the family is generated, so nobody re-adds a hand copy.
    const generated = FORMS_ERROR_CODES.filter((code) =>
      code.startsWith("error.400.feature_")
    );
    expect(generated.length).toBe(10);
    for (const code of generated) {
      expect(formsErrorBundleEn[code], code).toBeTruthy();
    }
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
