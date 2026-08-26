/**
 * The pair's analytics vocabulary.
 *
 * Four events, and every one of them is a DECISION somebody took about a live
 * integration — created a rule, switched one on or off, rotated a secret,
 * replayed a dead letter. Reading a delivery log is not on the list: it happens
 * whenever the tab is open and reports nothing about what anyone chose.
 *
 * The names are constants rather than `defineEvent` declarations because a
 * pair carries no `@stapel/analytics` runtime by architecture (slim wave
 * §21/S1): it emits through the `Analytics` SEAM the host injects. A host that
 * wants the typed registry entry re-declares these names with `defineEvent` on
 * its side.
 *
 * Nothing here carries a target, a URL or a secret: the props are the delivery
 * KIND and a boolean, because "which of your webhooks fires where" is the
 * customer's integration topology and does not belong in a product-analytics
 * stream.
 */
export const WEBHOOKS_EVENTS = {
  /** A new reaction rule was written. Prop: `delivery` (the type name). */
  subscriptionCreated: "webhooks.subscription.created",
  /** A rule was switched on or off. Prop: `active`. */
  subscriptionToggled: "webhooks.subscription.toggled",
  /** A signing secret was rotated. No props — the id is the customer's. */
  secretRotated: "webhooks.secret.rotated",
  /** A dead letter was put back in the queue. */
  deliveryReplayed: "webhooks.delivery.replayed",
} as const;

export type WebhooksEventName =
  (typeof WEBHOOKS_EVENTS)[keyof typeof WEBHOOKS_EVENTS];
