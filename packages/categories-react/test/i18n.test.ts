/**
 * Every error code in the registry must resolve to a SENTENCE in all three
 * locales — with the thirteen `stapel_attributes` keys coming from the package
 * that owns them, and the nine `stapel_categories` ones coming from the
 * MODULE, not from this pair.
 *
 * Both clauses exist for the same reason: a refusal with two sentences drifts.
 *
 *  - stapel-categories 0.21.5 ships `translations/errors.ru.json` / `.es.json`,
 *    so the nine codes it owns now arrive through the generated spread. The
 *    nine strings this pair used to author beside them are deleted, and
 *    `authoredErrorKeys` below is the gate that keeps them deleted — a
 *    key-set-only check would stay green with the duplicate back in place,
 *    because the key resolves either way.
 *  - the thirteen `stapel_attributes` codes stay with
 *    `@stapel/attributes-react`. If a future edit copied them in here "to make
 *    the test pass", one refusal would have two sentences. So the resolution
 *    assertion is over the UNION of the two bundles a host actually registers.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  registerAttributesI18n,
} from "@stapel/attributes-react";
import { registerAttributesI18nRu } from "@stapel/attributes-react/i18n/ru";
import { registerAttributesI18nEs } from "@stapel/attributes-react/i18n/es";
import {
  CATEGORIES_ERROR_CODES,
  CATEGORIES_I18N_KEYS,
  CATEGORIES_I18N_PLURAL_KEYS,
  categoriesI18nBundleEn,
  registerCategoriesI18n,
} from "../src/index.js";
import { categoriesI18nBundleRu, registerCategoriesI18nRu } from "../src/i18n/ru.js";
import { categoriesI18nBundleEs, registerCategoriesI18nEs } from "../src/i18n/es.js";

const CATEGORIES_OWNED = CATEGORIES_ERROR_CODES.filter((c) =>
  c.includes("categories_")
);

/** The `error.*` keys a locale file writes BY HAND. The generated bundle
 * arrives as a spread, so it contributes no literal key here — which is
 * exactly what makes this readable as "what did the pair author". Since the
 * 0.21.5 pin the answer is: nothing. */
function authoredErrorKeys(locale: "ru" | "es"): string[] {
  // Resolved from the package root (`process.cwd()`), where both `vitest`
  // and `turbo run test` start: under jsdom `import.meta.url` is a blob-ish
  // URL and `../src` off it lands at the filesystem root.
  const src = readFileSync(resolve(process.cwd(), `src/i18n/${locale}.ts`), "utf8");
  return [...src.matchAll(/^\s*"(error\.[^"]+)":/gm)]
    .map((m) => m[1] as string)
    .sort();
}

/** Families are catalogued per CLDR form, so they have no flat key to resolve. */
const PLURAL_FAMILIES = new Set<string>(CATEGORIES_I18N_PLURAL_KEYS);
const FLAT_UI_KEYS = Object.values(CATEGORIES_I18N_KEYS).filter(
  (key) => !PLURAL_FAMILIES.has(key)
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

function engineFor(locale: "en" | "ru" | "es") {
  const engine = createI18n({ locale });
  registerAttributesI18n(engine);
  registerCategoriesI18n(engine);
  if (locale === "ru") {
    registerAttributesI18nRu(engine);
    registerCategoriesI18nRu(engine);
  }
  if (locale === "es") {
    registerAttributesI18nEs(engine);
    registerCategoriesI18nEs(engine);
  }
  return engine;
}

describe.each(["en", "ru", "es"] as const)("locale %s", (locale) => {
  const engine = engineFor(locale);

  it("resolves every backend error code to a sentence, not to the key", () => {
    for (const code of CATEGORIES_ERROR_CODES) {
      const text = engine.t(code);
      expect(text, code).not.toBe(code);
      expect(text.length, code).toBeGreaterThan(0);
    }
  });

  it("resolves every UI key the pair declares", () => {
    for (const key of FLAT_UI_KEYS) {
      const text = engine.t(key);
      expect(text, key).not.toBe(key);
    }
  });

  it("carries every plural form this locale can select", () => {
    // The flat family key stays ABSENT on purpose: it is the shape that
    // renders one ending for every number, which in ru is wrong for 1-4.
    const bundle =
      locale === "en"
        ? categoriesI18nBundleEn
        : locale === "ru"
          ? categoriesI18nBundleRu
          : categoriesI18nBundleEs;
    for (const family of CATEGORIES_I18N_PLURAL_KEYS) {
      expect(bundle[family], family).toBeUndefined();
      for (const category of selectableCategories(locale)) {
        expect(bundle[`${family}.${category}`], `${family}.${category}`).toBeTruthy();
      }
      const text = engine.tPlural(family, { count: 3 });
      expect(text, family).not.toBe(family);
      expect(text, family).toContain("3");
    }
  });
});

describe("ownership of the twenty-two module- and library-owned keys", () => {
  it("the module's own catalogue covers all nine, in ru and es", () => {
    expect(CATEGORIES_OWNED).toHaveLength(9);
    for (const code of CATEGORIES_OWNED) {
      expect(categoriesI18nBundleRu[code], code).toBeTruthy();
      expect(categoriesI18nBundleEs[code], code).toBeTruthy();
    }
  });

  it("and the pair re-authors none of them", () => {
    // The point of the 0.21.5 pin: one string, one source. A re-added
    // hand-written copy would leave the assertion above green and drift from
    // upstream on the next backend reword — so this one is over the FILE.
    for (const locale of ["ru", "es"] as const) {
      expect(authoredErrorKeys(locale), locale).toEqual([]);
    }
  });

  it("the pair authors NONE of the thirteen attributes-owned keys", () => {
    // §13.2 note 3: a pair may not own another module's namespace, and two
    // pairs must not give one refusal two sentences.
    for (const bundle of [categoriesI18nBundleRu, categoriesI18nBundleEs]) {
      for (const key of Object.keys(bundle)) {
        expect(key.startsWith("error.400.feature_")).toBe(false);
        expect(key.startsWith("error.400.description_too_")).toBe(false);
      }
    }
  });

  it("but the en floor covers them, because English comes from the registry", () => {
    expect(
      categoriesI18nBundleEn["error.400.feature_mandatory_missing"]
    ).toBeTruthy();
  });
});

describe("interpolation slots survive translation", () => {
  it("keeps {slug}, {reason}, {expected}/{actual} in every locale", () => {
    const slots: Record<string, readonly string[]> = {
      "error.400.categories_duplicate_slug": ["{slug}"],
      "error.400.categories_feature_editor_invalid": ["{reason}"],
      "error.409.categories_feature_editor_conflict": ["{expected}", "{actual}"],
      "categories.catalog.as_of": ["{revision}"],
      "categories.picker.selected": ["{category}"],
    };
    for (const bundle of [
      categoriesI18nBundleEn,
      categoriesI18nBundleRu,
      categoriesI18nBundleEs,
    ]) {
      for (const [key, expected] of Object.entries(slots)) {
        const text = String(bundle[key]);
        for (const slot of expected) {
          expect(text, `${key} in one of the bundles`).toContain(slot);
        }
      }
    }
  });
});

describe("the three bundles cover the same UI keys", () => {
  it("ru and es carry every key en carries under categories.*", () => {
    // A half-translated catalogue menu above a translated search is worse
    // than either.
    const uiKeys = Object.keys(categoriesI18nBundleEn).filter(
      (k) =>
        k.startsWith("categories.") &&
        // Plural forms are covered by the per-locale test above: `en` has two
        // and `ru` has four, so key-for-key parity is the WRONG assertion.
        ![...PLURAL_FAMILIES].some((family) => k.startsWith(`${family}.`))
    );
    for (const key of uiKeys) {
      expect(categoriesI18nBundleRu[key], `ru ${key}`).toBeTruthy();
      expect(categoriesI18nBundleEs[key], `es ${key}`).toBeTruthy();
    }
  });
});
