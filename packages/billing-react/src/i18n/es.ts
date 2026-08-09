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
 * COVERAGE IS DECLARED, NOT DISCOVERED. This bundle carries the GENERATED
 * backend error texts (from stapel-billing's `translations/errors.es.json`
 * catalog — `pnpm gen:errors`), complete over the error registry by
 * construction: the generator fails on a gap and the Record type fails
 * compilation on drift. The pair-owned UI keys (`BILLING_I18N_KEYS`) are NOT
 * translated to Spanish yet and deliberately fall back to their English text
 * through the en floor that {@link registerBillingI18nEs} registers underneath.
 * So a Spanish-speaking user reads Spanish error messages and English UI copy —
 * never a raw key. That state is asserted in `test/i18nEs.test.ts`; whoever
 * adds hand-written Spanish UI copy flips those assertions deliberately.
 *
 * Adding that copy later is additive and host-invisible: this const and the
 * `./i18n/es` subpath keep their names and shapes when it lands.
 */
export const billingI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts (coverage by construction).
  ...billingErrorBundleEs,

  // No hand-written Spanish UI copy yet — see COVERAGE above. Pair-owned keys
  // resolve through the en floor until it exists.
};

/**
 * Register the pair's `es` locale into a core i18n engine (call once at
 * startup, after {@link registerBillingI18n}). Layers per the merge-priority
 * convention (i18n-shipping.md §3): the en floor is registered UNDER the es
 * texts inside the `es` locale, so any key the es bundle does not carry —
 * today, every pair-owned UI key — degrades to its English text rather than to
 * a raw key. A host bundle registered after this call overrides both.
 */
export function registerBillingI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", billingI18nBundleEn);
  engine.registerBundle("es", billingI18nBundleEs);
}
