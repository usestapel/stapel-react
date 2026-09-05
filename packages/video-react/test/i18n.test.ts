import { describe, expect, it } from "vitest";
import { VIDEO_ERROR_CODES, VIDEO_I18N_KEYS, videoI18nBundleEn } from "../src/index.js";
import { videoErrorBundleRu, videoI18nBundleRu } from "../src/i18n/ru.js";
import { videoErrorBundleEs, videoI18nBundleEs } from "../src/i18n/es.js";

/** The 9 codes stapel_video owns — the ones the module ships no locale for. */
const OWNED = VIDEO_ERROR_CODES.filter((code) => code.includes("video_"));

/** CLDR categories. Which of them a language uses is a fact about the
 * LANGUAGE: `one`/`other` in English and Spanish, plus `few`/`many` in
 * Russian. So a key is covered when the key itself is present OR the family it
 * names has at least one category in the bundle. */
const CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

function covers(bundle: Record<string, unknown>, key: string): boolean {
  if (key in bundle) return true;
  return CATEGORIES.some((category) => `${key}.${category}` in bundle);
}

const BUNDLES: readonly [string, Record<string, unknown>][] = [
  ["en", videoI18nBundleEn],
  ["ru", videoI18nBundleRu],
  ["es", videoI18nBundleEs],
];

describe("all three locales carry every key this pair renders", () => {
  it.each(BUNDLES)("%s covers every VIDEO_I18N_KEY", (_locale, bundle) => {
    const missing = Object.values(VIDEO_I18N_KEYS).filter(
      (key) => !covers(bundle, key)
    );
    expect(missing).toEqual([]);
  });

  it.each(BUNDLES)("%s covers every backend error code", (_locale, bundle) => {
    const missing = VIDEO_ERROR_CODES.filter((code) => !(code in bundle));
    expect(missing).toEqual([]);
  });

  it.each(BUNDLES)("%s spells both plural families", (_locale, bundle) => {
    // `other` is the one category every language defines, so it is the only
    // one a check may demand.
    for (const family of [
      VIDEO_I18N_KEYS.usageTotalPeople,
      VIDEO_I18N_KEYS.usageTotalAttendances,
      VIDEO_I18N_KEYS.lobbyWaitingCount,
    ]) {
      expect(`${family}.other` in bundle).toBe(true);
    }
  });
});

describe("the keys stapel-video owns are authored here, not generated", () => {
  it("finds all fifteen", () => {
    // Nine from the room lifecycle, six the 1:1 call surface added in the
    // backend's 0.11.0. The count is asserted rather than derived so a key
    // that vanishes from the registry cannot silently stop being checked.
    expect(OWNED.length).toBe(15);
  });

  it.each([
    ["ru", videoErrorBundleRu as Record<string, unknown>],
    ["es", videoErrorBundleEs as Record<string, unknown>],
  ])(
    "the GENERATED %s bundle carries none of them — the module ships no translations/",
    (_locale, generated) => {
      const leaked = OWNED.filter((code) => code in generated);
      expect(leaked).toEqual([]);
    }
  );

  it.each([
    ["ru", videoI18nBundleRu],
    ["es", videoI18nBundleEs],
  ])("the pair's own %s bundle carries all nine", (_locale, bundle) => {
    const missing = OWNED.filter((code) => !(code in bundle));
    expect(missing).toEqual([]);
  });

  it.each([
    ["ru", videoErrorBundleRu as Record<string, unknown>],
    ["es", videoErrorBundleEs as Record<string, unknown>],
  ])(
    "the generated %s bundle still covers the cross-cutting core keys",
    (_locale, generated) => {
      // 51 codes total, 9 owned by stapel_video ⇒ 42 come from stapel-core's
      // catalogue via ERRORS_CATALOG_DIR.
      expect(Object.keys(generated).length).toBe(
        VIDEO_ERROR_CODES.length - OWNED.length
      );
    }
  );
});

describe("the uniform 404 says one sentence for three situations", () => {
  it.each([
    ["en", videoI18nBundleEn, "not available for this workspace"],
    ["ru", videoI18nBundleRu, "недоступна"],
    ["es", videoI18nBundleEs, "no está disponible"],
  ])("%s overrides the registry's bare 'Scope not found'", (_l, bundle, needle) => {
    const text = String(bundle["error.404.video_scope_not_found"]);
    expect(text.toLowerCase()).toContain(String(needle).toLowerCase());
    // It must never read as a claim about the workspace's calls: the same 404
    // is returned when the reader simply may not look.
    expect(text.toLowerCase()).not.toContain("no calls");
  });

  it.each(BUNDLES)(
    "%s matches the screen's own copy, so the two arms cannot drift apart",
    (_locale, bundle) => {
      expect(bundle["error.404.video_scope_not_found"]).toBe(
        bundle[VIDEO_I18N_KEYS.usageUnavailable]
      );
    }
  );
});
