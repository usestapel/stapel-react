import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { billingI18nBundleEn } from "./keys.js";
import { billingErrorBundleEs } from "./generated/errors.es.gen.js";

export { billingErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for billing-react — the pair's `es` locale, shipped as the
 * `@stapel/billing-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the tree-shake
 * purity test).
 *
 * COVERAGE IS DECLARED, NOT DISCOVERED, and it is now COMPLETE on both
 * halves. The GENERATED backend error texts (from stapel-billing's
 * `translations/errors.es.json` catalog — `pnpm gen:errors`) are complete over
 * the error registry by construction: the generator fails on a gap and the
 * Record type fails compilation on drift. The pair-owned UI keys
 * (`BILLING_I18N_KEYS`) are hand-written below.
 *
 * Until wave B they were NOT: this bundle carried the error texts alone and
 * every visible string in the wallet and the shop fell through to English. A
 * Spanish-speaking customer read Spanish refusals inside an English screen —
 * a worse result than either language alone, and the fleet-wide finding the
 * `i18n-locale-parity` lint reports once per pair rather than once per key.
 *
 * Composition mirrors {@link billingI18nBundleRu}: generated errors first for
 * coverage by construction, hand-written UI copy after. Plural families ship
 * their CLDR categories the same way (`es` uses `one`/`other`), plus the flat
 * entry at the bare key — see the note in `keys.ts`. Override any key by
 * registering a host bundle AFTER this one (merge-priority convention).
 */
export const billingI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts (coverage by construction).
  ...billingErrorBundleEs,

  // billing-react UI (hand-written es mirror of the en copy in keys.ts)
  "billing.error.unknown": "Algo ha salido mal. Vuelve a intentarlo.",
  "billing.wallet.loading": "Cargando el monedero…",
  "billing.wallet.balance": "Saldo",
  "billing.wallet.auto_recharge": "Recarga automática",
  "billing.wallet.save": "Guardar ajustes",
  "billing.wallet.saving": "Guardando…",
  "billing.wallet.saved": "Ajustes guardados.",
  "billing.wallet.auto_recharge_hint":
    "Cuando tu saldo baje del umbral, compraremos este paquete por ti automáticamente.",
  "billing.wallet.settings_heading": "Recarga automática del saldo",
  "billing.wallet.threshold": "Recargar cuando el saldo baje de",
  "billing.wallet.package": "Paquete que se comprará",
  "billing.wallet.package_placeholder": "Elige un paquete",
  "billing.wallet.low_balance_alert": "Avísame cuando el saldo baje de",
  "billing.wallet.settings_no_packages":
    "La tienda no vende paquetes de créditos, así que no hay nada que comprar automáticamente.",
  "billing.wallet.settings_needs_package":
    "Elige el paquete que se comprará antes de activar la recarga automática.",
  "billing.wallet.heading": "Créditos y facturación",
  "billing.wallet.expiring": "{credits} créditos caducan el {date}",
  "billing.wallet.expiring_relative":
    "{credits} créditos caducan el {date} — {relative}",
  "billing.wallet.held": "{credits} créditos reservados",
  "billing.wallet.empty": "Aún no tienes créditos.",
  "billing.wallet.empty_hint":
    "Compra un paquete o suscríbete a un plan más abajo para empezar.",
  "billing.wallet.retry": "Reintentar",
  "billing.wallet.buy_heading": "Dos formas de comprar",
  "billing.wallet.credits": "{credits} créditos",
  "billing.wallet.credits.one": "{credits} crédito",
  "billing.wallet.credits.other": "{credits} créditos",
  "billing.wallet.pools_heading": "Lo que tienes",
  "billing.wallet.pool.perpetual": "{credits} créditos que no caducan",
  "billing.wallet.pool.perpetual.one": "{credits} crédito que no caduca",
  "billing.wallet.pool.perpetual.other": "{credits} créditos que no caducan",
  "billing.wallet.pool.perpetual_hint":
    "Créditos que has comprado. Se quedan hasta que los gastes, pase lo que pase con tu suscripción.",
  "billing.wallet.pool.perpetual_none": "No tienes créditos comprados.",
  "billing.wallet.pool.expiring": "{credits} créditos con fecha límite",
  "billing.wallet.pool.expiring.one": "{credits} crédito con fecha límite",
  "billing.wallet.pool.expiring.other": "{credits} créditos con fecha límite",
  "billing.wallet.pool.expiring_hint":
    "Créditos de un plan o de una concesión. Caducan en su propia fecha, los gastes o no.",
  "billing.wallet.pool.expiring_none": "No caduca ningún crédito.",
  "billing.wallet.debt.heading": "Créditos que debes",
  "billing.wallet.debt.total": "{credits} créditos pendientes",
  "billing.wallet.debt.total.one": "{credits} crédito pendiente",
  "billing.wallet.debt.total.other": "{credits} créditos pendientes",
  "billing.wallet.debt.explain":
    "Los próximos créditos que entren en tu monedero se descontarán de esta deuda, empezando por la más antigua, antes de que puedas gastarlos.",
  "billing.wallet.debt.row": "{credits} de {initial} siguen pendientes",
  "billing.wallet.debt.reason.partial_debit":
    "Servicio prestado sin créditos suficientes",
  "billing.wallet.debt.reason.clawback":
    "Un reembolso o una disputa retiró créditos",
  "billing.wallet.debt.reason.other": "Ajuste",
  "billing.pricing.packages": "Paquetes de créditos",
  "billing.pricing.plans": "Planes",
  "billing.pricing.buy": "Comprar",
  "billing.pricing.subscribe": "Suscribirse",
  "billing.pricing.checking_out": "Redirigiendo al pago…",
  "billing.pricing.error": "No se han podido cargar los precios.",
  "billing.pricing.retry": "Reintentar",
  "billing.pricing.credits": "{credits} créditos",
  "billing.pricing.credits_monthly": "{credits} créditos cada mes",
  "billing.pricing.per_credit": "{price} por crédito",
  "billing.pricing.per_month": "{price} al mes",
  "billing.pricing.best_value": "La mejor opción",
  "billing.pricing.plan_saves": "Ahorra un {percent}% por crédito",
  "billing.pricing.empty": "Ahora mismo no hay nada a la venta.",
  "billing.pricing.current_plan": "Tu plan",
  "billing.pricing.blocked_current_plan": "Es el plan que ya tienes.",
  "billing.pricing.settles_debt": "{credits} de estos saldan lo que debes",
  "billing.pricing.settles_debt.one": "{credits} de estos salda lo que debes",
  "billing.pricing.settles_debt.other": "{credits} de estos saldan lo que debes",
  "billing.subscription.active": "Activa",
  "billing.subscription.inactive": "Inactiva",
  "billing.subscription.cancel": "Cancelar la suscripción",
  "billing.subscription.cancelling": "Cancelando…",
  "billing.subscription.manage": "Gestionar la facturación",
  "billing.subscription.heading": "Suscripción",
  "billing.subscription.plan_label": "Plan",
  "billing.subscription.none": "No tienes ninguna suscripción.",
  "billing.subscription.none_hint":
    "Un plan añade créditos cada mes. Los créditos que hayas comprado no se ven afectados.",
  "billing.subscription.renews": "Se renueva el {date}",
  "billing.subscription.ends": "Válida hasta el {date}",
  "billing.subscription.trialing": "Prueba",
  "billing.subscription.past_due": "Pago pendiente",
  "billing.subscription.past_due_hint":
    "El último pago no se ha completado. Actualiza tu método de pago para seguir recibiendo los créditos mensuales.",
  "billing.subscription.cancelled": "Cancelada",
  "billing.subscription.incomplete": "Sin terminar",
  "billing.subscription.cancel_confirm_title":
    "¿Cancelar la suscripción {plan}?",
  "billing.subscription.cancel_confirm_body":
    "Los créditos que has comprado se quedan en tu monedero. Los créditos del plan dejan de llegar y los que ya tienes seguirán caducando en sus fechas.",
  "billing.subscription.cancel_blocked": "Esta suscripción ya está cancelada.",
  "billing.subscription.opening_portal": "Abriendo…",
  "billing.transactions.heading": "Historial de créditos",
  "billing.transactions.empty": "Todavía no se ha movido ningún crédito.",
  "billing.transactions.empty_hint":
    "Aquí aparecerán todas las compras, los cargos y las caducidades.",
  "billing.transactions.more": "Ver anteriores",
  "billing.transactions.balance_after": "Saldo después: {credits}",
  "billing.transactions.type.credit_purchase": "Compra de créditos",
  "billing.transactions.type.transcription_charge": "Transcripción",
  "billing.transactions.type.ai_charge": "Uso de IA",
  "billing.transactions.type.subscription_bonus": "Créditos del plan",
  "billing.transactions.type.refund": "Reembolso",
  "billing.transactions.type.adjustment": "Ajuste",
  "billing.transactions.type.expiration": "Créditos caducados",
  "billing.transactions.type.other": "Otro",
};

/**
 * Register the pair's `es` locale into a core i18n engine (call once at
 * startup, after {@link registerBillingI18n}). Layers per the merge-priority
 * convention (i18n-shipping.md §3): the en floor is registered UNDER the es
 * texts inside the `es` locale, so any key the es bundle does not carry
 * degrades to its English text rather than to a raw key. A host bundle
 * registered after this call overrides both.
 */
export function registerBillingI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", billingI18nBundleEn);
  engine.registerBundle("es", billingI18nBundleEs);
}
