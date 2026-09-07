import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import { BRICK_I18N_KEYS, brickI18nBundleEn, registerBrickI18n } from "../src/index.js";
import { brickI18nBundleRu, registerBrickI18nRu } from "../src/i18n/ru.js";
import { brickI18nBundleEs, registerBrickI18nEs } from "../src/i18n/es.js";

describe("the package's copy", () => {
  it("declares every key it ships and ships every key it declares", () => {
    const declared = new Set<string>(Object.values(BRICK_I18N_KEYS));
    const shipped = new Set(Object.keys(brickI18nBundleEn));
    expect([...declared].filter((k) => !shipped.has(k))).toEqual([]);
    expect([...shipped].filter((k) => !declared.has(k))).toEqual([]);
  });

  it("keeps the three locales at parity", () => {
    const en = Object.keys(brickI18nBundleEn).sort();
    expect(Object.keys(brickI18nBundleRu).sort()).toEqual(en);
    expect(Object.keys(brickI18nBundleEs).sort()).toEqual(en);
  });

  it("translates nothing to an empty string", () => {
    for (const bundle of [brickI18nBundleEn, brickI18nBundleRu, brickI18nBundleEs]) {
      for (const [key, value] of Object.entries(bundle)) {
        expect(value.trim(), key).not.toBe("");
      }
    }
  });

  /**
   * 0.6.0 gave the stepper a second meaning: over a run in progress it moves
   * the LIVE level rather than the level a fresh deal would open at — and on an
   * autostarting console that is the usual case, not the rare one. The
   * accessible name is the whole of what a screen-reader player is told, so it
   * may only claim what is true in both cases: the level, never a starting one.
   */
  it("names the stepper for the level, never for a starting level", () => {
    const startingLevel = /starting|inicial|начальн/i;
    for (const bundle of [brickI18nBundleEn, brickI18nBundleRu, brickI18nBundleEs]) {
      for (const key of [BRICK_I18N_KEYS.buttonLevelUp, BRICK_I18N_KEYS.buttonLevelDown]) {
        expect(bundle[key], key).not.toMatch(startingLevel);
        expect(bundle[key], key).toMatch(/level|nivel|уровень/i);
      }
    }
  });

  it("registers into a core engine, per locale", async () => {
    const engine = createI18n({ locale: "en" });
    registerBrickI18n(engine);
    registerBrickI18nRu(engine);
    registerBrickI18nEs(engine);
    expect(engine.t(BRICK_I18N_KEYS.padStart)).toBe("Start or pause");
    await engine.setLocale("ru");
    expect(engine.t(BRICK_I18N_KEYS.padStart)).toBe(
      brickI18nBundleRu[BRICK_I18N_KEYS.padStart]
    );
    await engine.setLocale("es");
    expect(engine.t(BRICK_I18N_KEYS.padStart)).toBe(
      brickI18nBundleEs[BRICK_I18N_KEYS.padStart]
    );
  });
});
