import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { translateErrorBundleEn } from "./generated/errors.gen.js";

/**
 * translate-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. Add UI keys under the `translate.` namespace as you build flows.
 */
export const TRANSLATE_I18N_KEYS = {
  unknownError: "translate.error.unknown",
  navOverview: "translate.nav.overview",
  panelEmpty: "translate.panel.empty",
  panelLoading: "translate.panel.loading",
} as const;

export type TranslateI18nKey =
  (typeof TRANSLATE_I18N_KEYS)[keyof typeof TRANSLATE_I18N_KEYS];

/**
 * English fallback bundle for translate-react UI keys + backend error codes.
 * The generated `translateErrorBundleEn` (from stapel-translate's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 */
export const translateI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...translateErrorBundleEn,

  // translate-react UI
  "translate.error.unknown": "Something went wrong. Please try again.",

  // the default skin's own copy (see i18n/ru.ts, i18n/es.ts)
  "translate.nav.overview": "Overview",
  "translate.panel.empty": "Nothing here yet.",
  "translate.panel.loading": "Loading…",
};

/**
 * Register translate-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerTranslateI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, translateI18nBundleEn);
}
