import { describe, expect, it } from "vitest";
import { VIDEO_ERROR_CODES, VIDEO_I18N_KEYS, videoI18nBundleEn } from "../src/index.js";
import { videoErrorBundleRu, videoI18nBundleRu } from "../src/i18n/ru.js";

/** The 9 codes stapel_video owns — the ones the module ships no locale for. */
const OWNED = VIDEO_ERROR_CODES.filter((code) => code.includes("video_"));

describe("both locales carry every key this pair renders", () => {
  it.each([
    ["en", videoI18nBundleEn],
    ["ru", videoI18nBundleRu],
  ])("%s covers every VIDEO_I18N_KEY", (_locale, bundle) => {
    const missing = Object.values(VIDEO_I18N_KEYS).filter(
      (key) => !(key in bundle)
    );
    expect(missing).toEqual([]);
  });

  it.each([
    ["en", videoI18nBundleEn],
    ["ru", videoI18nBundleRu],
  ])("%s covers every backend error code", (_locale, bundle) => {
    const missing = VIDEO_ERROR_CODES.filter((code) => !(code in bundle));
    expect(missing).toEqual([]);
  });
});

describe("the nine keys stapel-video owns are authored here, not generated", () => {
  it("finds all nine", () => {
    expect(OWNED.length).toBe(9);
  });

  it("the GENERATED ru bundle carries none of them — the module ships no translations/", () => {
    const leaked = OWNED.filter((code) => code in videoErrorBundleRu);
    expect(leaked).toEqual([]);
  });

  it("the pair's own ru bundle carries all nine", () => {
    const missing = OWNED.filter((code) => !(code in videoI18nBundleRu));
    expect(missing).toEqual([]);
  });

  it("the generated ru bundle still covers the cross-cutting core keys", () => {
    // 51 codes total, 9 owned by stapel_video ⇒ 42 come from stapel-core's
    // catalogue via ERRORS_CATALOG_DIR.
    expect(Object.keys(videoErrorBundleRu).length).toBe(
      VIDEO_ERROR_CODES.length - OWNED.length
    );
  });
});

describe("the uniform 404 says one sentence for three situations", () => {
  it.each([
    ["en", videoI18nBundleEn, "not available for this workspace"],
    ["ru", videoI18nBundleRu, "недоступна"],
  ])("%s overrides the registry's bare 'Scope not found'", (_l, bundle, needle) => {
    const text = String(bundle["error.404.video_scope_not_found"]);
    expect(text.toLowerCase()).toContain(String(needle).toLowerCase());
    // It must never read as a claim about the workspace's calls: the same 404
    // is returned when the reader simply may not look.
    expect(text.toLowerCase()).not.toContain("no calls");
  });

  it("matches the screen's own copy, so the two arms cannot drift apart", () => {
    expect(videoI18nBundleEn["error.404.video_scope_not_found"]).toBe(
      videoI18nBundleEn[VIDEO_I18N_KEYS.usageUnavailable]
    );
    expect(videoI18nBundleRu["error.404.video_scope_not_found"]).toBe(
      videoI18nBundleRu[VIDEO_I18N_KEYS.usageUnavailable]
    );
  });
});
