import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { webhooksI18nBundleEn } from "./keys.js";

/**
 * Spanish bundle for webhooks-react — shipped as the
 * `@stapel/webhooks-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * Only the pair's OWN UI keys live here. The backend error catalogue for this
 * locale arrives generated (`errors.es.gen.ts`, `pnpm gen:errors`) once
 * stapel-webhooks ships a `translations/errors.es.json` — spread it in
 * FIRST, exactly as `keys.ts` spreads the en one, so every backend code keeps
 * coverage by construction.
 */
export const webhooksI18nBundleEs: I18nDictionary = {
  "webhooks.error.unknown": "Algo salió mal. Inténtalo de nuevo.",
  "webhooks.nav.overview": "Resumen",
  "webhooks.panel.empty": "Aquí todavía no hay nada.",
  "webhooks.panel.loading": "Cargando…",
};

/**
 * Register the Spanish bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerWebhooksI18nEs(
  engine: I18nEngine,
  locale = "es"
): void {
  engine.registerBundle(locale, webhooksI18nBundleEn);
  engine.registerBundle(locale, webhooksI18nBundleEs);
}
