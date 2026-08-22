/**
 * Every error code in the registry must resolve to a SENTENCE in all three
 * locales — with the twelve `stapel_attributes` keys coming from the package
 * that owns them.
 *
 * That last clause is the test's whole reason for existing. `stapel-categories`
 * ships no `translations/` directory, so 20 of the 62 registry codes have no
 * upstream catalogue; they split by OWNER, and this pair authors only its own
 * eight. If a future edit copied attributes' twelve in here "to make the test
 * pass", one refusal would have two sentences and they would drift. So the
 * assertion is over the UNION of the two bundles a host actually registers.
 */
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
  categoriesI18nBundleEn,
  registerCategoriesI18n,
} from "../src/index.js";
import { categoriesI18nBundleRu, registerCategoriesI18nRu } from "../src/i18n/ru.js";
import { categoriesI18nBundleEs, registerCategoriesI18nEs } from "../src/i18n/es.js";

const CATEGORIES_OWNED = CATEGORIES_ERROR_CODES.filter((c) =>
  c.includes("categories_")
);

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
    for (const key of Object.values(CATEGORIES_I18N_KEYS)) {
      const text = engine.t(key);
      expect(text, key).not.toBe(key);
    }
  });
});

describe("ownership of the twenty un-catalogued keys", () => {
  it("the pair authors its own eight in ru and es", () => {
    expect(CATEGORIES_OWNED).toHaveLength(8);
    for (const code of CATEGORIES_OWNED) {
      expect(categoriesI18nBundleRu[code], code).toBeTruthy();
      expect(categoriesI18nBundleEs[code], code).toBeTruthy();
    }
  });

  it("the pair authors NONE of the twelve attributes-owned keys", () => {
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
    const uiKeys = Object.keys(categoriesI18nBundleEn).filter((k) =>
      k.startsWith("categories.")
    );
    for (const key of uiKeys) {
      expect(categoriesI18nBundleRu[key], `ru ${key}`).toBeTruthy();
      expect(categoriesI18nBundleEs[key], `es ${key}`).toBeTruthy();
    }
  });
});
