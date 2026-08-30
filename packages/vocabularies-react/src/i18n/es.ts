import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { vocabulariesErrorBundleEs } from "./generated/errors.es.gen.js";
import { vocabulariesI18nBundleEn } from "./keys.js";

export { vocabulariesErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for vocabularies-react — shipped as the
 * `@stapel/vocabularies-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * TWO SOURCES, ON PURPOSE — see the ru bundle's header: the generated
 * `vocabulariesErrorBundleEs` covers the codes stapel-core owns, and the 3
 * stapel-vocabularies owns are authored below until upstream ships a
 * `translations/errors.es.json`.
 */
export const vocabulariesI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts for every key core owns.
  ...vocabulariesErrorBundleEs,

  // Backend error codes stapel-vocabularies owns — authored here (see above).
  "error.400.vocabularies_bad_parent":
    "No hay ningún término «{parent}» en el nivel superior de «{level}»",
  "error.404.vocabularies_level_not_found":
    "El vocabulario «{vocabulary}» no tiene el nivel «{level}»",
  "error.404.vocabularies_vocabulary_not_found": "Vocabulario no encontrado",

  // vocabularies-react UI
  "vocabularies.error.unknown": "Algo salió mal. Inténtalo de nuevo.",
  "vocabularies.termSelect.placeholder": "Escribe para buscar…",
  "vocabularies.termSelect.noMatches": "Ningún término coincide.",
  "vocabularies.termSelect.unavailable.title": "No se puede cargar esta lista",
  "vocabularies.termSelect.unavailable":
    "Los valores de este campo vienen de un servicio de vocabularios que no está configurado aquí, así que no hay nada que elegir. Nadie puede responder a esta pregunta hasta que se conecte — avísanos, por favor.",
};

/**
 * Register the Spanish bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerVocabulariesI18nEs(
  engine: I18nEngine,
  locale = "es"
): void {
  engine.registerBundle(locale, vocabulariesI18nBundleEn);
  engine.registerBundle(locale, vocabulariesI18nBundleEs);
}
