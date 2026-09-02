/**
 * Locale parity, in both directions, over BOTH halves of the bundle.
 *
 * The failure this file exists for is invisible to every test that runs in one
 * locale, which is all of them unless one is written on purpose: a screen that
 * renders English sentences in the middle of a Russian product. The UI half is
 * this pair's own copy; the error half is generated from stapel-docs'
 * `translations/errors.{ru,es}.json`, so coverage there is by construction and
 * this file proves it reached the engine.
 */
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  DRIVE_ERROR_CODES,
  DRIVE_I18N_KEYS,
  driveI18nBundleEn,
  registerDriveI18n,
} from "../src/index.js";
import { driveI18nBundleRu, registerDriveI18nRu } from "../src/i18n/ru.js";
import { driveI18nBundleEs, registerDriveI18nEs } from "../src/i18n/es.js";

/** Codes stapel-docs itself raises — the ones a generic HTTP floor cannot
 * cover, and the ones the drive surfaces actually hit. */
const DOCS_OWNED = DRIVE_ERROR_CODES.filter((code) => code.includes(".docs_"));

function engineFor(locale: "en" | "ru" | "es") {
  const engine = createI18n({ locale });
  registerDriveI18n(engine);
  if (locale === "ru") registerDriveI18nRu(engine);
  if (locale === "es") registerDriveI18nEs(engine);
  return engine;
}

describe("the backend registry actually reaches the pair", () => {
  it("carries the whole 0.5.0 registry, drive wave codes included", () => {
    expect(DRIVE_ERROR_CODES.length).toBe(77);
    expect(DOCS_OWNED.length).toBeGreaterThan(0);
    // The three the drive product surfaces by name.
    expect(DRIVE_ERROR_CODES).toContain("error.507.docs_workspace_quota");
    expect(DRIVE_ERROR_CODES).toContain("error.503.docs_thumbnails_unavailable");
    expect(DRIVE_ERROR_CODES).toContain("error.400.docs_thumbnail_unsupported");
  });
});

describe.each(["en", "ru", "es"] as const)("locale %s", (locale) => {
  const engine = engineFor(locale);

  it("resolves every backend error code to a sentence, not to the key", () => {
    for (const code of DRIVE_ERROR_CODES) {
      const text = engine.t(code);
      expect(text, code).not.toBe(code);
      expect(text.length, code).toBeGreaterThan(0);
    }
  });

  it("resolves every UI key the pair declares", () => {
    for (const key of Object.values(DRIVE_I18N_KEYS)) {
      const text = engine.t(key);
      expect(text, key).not.toBe(key);
      expect(text.length, key).toBeGreaterThan(0);
    }
  });
});

describe("key-set parity, in both directions", () => {
  const uiKeys = (bundle: Record<string, unknown>): string[] =>
    Object.keys(bundle)
      .filter((key) => key.startsWith("drive."))
      .sort();

  it("ru and es declare exactly the UI keys en declares", () => {
    const en = uiKeys(driveI18nBundleEn);
    expect(uiKeys(driveI18nBundleRu)).toEqual(en);
    expect(uiKeys(driveI18nBundleEs)).toEqual(en);
    // Every key of the public table is in the bundle, and nothing else is.
    expect(en).toEqual([...new Set(Object.values(DRIVE_I18N_KEYS))].sort());
  });

  it("the locales were TRANSLATED, not copied", () => {
    // A locale file that ships the English text under a Russian name is the
    // failure this rule exists for; a handful of keys can legitimately match
    // (proper nouns), so the assertion is on the bulk.
    const en = uiKeys(driveI18nBundleEn);
    const identical = en.filter(
      (key) => driveI18nBundleRu[key] === driveI18nBundleEn[key]
    );
    expect(identical.length / en.length).toBeLessThan(0.1);
  });
});
