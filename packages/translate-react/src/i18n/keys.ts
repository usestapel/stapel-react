import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { translateErrorBundleEn } from "./generated/errors.gen.js";
import { LANGUAGE_NAMES } from "./languages.js";

/**
 * translate-react's own translation KEYS (frontend-standard §4.2): components
 * never render literal strings — hosts resolve these through core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated from
 * stapel-translate's own `errors.py`, since 0.7.0) and the pair's own UI keys.
 *
 * ── The pair that loads everyone's copy also ships its own ─────────────────
 *
 * This module is where the fleet's runtime i18n comes FROM, which is exactly
 * why its own strings must not depend on it: a language switcher whose labels
 * arrive over the network is a switcher that renders raw keys on the one day
 * the network is the problem. So the twenty language names
 * (`LANGUAGE_NAMES`) and every sentence below ship in the package, in three
 * locales, and the remote bundle only ever layers over them.
 */
export const TRANSLATE_I18N_KEYS = {
  unknownError: "translate.error.unknown",

  // the language switcher
  switcherLabel: "translate.switcher.label",
  switcherPlaceholder: "translate.switcher.placeholder",
  switcherSwitching: "translate.switcher.switching",
  switcherPartial: "translate.switcher.partial",
  switcherOpen: "translate.switcher.open",

  // the bundle status chip
  statusLoading: "translate.status.loading",
  statusRevision: "translate.status.revision",
  statusOffline: "translate.status.offline",
  statusFallback: "translate.status.fallback",

  // the account-level language screen
  settingsHeading: "translate.settings.heading",
  settingsHint: "translate.settings.hint",

  // content translation
  buttonLabel: "translate.button.label",
  buttonTranslating: "translate.button.translating",
  buttonShowOriginal: "translate.button.showOriginal",
  buttonShowTranslation: "translate.button.showTranslation",
  buttonTranslatedFrom: "translate.button.translatedFrom",
  buttonMachine: "translate.button.machine",
  buttonCached: "translate.button.cached",
  buttonRetry: "translate.button.retry",
  buttonFailed: "translate.button.failed",
  buttonThrottled: "translate.button.throttled",
  buttonSignIn: "translate.button.signIn",
  buttonTooLong: "translate.button.tooLong",
  buttonBatchRefused: "translate.button.batchRefused",
  buttonUnsupported: "translate.button.unsupported",
  buttonSameLanguage: "translate.button.sameLanguage",
  buttonUnavailable: "translate.button.unavailable",
  buttonNothing: "translate.button.nothing",

  // dialogs
  dialogDismiss: "translate.dialog.dismiss",
  dialogTarget: "translate.dialog.target",

  navLanguage: "translate.nav.language",
} as const;

export type TranslateI18nKey =
  (typeof TRANSLATE_I18N_KEYS)[keyof typeof TRANSLATE_I18N_KEYS];

/**
 * English fallback bundle for translate-react UI keys + backend error codes.
 * The generated `translateErrorBundleEn` (from stapel-translate's error
 * registry, `pnpm gen:errors`) is spread FIRST so every backend `error.*` key
 * has a fallback — a `StapelApiError.code` never renders as a raw key. The
 * language names are spread next; hand-polished copy below then OVERRIDES the
 * generated English for the keys users see most.
 */
export const translateI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...translateErrorBundleEn,
  // The twenty endonyms — identical in every locale on purpose.
  ...LANGUAGE_NAMES,

  "translate.error.unknown": "Something went wrong. Please try again.",

  "translate.switcher.label": "Language",
  "translate.switcher.placeholder": "Choose a language",
  "translate.switcher.switching": "Loading this language…",
  "translate.switcher.partial":
    "Some texts may still appear in English — the translations could not be downloaded.",
  "translate.switcher.open": "Change language",

  "translate.status.loading": "Loading translations…",
  "translate.status.revision": "Revision {revision} · {keys} texts",
  "translate.status.offline":
    "Showing the copy saved on this device — the server could not be reached.",
  "translate.status.fallback":
    "Showing the texts built into this app — no translations were downloaded.",

  "translate.settings.heading": "Language",
  "translate.settings.hint":
    "Menus, buttons and messages appear in the language you choose here.",

  "translate.button.label": "Translate",
  "translate.button.translating": "Translating…",
  "translate.button.showOriginal": "Show original",
  "translate.button.showTranslation": "Show translation",
  "translate.button.translatedFrom": "Translated from {lang}",
  "translate.button.machine": "machine translation",
  "translate.button.cached": "saved answer",
  "translate.button.retry": "Try again",
  "translate.button.failed":
    "The translation service is unavailable right now.",
  "translate.button.throttled":
    "Too many translations just now. Try again in a moment.",
  "translate.button.signIn": "Sign in to translate this text.",
  "translate.button.tooLong":
    "This text is longer than {max_chars} characters and cannot be translated.",
  "translate.button.batchRefused":
    "Too much text was sent at once. Try again with less of it.",
  "translate.button.unsupported":
    "This site does not offer translations into {language}.",
  "translate.button.sameLanguage": "This text is already in your language.",
  "translate.button.unavailable": "This site does not offer translation of texts.",
  "translate.button.nothing": "There is no text here to translate.",

  "translate.dialog.dismiss": "Close",
  "translate.dialog.target": "Translate into",

  "translate.nav.language": "Language",
};

/**
 * Register translate-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate — this pair's own
 * `runtime.localeLoader` — layers localized overrides on top.
 */
export function registerTranslateI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, translateI18nBundleEn);
}
