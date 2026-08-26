import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { translateI18nBundleEn } from "./keys.js";
import { translateErrorBundleEs } from "./generated/errors.es.gen.js";
import { LANGUAGE_NAMES } from "./languages.js";

/**
 * Spanish bundle for translate-react — shipped as the
 * `@stapel/translate-react/i18n/es` subpath (i18n-shipping.md §2) so the locale
 * is opt-in: a host that never registers it never carries these strings (the
 * main entry does not import this module).
 *
 * The backend error catalogue for this locale is generated
 * (`errors.es.gen.ts`, from stapel-translate's `translations/errors.es.json`)
 * and spread in FIRST, exactly as `keys.ts` spreads the en one, so every
 * backend code keeps coverage by construction. The twenty language endonyms
 * are the same table in every locale — see `i18n/languages.ts`.
 */
export const translateI18nBundleEs: I18nDictionary = {
  ...translateErrorBundleEs,
  ...LANGUAGE_NAMES,

  "translate.error.unknown": "Algo salió mal. Inténtalo de nuevo.",

  "translate.switcher.label": "Idioma",
  "translate.switcher.placeholder": "Elige un idioma",
  "translate.switcher.switching": "Cargando este idioma…",
  "translate.switcher.partial":
    "Algunos textos pueden seguir en inglés: no se pudieron descargar las traducciones.",
  "translate.switcher.open": "Cambiar de idioma",

  "translate.status.loading": "Cargando traducciones…",
  "translate.status.revision": "Revisión {revision} · {keys} textos",
  "translate.status.offline":
    "Mostrando los textos guardados en este dispositivo: no se pudo contactar con el servidor.",
  "translate.status.fallback":
    "Mostrando los textos incluidos en la aplicación: no se descargó ninguna traducción.",

  "translate.settings.heading": "Idioma",
  "translate.settings.hint":
    "Los menús, los botones y los mensajes se muestran en el idioma que elijas aquí.",

  "translate.button.label": "Traducir",
  "translate.button.translating": "Traduciendo…",
  "translate.button.showOriginal": "Ver original",
  "translate.button.showTranslation": "Ver traducción",
  "translate.button.translatedFrom": "Traducido del {lang}",
  "translate.button.machine": "traducción automática",
  "translate.button.cached": "respuesta guardada",
  "translate.button.retry": "Reintentar",
  "translate.button.failed":
    "El servicio de traducción no está disponible ahora mismo.",
  "translate.button.throttled":
    "Demasiadas traducciones seguidas. Inténtalo dentro de un momento.",
  "translate.button.signIn": "Inicia sesión para traducir este texto.",
  "translate.button.tooLong":
    "Este texto supera los {max_chars} caracteres y no se puede traducir.",
  "translate.button.batchRefused":
    "Se envió demasiado texto de una vez. Inténtalo con menos.",
  "translate.button.unsupported":
    "Este sitio no ofrece traducciones al {language}.",
  "translate.button.sameLanguage": "Este texto ya está en tu idioma.",
  "translate.button.unavailable": "Este sitio no ofrece traducción de textos.",
  "translate.button.nothing": "Aquí no hay texto que traducir.",

  "translate.dialog.dismiss": "Cerrar",
  "translate.dialog.target": "Traducir a",

  "translate.nav.language": "Idioma",
};

/**
 * Register the Spanish bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerTranslateI18nEs(
  engine: I18nEngine,
  locale = "es"
): void {
  engine.registerBundle(locale, translateI18nBundleEn);
  engine.registerBundle(locale, translateI18nBundleEs);
}
