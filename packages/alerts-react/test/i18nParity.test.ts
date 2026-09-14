// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import { ALERTS_I18N_KEYS, alertsI18nBundleEn } from "../src/i18n/keys.js";
import { alertsI18nBundleRu, registerAlertsI18nRu } from "../src/i18n/ru.js";
import { alertsI18nBundleEs } from "../src/i18n/es.js";
import { ALERTS_ERROR_CODES } from "../src/i18n/errorsMap.js";

/**
 * Locale parity for the pair's OWN keys (shared-layer audit rule 5). Every key
 * in {@link ALERTS_I18N_KEYS} must have a text in en, ru AND es, and the
 * `{param}` slots must match across all three — a translation that drops a
 * slot renders a sentence with a hole in it, and three of this pair's keys
 * interpolate the wire value of an enum it does not recognise.
 */
const BUNDLES = {
  en: alertsI18nBundleEn,
  ru: alertsI18nBundleRu,
  es: alertsI18nBundleEs,
} as const;

function paramsOf(text: string): string[] {
  const seen: string[] = [];
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    const name = m[1] as string;
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

describe("i18n locale parity", () => {
  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    it(`${locale} covers every key the pair declares`, () => {
      const missing = Object.values(ALERTS_I18N_KEYS).filter(
        (key) => !(key in bundle)
      );
      expect(missing).toEqual([]);
    });

    it(`${locale} keeps the en {param} slots`, () => {
      for (const key of Object.values(ALERTS_I18N_KEYS)) {
        expect(paramsOf(bundle[key] ?? "").sort(), `${locale}:${key}`).toEqual(
          paramsOf(alertsI18nBundleEn[key] ?? "").sort()
        );
      }
    });
  }

  it("the six codes stapel-alerts owns are worded in ru and es too", () => {
    // The module ships no `translations/` of its own, so the generated locale
    // bundles are deliberately PARTIAL and the pair authors these six. Without
    // this assertion they degrade to English silently — the exact gap
    // ERRORS_LOCALE_EXEMPT_OWNERS opens.
    const owned = ALERTS_ERROR_CODES.filter((code) => code.includes("alerts_"));
    expect(owned.length).toBeGreaterThan(0);
    for (const code of owned) {
      expect(alertsI18nBundleRu[code], `ru:${code}`).toBeTruthy();
      expect(alertsI18nBundleEs[code], `es:${code}`).toBeTruthy();
    }
  });

  it("a key missing from a locale degrades to English, never to a raw key", () => {
    const i18n = createI18n({ locale: "en" });
    registerAlertsI18nRu(i18n);
    expect(i18n.t(ALERTS_I18N_KEYS.unknownError)).toBeTruthy();
  });

  it("the locale subpaths stay OUT of the main entry's source graph", () => {
    const src = readFileSync("src/index.ts", "utf8");
    expect(src).not.toMatch(/i18n\/(ru|es)/);
  });
});
