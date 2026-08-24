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
  "billing.wallet.auto_recharge_hint":
    "Когда баланс опустится ниже порога, мы автоматически купим этот пакет.",
  "billing.wallet.settings_heading": "Автоматическое пополнение",
  "billing.wallet.threshold": "Пополнять, когда баланс ниже",
  "billing.wallet.package": "Какой пакет покупать",
  "billing.wallet.package_placeholder": "Выберите пакет",
  "billing.wallet.low_balance_alert": "Предупредить, когда баланс ниже",
  "billing.wallet.settings_no_packages":
    "В магазине нет пакетов кредитов, поэтому покупать автоматически нечего.",
  "billing.wallet.settings_needs_package":
    "Выберите пакет, прежде чем включать автопополнение.",
  "billing.wallet.heading": "Кредиты и оплата",
  "billing.wallet.expiring": "{credits} кредитов сгорают {date}",
  "billing.wallet.expiring_relative": "{credits} кредитов сгорают {date} — {relative}",
  "billing.wallet.held": "{credits} кредитов зарезервировано",
  "billing.wallet.empty": "Кредитов пока нет.",
  "billing.wallet.empty_hint": "Купите пакет или оформите подписку ниже, чтобы начать.",
  "billing.wallet.retry": "Повторить",
  "billing.wallet.buy_heading": "Два способа купить",
  "billing.wallet.credits": "{credits} кредитов",
  "billing.wallet.credits.one": "{credits} кредит",
  "billing.wallet.credits.few": "{credits} кредита",
  "billing.wallet.credits.many": "{credits} кредитов",
  "billing.wallet.credits.other": "{credits} кредитов",
  "billing.wallet.pools_heading": "Что у вас есть",
  "billing.wallet.pool.perpetual": "{credits} бессрочных кредитов",
  "billing.wallet.pool.perpetual.one": "{credits} бессрочный кредит",
  "billing.wallet.pool.perpetual.few": "{credits} бессрочных кредита",
  "billing.wallet.pool.perpetual.many": "{credits} бессрочных кредитов",
  "billing.wallet.pool.perpetual.other": "{credits} бессрочных кредитов",
  "billing.wallet.pool.perpetual_hint":
    "Купленные кредиты. Они остаются, пока вы их не потратите, что бы ни случилось с подпиской.",
  "billing.wallet.pool.perpetual_none": "Купленных кредитов нет.",
  "billing.wallet.pool.expiring": "{credits} кредитов со сроком",
  "billing.wallet.pool.expiring.one": "{credits} кредит со сроком",
  "billing.wallet.pool.expiring.few": "{credits} кредита со сроком",
  "billing.wallet.pool.expiring.many": "{credits} кредитов со сроком",
  "billing.wallet.pool.expiring.other": "{credits} кредитов со сроком",
  "billing.wallet.pool.expiring_hint":
    "Кредиты от тарифа или начисления. Они сгорают в свою дату, потрачены или нет.",
  "billing.wallet.pool.expiring_none": "Сгорающих кредитов нет.",
  "billing.wallet.debt.heading": "Задолженность",
  "billing.wallet.debt.total": "{credits} кредитов долга",
  "billing.wallet.debt.total.one": "{credits} кредит долга",
  "billing.wallet.debt.total.few": "{credits} кредита долга",
  "billing.wallet.debt.total.many": "{credits} кредитов долга",
  "billing.wallet.debt.total.other": "{credits} кредитов долга",
  "billing.wallet.debt.explain":
    "Следующие кредиты, поступившие в кошелёк, сначала спишутся в счёт долга — начиная с самого старого — и только потом станут доступны.",
  "billing.wallet.debt.row": "{credits} из {initial} ещё не погашено",
  "billing.wallet.debt.reason.partial_debit": "Услуга оказана без достаточного количества кредитов",
  "billing.wallet.debt.reason.clawback": "Возврат или спор вернул кредиты назад",
  "billing.wallet.debt.reason.other": "Корректировка",
  "billing.pricing.packages": "Пакеты кредитов",
  "billing.pricing.plans": "Тарифы",
  "billing.pricing.buy": "Купить",
  "billing.pricing.subscribe": "Оформить подписку",
  "billing.pricing.checking_out": "Переход к оплате…",
  "billing.pricing.error": "Не удалось загрузить тарифы.",
  "billing.pricing.retry": "Повторить",
  "billing.pricing.credits": "{credits} кредитов",
  "billing.pricing.credits_monthly": "{credits} кредитов каждый месяц",
  "billing.pricing.per_credit": "{price} за кредит",
  "billing.pricing.per_month": "{price} в месяц",
  "billing.pricing.best_value": "Выгоднее всего",
  "billing.pricing.plan_saves": "Экономия {percent}% на кредите",
  "billing.pricing.empty": "Сейчас ничего не продаётся.",
  "billing.pricing.current_plan": "Ваш тариф",
  "billing.pricing.blocked_current_plan": "Этот тариф у вас уже подключён.",
  "billing.pricing.settles_debt": "{credits} из них уйдут в счёт долга",
  "billing.pricing.settles_debt.one": "{credits} из них уйдёт в счёт долга",
  "billing.pricing.settles_debt.few": "{credits} из них уйдут в счёт долга",
  "billing.pricing.settles_debt.many": "{credits} из них уйдут в счёт долга",
  "billing.pricing.settles_debt.other": "{credits} из них уйдут в счёт долга",
  "billing.subscription.active": "Активна",
  "billing.subscription.inactive": "Неактивна",
  "billing.subscription.cancel": "Отменить подписку",
  "billing.subscription.cancelling": "Отмена…",
  "billing.subscription.manage": "Управление подпиской",
  "billing.subscription.heading": "Подписка",
  "billing.subscription.plan_label": "Тариф",
  "billing.subscription.none": "Подписки нет.",
  "billing.subscription.none_hint":
    "Тариф добавляет кредиты каждый месяц. На купленные кредиты это никак не влияет.",
  "billing.subscription.renews": "Продлится {date}",
  "billing.subscription.ends": "Действует до {date}",
  "billing.subscription.trialing": "Пробный период",
  "billing.subscription.past_due": "Платёж просрочен",
  "billing.subscription.past_due_hint":
    "Последний платёж не прошёл. Обновите способ оплаты, чтобы ежемесячные кредиты продолжали поступать.",
  "billing.subscription.cancelled": "Отменена",
  "billing.subscription.incomplete": "Не завершена",
  "billing.subscription.cancel_confirm_title": "Отменить подписку «{plan}»?",
  "billing.subscription.cancel_confirm_body":
    "Купленные кредиты останутся в кошельке. Кредиты по тарифу перестанут поступать, а уже полученные сгорят в свои даты.",
  "billing.subscription.cancel_blocked": "Эта подписка уже отменена.",
  "billing.subscription.opening_portal": "Открываем…",
  "billing.transactions.heading": "История кредитов",
  "billing.transactions.empty": "Движений по кредитам пока не было.",
  "billing.transactions.empty_hint": "Здесь появятся все покупки, списания и сгорания.",
  "billing.transactions.more": "Показать раньше",
  "billing.transactions.balance_after": "Баланс после: {credits}",
  "billing.transactions.type.credit_purchase": "Покупка кредитов",
  "billing.transactions.type.transcription_charge": "Расшифровка",
  "billing.transactions.type.ai_charge": "ИИ",
  "billing.transactions.type.subscription_bonus": "Кредиты по тарифу",
  "billing.transactions.type.refund": "Возврат",
  "billing.transactions.type.adjustment": "Корректировка",
  "billing.transactions.type.expiration": "Кредиты сгорели",
  "billing.transactions.type.other": "Прочее",
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
