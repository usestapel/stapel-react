import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { webhooksI18nBundleEn } from "./keys.js";

/**
 * Russian bundle for webhooks-react — shipped as the
 * `@stapel/webhooks-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * Only the pair's OWN UI keys live here. The backend error catalogue for this
 * locale arrives generated (`errors.ru.gen.ts`, `pnpm gen:errors`) once
 * stapel-webhooks ships a `translations/errors.ru.json` — spread it in
 * FIRST, exactly as `keys.ts` spreads the en one, so every backend code keeps
 * coverage by construction.
 */
export const webhooksI18nBundleRu: I18nDictionary = {
  "webhooks.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "webhooks.nav.overview": "Обзор",
  "webhooks.panel.empty": "Здесь пока ничего нет.",
  "webhooks.panel.loading": "Загрузка…",
};

/**
 * Register the Russian bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerWebhooksI18nRu(
  engine: I18nEngine,
  locale = "ru"
): void {
  engine.registerBundle(locale, webhooksI18nBundleEn);
  engine.registerBundle(locale, webhooksI18nBundleRu);
}
