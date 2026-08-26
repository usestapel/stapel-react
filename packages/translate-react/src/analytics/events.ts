/**
 * The pair's analytics vocabulary.
 *
 * TWO events, and both are decisions. Loading a bundle is not one — it happens
 * on every cold start and reports nothing about what a person chose — whereas
 * CHANGING the interface language, and ASKING for a piece of content to be
 * translated, are the two things this module exists to let somebody do. The
 * second one also costs money on somebody's LLM budget, which is a second
 * reason it belongs in the ledger.
 *
 * The names are constants rather than `defineEvent` declarations because a
 * pair carries no `@stapel/analytics` runtime by architecture (slim wave
 * §21/S1): it emits through the `Analytics` SEAM the host injects. A host that
 * wants the typed registry entry re-declares these names with `defineEvent` on
 * its side.
 */
export const TRANSLATE_EVENTS = {
  /** The viewer switched the interface language. Props: `from`, `to`. */
  languageChanged: "translate.language.changed",
  /** Content translation was asked for. Props: `target`, `texts` (batch size). */
  contentRequested: "translate.content.requested",
} as const;

export type TranslateEventName =
  (typeof TRANSLATE_EVENTS)[keyof typeof TRANSLATE_EVENTS];
