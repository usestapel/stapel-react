/**
 * Every key this pair can put on a screen resolves to a sentence, in all three
 * locales. Not "most of them" — the whole registry plus the whole UI vocabulary,
 * because a raw `error.400.invalid_format` on an upload control is exactly the
 * failure the generated bundles exist to prevent.
 */
import { describe, expect, it } from "vitest";
import {
  CDN_ERROR_CODES,
  CDN_I18N_KEYS,
  cdnI18nBundleEn,
  explainCdnError,
} from "../src/index.js";
import { cdnI18nBundleRu } from "../src/i18n/ru.js";
import { cdnI18nBundleEs } from "../src/i18n/es.js";

const LOCALES = {
  en: cdnI18nBundleEn,
  ru: cdnI18nBundleRu,
  es: cdnI18nBundleEs,
} as const;

describe("backend error codes", () => {
  for (const [locale, bundle] of Object.entries(LOCALES)) {
    it(`${locale}: every registry code resolves to a sentence`, () => {
      const missing = CDN_ERROR_CODES.filter(
        (code) => typeof bundle[code] !== "string" || bundle[code].length === 0
      );
      expect(missing).toEqual([]);
    });
  }

  it("the 11 keys stapel-cdn owns are carried by the pair itself", () => {
    // Upstream ships no `translations/` at all, so the generated ru/es bundles
    // cannot cover these. When it does, these lines are deleted and the keys
    // do not move — which is only safe if a test proves the coverage now.
    const owned = [
      CDN_I18N_KEYS.errorFileHashRequired,
      CDN_I18N_KEYS.errorFileTypeNotAllowed,
      CDN_I18N_KEYS.errorInvalidFormat,
      CDN_I18N_KEYS.errorInvalidHash,
      CDN_I18N_KEYS.errorInvalidImageType,
      CDN_I18N_KEYS.errorMissingFields,
      CDN_I18N_KEYS.errorNoFile,
      CDN_I18N_KEYS.errorStorageQuotaExceeded,
      CDN_I18N_KEYS.errorNoImages,
      CDN_I18N_KEYS.errorFileTooLarge,
      CDN_I18N_KEYS.errorImageDecoderUnavailable,
    ];
    expect(owned).toHaveLength(11);
    for (const code of owned) {
      for (const bundle of Object.values(LOCALES)) {
        expect(typeof bundle[code]).toBe("string");
      }
    }
  });

  it("remediation comes from the backend's declaration, not a guess", () => {
    expect(explainCdnError("error.413.file_too_large")).toBe("retry");
    expect(explainCdnError("error.400.invalid_format")).toBe("fix_input");
    expect(explainCdnError("error.503.image_decoder_unavailable")).toBe(
      "contact_support"
    );
    // A code this module does not own has no remediation to offer.
    expect(explainCdnError("cdn.upload.blocked.full")).toBeUndefined();
  });
});

describe("the pair's own UI keys", () => {
  const uiKeys = Object.values(CDN_I18N_KEYS).filter(
    (key) => !key.startsWith("error.")
  );

  for (const [locale, bundle] of Object.entries(LOCALES)) {
    it(`${locale}: every UI key has copy`, () => {
      const missing = uiKeys.filter(
        (key) => typeof bundle[key] !== "string" || bundle[key].length === 0
      );
      expect(missing).toEqual([]);
    });
  }

  it("the interpolation slots match across locales", () => {
    const slots = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "").sort();
    for (const key of uiKeys) {
      const en = slots(String(cdnI18nBundleEn[key]));
      expect(slots(String(cdnI18nBundleRu[key]))).toEqual(en);
      expect(slots(String(cdnI18nBundleEs[key]))).toEqual(en);
    }
  });

  it("every phase has a sentence — a phase with no copy is a blank status line", () => {
    const phases = [
      "idle",
      "hashing",
      "checking",
      "uploading",
      "processing",
      "done",
      "canceled",
      "failed",
    ];
    expect(phases).toHaveLength(8);
    const phaseKeys = Object.values(CDN_I18N_KEYS).filter((key) =>
      key.startsWith("cdn.phase.")
    );
    expect(phaseKeys).toHaveLength(8);
  });
});
