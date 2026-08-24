/**
 * Every error code in the registry must resolve to a SENTENCE in all three
 * locales, and every UI key the pair declares must too.
 *
 * `stapel-reviews` ships no `translations/` directory, so 9 of the 51 registry
 * codes have no upstream catalogue and are authored by this pair; the other 42
 * come from stapel-core's own catalogue through the generated bundle. The
 * split is by OWNER, and this suite is what keeps it that way.
 */
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  REVIEWS_ERROR_CODES,
  REVIEWS_I18N_KEYS,
  REVIEWS_I18N_PLURALS,
  registerReviewsI18n,
  reviewsI18nBundleEn,
} from "../src/index.js";
import { registerReviewsI18nRu, reviewsI18nBundleRu } from "../src/i18n/ru.js";
import { registerReviewsI18nEs, reviewsI18nBundleEs } from "../src/i18n/es.js";

const REVIEWS_OWNED = REVIEWS_ERROR_CODES.filter((code) =>
  code.includes("reviews_")
);

function engineFor(locale: "en" | "ru" | "es") {
  const engine = createI18n({ locale });
  registerReviewsI18n(engine);
  if (locale === "ru") registerReviewsI18nRu(engine);
  if (locale === "es") registerReviewsI18nEs(engine);
  return engine;
}

describe.each(["en", "ru", "es"] as const)("locale %s", (locale) => {
  const engine = engineFor(locale);

  it("resolves every backend error code to a sentence, not to the key", () => {
    for (const code of REVIEWS_ERROR_CODES) {
      const text = engine.t(code);
      expect(text, code).not.toBe(code);
      expect(text.length, code).toBeGreaterThan(0);
    }
  });

  it("resolves every UI key the pair declares", () => {
    for (const key of Object.values(REVIEWS_I18N_KEYS)) {
      const text = engine.t(key);
      expect(text, key).not.toBe(key);
    }
  });

  it("resolves every plural family at 1 and at many, in this locale's own forms", () => {
    // Not through `t`: a family has no value of its own, and reaching one
    // through `t` would print the family name on the page. The counts below
    // hit `one` and `other` in en/es and `one`/`many` in ru.
    for (const family of Object.values(REVIEWS_I18N_PLURALS)) {
      for (const count of [1, 12]) {
        const text = engine.tPlural(family, { count });
        expect(text, `${family} @${count}`).not.toBe(family);
        expect(text, `${family} @${count}`).toContain(String(count));
      }
      expect(
        engine.tPlural(family, { count: 1 }),
        `${family} singular differs from plural`
      ).not.toBe(engine.tPlural(family, { count: 12 }).replace("12", "1"));
    }
  });
});

describe("ownership of the nine un-catalogued keys", () => {
  it("the pair authors its own nine in ru and es", () => {
    expect(REVIEWS_OWNED).toHaveLength(9);
    for (const code of REVIEWS_OWNED) {
      expect(reviewsI18nBundleRu[code], code).toBeTruthy();
      expect(reviewsI18nBundleEs[code], code).toBeTruthy();
    }
  });

  it("and the en floor covers them from the registry artifact", () => {
    expect(
      reviewsI18nBundleEn["error.400.reviews_duplicate_review"]
    ).toBeTruthy();
  });
});

describe("interpolation slots survive translation", () => {
  it("keeps {avg}/{max}, {count} and {status} in every locale", () => {
    const slots: Record<string, readonly string[]> = {
      "reviews.rating.value": ["{avg}", "{max}"],
      // The count is a plural FAMILY now, so `other` — the one category every
      // CLDR locale defines — is what a cross-locale check may demand.
      "reviews.rating.count.other": ["{count}"],
      "reviews.status.unknown": ["{status}"],
      "reviews.rating.star_label": ["{index}", "{max}"],
    };
    for (const bundle of [
      reviewsI18nBundleEn,
      reviewsI18nBundleRu,
      reviewsI18nBundleEs,
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
  it("ru and es carry every key en carries under reviews.*", () => {
    // A review form is read word by word; half a translation is worse than
    // either language on its own.
    const uiKeys = Object.keys(reviewsI18nBundleEn).filter((key) =>
      key.startsWith("reviews.")
    );
    for (const key of uiKeys) {
      expect(reviewsI18nBundleRu[key], `ru ${key}`).toBeTruthy();
      expect(reviewsI18nBundleEs[key], `es ${key}`).toBeTruthy();
    }
  });

  it("'no reviews yet' and 'rating 0' are never the same sentence", () => {
    // The pair's central claim, asserted on the copy itself: the empty state
    // says nobody has rated, and nothing in it mentions a zero score.
    for (const bundle of [
      reviewsI18nBundleEn,
      reviewsI18nBundleRu,
      reviewsI18nBundleEs,
    ]) {
      expect(String(bundle["reviews.rating.none"])).not.toContain("0");
    }
  });
});
