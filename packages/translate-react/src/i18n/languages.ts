/**
 * The twenty languages stapel-translate configures out of the box
 * (`STAPEL_TRANSLATE["LANGUAGES"]`), with their names written the way a
 * speaker of each writes them.
 *
 * ── Why the names are NOT translated ──────────────────────────────────────
 *
 * A language picker is the one control a person uses when the interface is in
 * a language they cannot read. Rendering "Russo" to an Italian speaker who is
 * looking for Russian helps nobody: they are scanning for the endonym, in its
 * own script. So the same twenty strings ship in every locale bundle — identical by construction,
 * because they are the same list — and the switcher renders the ENDONYM.
 *
 * There is no anonymous endpoint that lists a deployment's configured
 * languages (BACKEND-GAP TR-6), so the host tells the runtime which of these
 * it actually serves; this table is what turns a code into something readable.
 */
import type { I18nDictionary } from "@stapel/core";

/** The default `LANGUAGES` list, in the module's own order. */
export const DEFAULT_LANGUAGE_CODES: readonly string[] = [
  "en",
  "lb",
  "fr",
  "de",
  "es",
  "pt",
  "it",
  "ru",
  "uk",
  "pl",
  "ar",
  "hi",
  "zh",
  "tr",
  "ko",
  "ja",
  "sr",
  "hr",
  "hu",
  "he",
];

/** The i18n key a language code is rendered through. */
export function languageKey(code: string): string {
  return `language.${code.toLowerCase()}`;
}

/**
 * `language.<code>` → the endonym. Spread into the en, ru and es bundles
 * alike; the locale-parity gate ignores spreads on both sides precisely
 * because a table like this cannot drift between them.
 */
export const LANGUAGE_NAMES: I18nDictionary = {
  "language.en": "English",
  "language.lb": "Lëtzebuergesch",
  "language.fr": "Français",
  "language.de": "Deutsch",
  "language.es": "Español",
  "language.pt": "Português",
  "language.it": "Italiano",
  "language.ru": "Русский",
  "language.uk": "Українська",
  "language.pl": "Polski",
  "language.ar": "العربية",
  "language.hi": "हिन्दी",
  "language.zh": "中文",
  "language.tr": "Türkçe",
  "language.ko": "한국어",
  "language.ja": "日本語",
  "language.sr": "Српски",
  "language.hr": "Hrvatski",
  "language.hu": "Magyar",
  "language.he": "עברית",
};
