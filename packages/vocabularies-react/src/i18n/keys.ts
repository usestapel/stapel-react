import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { vocabulariesErrorBundleEn } from "./generated/errors.gen.js";

/**
 * vocabularies-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. UI keys live under the `vocabularies.` namespace.
 */
export const VOCABULARIES_I18N_KEYS = {
  unknownError: "vocabularies.error.unknown",
  termSelectPlaceholder: "vocabularies.termSelect.placeholder",
  termSelectNoMatches: "vocabularies.termSelect.noMatches",
  termSelectUnavailableTitle: "vocabularies.termSelect.unavailable.title",
  termSelectUnavailable: "vocabularies.termSelect.unavailable",
  termPickerTitle: "vocabularies.termPicker.title",
  termPickerEmpty: "vocabularies.termPicker.empty",
  termPickerCount: "vocabularies.termPicker.count",
  termPickerDone: "vocabularies.termPicker.done",
  termPickerChosen: "vocabularies.termPicker.chosen",
  termPickerRecent: "vocabularies.termPicker.recent",
  termPickerAll: "vocabularies.termPicker.all",
  termPickerRefine: "vocabularies.termPicker.refine",
} as const;

export type VocabulariesI18nKey =
  (typeof VOCABULARIES_I18N_KEYS)[keyof typeof VOCABULARIES_I18N_KEYS];

/**
 * English fallback bundle for vocabularies-react UI keys + backend error codes.
 * The generated `vocabulariesErrorBundleEn` (from stapel-vocabularies's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 */
export const vocabulariesI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...vocabulariesErrorBundleEn,

  // vocabularies-react UI
  "vocabularies.error.unknown": "Something went wrong. Please try again.",

  // the default skin's own copy (see i18n/ru.ts, i18n/es.ts)
  "vocabularies.termSelect.placeholder": "Start typing to search…",
  "vocabularies.termSelect.noMatches": "No term matches that.",
  "vocabularies.termSelect.unavailable.title": "This list cannot be loaded",
  "vocabularies.termSelect.unavailable":
    "The terms for this field come from a vocabulary service that is not configured here, so there is nothing to choose from. Nobody can answer this question until it is wired up — please report it.",

  // the picker field and its sheet (VocabularyTermPicker)
  "vocabularies.termPicker.title": "Choose a value",
  "vocabularies.termPicker.empty": "Not chosen yet",
  // The trigger's summary, rendered ONLY from two upwards (one chosen term is
  // shown as its own label), so no locale here needs a singular form and the
  // key stays a flat string instead of a plural family.
  "vocabularies.termPicker.count": "{count} chosen",
  "vocabularies.termPicker.done": "Done",
  "vocabularies.termPicker.chosen": "Chosen",
  "vocabularies.termPicker.recent": "Recent",
  "vocabularies.termPicker.all": "All values",
  "vocabularies.termPicker.refine":
    "Only the first {count} are shown — keep typing to narrow it down.",
};

/**
 * Register vocabularies-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerVocabulariesI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, vocabulariesI18nBundleEn);
}
