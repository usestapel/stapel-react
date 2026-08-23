import { describe, expect, it } from "vitest";
import {
  GDPR_ERROR_CODES,
  GDPR_I18N_KEYS,
  gdprI18nBundleEn,
} from "../src/index.js";
import { gdprErrorBundleRu, gdprI18nBundleRu } from "../src/i18n/ru.js";

/** The 15 codes stapel_gdpr owns — the ones a sibling module cannot supply. */
const OWNED = GDPR_ERROR_CODES.filter((code) => code.includes(".gdpr."));

describe("both locales carry every key this pair renders", () => {
  it.each([
    ["en", gdprI18nBundleEn],
    ["ru", gdprI18nBundleRu],
  ])("%s covers every GDPR_I18N_KEY", (_locale, bundle) => {
    const missing = Object.values(GDPR_I18N_KEYS).filter(
      (key) => !(key in bundle)
    );
    expect(missing).toEqual([]);
  });

  it.each([
    ["en", gdprI18nBundleEn],
    ["ru", gdprI18nBundleRu],
  ])("%s covers every backend error code", (_locale, bundle) => {
    const missing = GDPR_ERROR_CODES.filter((code) => !(code in bundle));
    expect(missing).toEqual([]);
  });
});

/**
 * The generated ru bundle is COMPLETE here, unlike in most pairs.
 *
 * stapel-gdpr ships `translations/errors.{ru,es}.json` covering all fifteen
 * keys it owns, and stapel-core supplies the forty-two cross-cutting ones — so
 * `gen:errors` runs with no `ERRORS_LOCALE_EXEMPT_OWNERS` and the pair authors
 * NOTHING to paper over a missing catalogue (contrast @stapel/video-react and
 * @stapel/chat-react, whose modules ship no `translations/` at all and whose
 * ru bundles are `Partial`). If upstream ever prunes its catalogue, the
 * generator emits a Partial bundle and these two assertions go red — which is
 * the point: the gap would otherwise surface as a raw key on a screen about
 * deletion.
 */
describe("the fifteen keys stapel-gdpr owns are GENERATED, not hand-authored", () => {
  it("finds all fifteen", () => {
    expect(OWNED.length).toBe(15);
  });

  it("the generated ru bundle carries every one of them", () => {
    const missing = OWNED.filter((code) => !(code in gdprErrorBundleRu));
    expect(missing).toEqual([]);
  });

  it("the generated ru bundle covers the whole registry, not a subset", () => {
    expect(Object.keys(gdprErrorBundleRu).length).toBe(GDPR_ERROR_CODES.length);
  });
});

/**
 * The deliberate overrides. Two of this module's 404s are not failures at all,
 * and the model layer folds them into `null` — so the folded arm's copy and the
 * raw-error copy must be the SAME sentence in each locale, or a host that
 * renders the error itself contradicts the screen beside it.
 */
describe("the two 404s that mean 'you are fine' read as reassurance", () => {
  it.each([
    ["en", gdprI18nBundleEn],
    ["ru", gdprI18nBundleRu],
  ])("%s: the closure 404 says the same thing as the screen", (_l, bundle) => {
    expect(bundle["error.404.gdpr.no_active_closure"]).toBe(
      bundle[GDPR_I18N_KEYS.closureNone]
    );
  });

  it.each([
    ["en", gdprI18nBundleEn],
    ["ru", gdprI18nBundleRu],
  ])("%s: the export 404 says the same thing as the screen", (_l, bundle) => {
    expect(bundle["error.404.gdpr.export_not_found"]).toBe(
      bundle[GDPR_I18N_KEYS.exportNone]
    );
  });

  it.each([
    ["en", gdprI18nBundleEn, "not scheduled"],
    ["ru", gdprI18nBundleRu, "не запланирован"],
  ])("%s never reads as a lost request", (_l, bundle, needle) => {
    const text = String(bundle["error.404.gdpr.no_active_closure"]);
    expect(text.toLowerCase()).toContain(String(needle).toLowerCase());
    // The registry's own text is about a REQUEST that does not exist ("No
    // pending account closure found"), which on the screen a person opens to
    // ask whether their account is being deleted reads as "your request
    // vanished". The override exists to refuse exactly that reading.
    expect(text.toLowerCase()).not.toContain("not found");
    expect(text.toLowerCase()).not.toContain("не найден");
  });
});

/**
 * A screen about deletion states a DATE, never a duration: a date is checkable
 * against the row and against a calendar, and it is the instant the sweep task
 * will actually act on. These are the keys where the temptation is highest.
 */
describe("deadlines are stated as dates the server computed", () => {
  it.each([
    ["en", gdprI18nBundleEn],
    ["ru", gdprI18nBundleRu],
  ])("%s interpolates {date} rather than counting down", (_l, bundle) => {
    for (const key of [
      GDPR_I18N_KEYS.closureScheduled,
      GDPR_I18N_KEYS.closureConfirmBody,
      GDPR_I18N_KEYS.dsarAckBy,
      GDPR_I18N_KEYS.dsarResolveBy,
      GDPR_I18N_KEYS.exportExpires,
    ]) {
      expect(String(bundle[key]), key).toContain("{date}");
    }
  });

  it.each([
    ["en", gdprI18nBundleEn],
    ["ru", gdprI18nBundleRu],
  ])("%s keeps the two erasure clocks as two different sentences", (_l, bundle) => {
    expect(bundle[GDPR_I18N_KEYS.deletionsColumnDue]).not.toBe(
      bundle[GDPR_I18N_KEYS.deletionsColumnFullyErased]
    );
    expect(String(bundle[GDPR_I18N_KEYS.deletionsFullyErasedHint]).length)
      .toBeGreaterThan(0);
  });
});
