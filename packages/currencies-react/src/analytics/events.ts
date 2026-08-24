/**
 * The pair's analytics vocabulary.
 *
 * ONE event. Formatting a price is not a business action — it happens dozens
 * of times per screen and reports nothing about what a person decided —
 * whereas CHOOSING a display currency is a decision, and the only one this
 * read-only module offers.
 *
 * The names are constants rather than `defineEvent` declarations because a
 * pair carries no `@stapel/analytics` runtime by architecture (slim wave
 * §21/S1): it emits through the `Analytics` SEAM the host injects. A host that
 * wants the typed registry entry re-declares this name with `defineEvent` on
 * its side.
 */
export const CURRENCIES_EVENTS = {
  /** The viewer picked a different display currency. Prop: `code`. */
  displayChanged: "currencies.display.changed",
} as const;

export type CurrenciesEventName =
  (typeof CURRENCIES_EVENTS)[keyof typeof CURRENCIES_EVENTS];
