import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { profilesI18nBundleEn } from "./keys.js";
import { profilesErrorBundleEs } from "./generated/errors.es.gen.js";

export { profilesErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for profiles-react — the pair's `es` locale, shipped as the
 * `@stapel/profiles-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the tree-shake
 * purity test).
 *
 * COVERAGE IS DECLARED, NOT DISCOVERED. This bundle carries the GENERATED
 * backend error texts (from stapel-profiles's `translations/errors.es.json`
 * catalog — `pnpm gen:errors`), complete over the error registry by
 * construction: the generator fails on a gap and the Record type fails
 * compilation on drift. The pair-owned UI keys (`PROFILES_I18N_KEYS`) are
 * translated PARTIALLY — every key without Spanish copy below deliberately
 * falls back to its English text through the en floor that
 * {@link registerProfilesI18nEs} registers underneath. So a Spanish-speaking
 * user reads Spanish error messages and mostly-English UI copy — never a raw
 * key. That state is asserted key-by-key in `test/i18nEs.test.ts`; whoever
 * adds more hand-written Spanish UI copy just adds it here.
 *
 * Adding that copy is additive and host-invisible: this const and the
 * `./i18n/es` subpath keep their names and shapes as it lands.
 */
export const profilesI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts (coverage by construction).
  ...profilesErrorBundleEs,

  // profiles-react UI — hand-written es copy, key by key. Everything not
  // listed here resolves through the en floor (see COVERAGE above).
  "profiles.action.close": "Cerrar",
};

/**
 * Register the pair's `es` locale into a core i18n engine (call once at
 * startup, after {@link registerProfilesI18n}). Layers per the merge-priority
 * convention (i18n-shipping.md §3): the en floor is registered UNDER the es
 * texts inside the `es` locale, so any key the es bundle does not carry —
 * today, every pair-owned UI key — degrades to its English text rather than to
 * a raw key. A host bundle registered after this call overrides both.
 */
export function registerProfilesI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", profilesI18nBundleEn);
  engine.registerBundle("es", profilesI18nBundleEs);
}
