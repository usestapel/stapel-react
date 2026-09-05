/**
 * Every error code in the registry must resolve to a SENTENCE in all three
 * locales — with the twelve `stapel_attributes` keys coming from the package
 * that owns them.
 *
 * That last clause is the test's whole reason for existing. `stapel-listings`
 * ships no `translations/` directory, so 22 of the 64 registry codes have no
 * upstream catalogue; they split by OWNER, and this pair authors only its own
 * ten. If a future edit copied attributes' twelve in here "to make the test
 * pass", one refusal would have two sentences and they would drift. So the
 * assertion is over the UNION of the two bundles a host actually registers.
 */
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import { registerAttributesI18n } from "@stapel/attributes-react";
import { registerAttributesI18nRu } from "@stapel/attributes-react/i18n/ru";
import { registerAttributesI18nEs } from "@stapel/attributes-react/i18n/es";
import {
  LISTINGS_ERROR_CODES,
  LISTINGS_I18N_KEYS,
  registerListingsI18n,
} from "../src/index.js";
import { listingsI18nBundleRu, registerListingsI18nRu } from "../src/i18n/ru.js";
import { listingsI18nBundleEs, registerListingsI18nEs } from "../src/i18n/es.js";

/** The codes `stapel_listings.errors` registers — everything under a
 * listing-shaped slug, plus the two the module owns without the word.
 *
 * The last two arrived with the 0.17 contract pin and are here for the reason
 * the list exists at all: they reached the registry with English only, and
 * the assertions below are what turned that into a red test instead of two
 * refusals a Russian seller reads in English. */
const LISTINGS_OWNED = [
  "error.400.category_required",
  "error.400.image_required",
  "error.400.listing_feature_not_allowed",
  "error.400.listing_invalid_status_filter",
  "error.400.listing_location_required",
  "error.400.listing_zero_price_not_allowed",
  "error.400.publish_validation_failed",
  "error.403.listing_not_owner",
  "error.404.listing_not_found",
  "error.409.already_favorited",
  "error.409.invalid_listing_transition",
  "error.409.listing_cannot_delete_active",
];

const ATTRIBUTES_OWNED = LISTINGS_ERROR_CODES.filter(
  (code) =>
    code.startsWith("error.400.feature_") ||
    code === "error.400.description_too_short" ||
    code === "error.400.description_too_long"
);

function engineFor(locale: "en" | "ru" | "es") {
  const engine = createI18n({ locale });
  registerAttributesI18n(engine);
  registerListingsI18n(engine);
  if (locale === "ru") {
    registerAttributesI18nRu(engine);
    registerListingsI18nRu(engine);
  }
  if (locale === "es") {
    registerAttributesI18nEs(engine);
    registerListingsI18nEs(engine);
  }
  return engine;
}

describe.each(["en", "ru", "es"] as const)("locale %s", (locale) => {
  const engine = engineFor(locale);

  it("resolves every backend error code to a sentence, not to the key", () => {
    for (const code of LISTINGS_ERROR_CODES) {
      const text = engine.t(code);
      expect(text, code).not.toBe(code);
      expect(text.length, code).toBeGreaterThan(0);
    }
  });

  it("resolves every UI key the pair declares", () => {
    for (const key of Object.values(LISTINGS_I18N_KEYS)) {
      const text = engine.t(key);
      expect(text, key).not.toBe(key);
    }
  });
});

describe("ownership of the twenty-three un-catalogued keys", () => {
  it("the registry really does carry every module-owned code", () => {
    for (const code of LISTINGS_OWNED) {
      expect(LISTINGS_ERROR_CODES, code).toContain(code);
    }
    // 13 since stapel-listings 0.10.0: the embedded stapel_attributes
    // registry gained error.400.feature_invalid_rules with the rule grammar.
    expect(ATTRIBUTES_OWNED).toHaveLength(13);
    expect(ATTRIBUTES_OWNED).toContain("error.400.feature_invalid_rules");
  });

  it("the pair authors its own in ru and es", () => {
    for (const code of LISTINGS_OWNED) {
      expect(listingsI18nBundleRu[code], code).toBeTruthy();
      expect(listingsI18nBundleEs[code], code).toBeTruthy();
    }
  });

  it("the pair authors NONE of the thirteen attributes-owned keys", () => {
    // Spec §13.2 note 3: a pair may not own another module's namespace, and
    // two packages must not give one refusal two sentences.
    for (const bundle of [listingsI18nBundleRu, listingsI18nBundleEs]) {
      for (const code of ATTRIBUTES_OWNED) {
        expect(bundle[code], code).toBeUndefined();
      }
    }
  });

  it("ships NO listing content — a title is a seller's, not a library's", () => {
    for (const bundle of [listingsI18nBundleRu, listingsI18nBundleEs]) {
      for (const key of Object.keys(bundle)) {
        expect(key.startsWith("listing.")).toBe(false);
        expect(key.startsWith("category.")).toBe(false);
        expect(key.startsWith("feature.")).toBe(false);
      }
    }
  });
});

describe("the blocked-submit key split (spec §13.2, note 3)", () => {
  it("raises the pair's own sentence, in the pair's own namespace", () => {
    // `@stapel/attributes-react` owns the FACT (`unsupportedTypes`) and its
    // own key; this pair raises its own from the same fact rather than
    // re-deriving the fact or borrowing the other package's namespace.
    expect(LISTINGS_I18N_KEYS.composeBlockedUnsupportedType).toBe(
      "listings.compose.blocked.unsupported_type"
    );
    const engine = engineFor("en");
    const sentence = engine.t(LISTINGS_I18N_KEYS.composeBlockedUnsupportedType);
    expect(sentence).not.toBe(LISTINGS_I18N_KEYS.composeBlockedUnsupportedType);
    // The pair's sentence carries no `{types}` slot: the editor type is this
    // build's vocabulary and reached a seller's screen as `size_grid`.
    expect(sentence).not.toContain("{types}");
    // And the attributes key still resolves — both spellings say the same
    // thing to the same person; neither invents a silent third behaviour.
    expect(
      engine.t("attributes.submit.blocked.unsupported_type", { types: "x" })
    ).not.toBe("attributes.submit.blocked.unsupported_type");
  });
});

describe("the favourites empty-state hint names the actual control", () => {
  // The hint used to say "tap the heart" in every locale while the control it
  // describes is a text button labelled by `cardFavoriteAdd` — a different
  // sentence than the one on the screen. It now quotes that label's own
  // wording, so a person reads the same words twice rather than two
  // descriptions of one control.
  it.each(["en", "ru", "es"] as const)(
    "mentions the %s favorite_add label",
    (locale) => {
      const engine = engineFor(locale);
      const label = engine.t(LISTINGS_I18N_KEYS.cardFavoriteAdd);
      const hint = engine.t(LISTINGS_I18N_KEYS.favoritesEmptyHint);
      expect(hint).toContain(label);
    }
  );
});
