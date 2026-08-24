import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { webhooksErrorBundleEn } from "./generated/errors.gen.js";

/**
 * webhooks-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. Add UI keys under the `webhooks.` namespace as you build flows.
 */
export const WEBHOOKS_I18N_KEYS = {
  unknownError: "webhooks.error.unknown",
  navOverview: "webhooks.nav.overview",
  panelEmpty: "webhooks.panel.empty",
  panelLoading: "webhooks.panel.loading",
} as const;

export type WebhooksI18nKey =
  (typeof WEBHOOKS_I18N_KEYS)[keyof typeof WEBHOOKS_I18N_KEYS];

/**
 * English fallback bundle for webhooks-react UI keys + backend error codes.
 * The generated `webhooksErrorBundleEn` (from stapel-webhooks's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 */
export const webhooksI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...webhooksErrorBundleEn,

  // webhooks-react UI
  "webhooks.error.unknown": "Something went wrong. Please try again.",

  // the default skin's own copy (see i18n/ru.ts, i18n/es.ts)
  "webhooks.nav.overview": "Overview",
  "webhooks.panel.empty": "Nothing here yet.",
  "webhooks.panel.loading": "Loading…",
};

/**
 * Register webhooks-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerWebhooksI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, webhooksI18nBundleEn);
}
