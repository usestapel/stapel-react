/**
 * The UI floor: the shared skin substrate's own copy (retry, dismiss,
 * confirm, cancel, the empty-state default, the unfilled-slot placeholder)
 * is seeded by `createI18n` in every locale core ships, under every locale a
 * host asks for, and is overridable the way every floor is.
 */
import { describe, expect, it } from "vitest";
import { createI18n } from "../src/i18n.js";
import { CORE_UI_LOCALES, STAPEL_UI_KEYS, coreUiBundle } from "../src/i18n/coreUi.js";
import { CORE_ERROR_LOCALES, coreErrorBundle } from "../src/i18n/coreErrors.js";

describe("core's UI floor", () => {
  it("ships en, ru and es — the three locales the fleet's skins must speak", () => {
    expect([...CORE_UI_LOCALES].sort()).toEqual(["en", "es", "ru"]);
    expect([...CORE_ERROR_LOCALES].sort()).toEqual(["en", "es", "ru"]);
  });

  it("has every key in every locale, and no locale invents an extra one", () => {
    const keys = Object.values(STAPEL_UI_KEYS).sort();
    for (const locale of CORE_UI_LOCALES) {
      expect(Object.keys(coreUiBundle(locale)).sort(), locale).toEqual(keys);
    }
    // The error floor is held to the same parity now that it has three sides.
    const enErrors = Object.keys(coreErrorBundle("en")).sort();
    for (const locale of CORE_ERROR_LOCALES) {
      expect(Object.keys(coreErrorBundle(locale)).sort(), locale).toEqual(enErrors);
    }
  });

  it("is seeded by createI18n with no host wiring, in the host's locale", () => {
    for (const locale of ["en", "ru", "es"]) {
      const engine = createI18n({ locale });
      expect(engine.t(STAPEL_UI_KEYS.retry)).toBe(coreUiBundle(locale)[STAPEL_UI_KEYS.retry]);
      expect(engine.t(STAPEL_UI_KEYS.cancel)).not.toBe(STAPEL_UI_KEYS.cancel);
    }
  });

  it("degrades a regional or unknown locale to its base language, then English", () => {
    expect(coreUiBundle("es-MX")).toEqual(coreUiBundle("es"));
    expect(coreUiBundle("ja")).toEqual(coreUiBundle("en"));
    const engine = createI18n({ locale: "ja" });
    expect(engine.t(STAPEL_UI_KEYS.retry)).toBe("Try again");
  });

  it("interpolates the slot name into the placeholder sentence", () => {
    const engine = createI18n({ locale: "en" });
    expect(engine.t(STAPEL_UI_KEYS.slotUnfilled, { name: "renderCategoryPicker" })).toContain(
      "renderCategoryPicker"
    );
  });

  it("is a floor: a bundle registered later wins on the same key", () => {
    const engine = createI18n({ locale: "en" });
    engine.registerBundle("en", { [STAPEL_UI_KEYS.retry]: "Retry now" });
    expect(engine.t(STAPEL_UI_KEYS.retry)).toBe("Retry now");
    // …and the other keys are untouched by the override.
    expect(engine.t(STAPEL_UI_KEYS.cancel)).toBe("Cancel");
  });
});
