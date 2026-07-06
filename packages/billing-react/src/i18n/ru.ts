import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { billingI18nBundleEn } from "./keys.js";
import { billingErrorBundleRu } from "./generated/errors.ru.gen.js";

export { billingErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for billing-react — the pair's `ru` locale, shipped as the
 * `@stapel/billing-react/i18n/ru` subpath (i18n-shipping.md §2) so the
 * locale is opt-in: hosts that don't register it never carry these strings
 * (the main entry does not import this module — gated by size-limit + the
 * bundle-purity test).
 *
 * Composition mirrors {@link billingI18nBundleEn}: the GENERATED backend
 * error texts (from stapel-billing's `translations/errors.ru.json` catalog,
 * seeded from the curated stapel-translate corpus — `pnpm gen:errors`) are
 * spread first for coverage by construction; the hand-written ru UI copy for
 * the pair-owned {@link BILLING_I18N_KEYS} follows. Override any key by
 * registering a host bundle AFTER this one (merge-priority convention — see
 * keys.ts).
 */
export const billingI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts (coverage by construction).
  ...billingErrorBundleRu,

  // billing-react UI (hand-written ru mirror of the en copy in keys.ts)
  "billing.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "billing.wallet.loading": "Загрузка кошелька…",
  "billing.wallet.balance": "Баланс",
  "billing.wallet.auto_recharge": "Автопополнение",
  "billing.wallet.save": "Сохранить настройки",
  "billing.wallet.saving": "Сохранение…",
  "billing.wallet.saved": "Настройки сохранены.",
  "billing.pricing.packages": "Пакеты кредитов",
  "billing.pricing.plans": "Тарифы",
  "billing.pricing.buy": "Купить",
  "billing.pricing.subscribe": "Оформить подписку",
  "billing.pricing.checking_out": "Переход к оплате…",
  "billing.subscription.active": "Активна",
  "billing.subscription.inactive": "Неактивна",
  "billing.subscription.cancel": "Отменить подписку",
  "billing.subscription.cancelling": "Отмена…",
  "billing.subscription.manage": "Управление подпиской",
};

/**
 * Register the pair's `ru` locale into a core i18n engine (call once at
 * startup, after {@link registerBillingI18n}). Layers per the
 * merge-priority convention (i18n-shipping.md §3): the en floor is registered
 * UNDER the ru texts inside the `ru` locale, so a key the ru bundle ever
 * misses degrades to its English text — never to a raw key. A host bundle
 * registered after this call overrides both.
 */
export function registerBillingI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", billingI18nBundleEn);
  engine.registerBundle("ru", billingI18nBundleRu);
}
