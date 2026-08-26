/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "keys are namespaced").
 * Everything under the `"webhooks"` root so a host can invalidate the whole
 * module, one resource, or one row. Explicit tuple return types satisfy
 * `--isolatedDeclarations`.
 *
 * ── The list key carries the FILTER, the delivery key carries the STATUS ──
 *
 * `GET subscriptions` takes `event_type` / `is_active` / `limit`, and the
 * delivery log takes `status`. Those are different SERVER answers, so they are
 * different cache entries: a key that ignored them would show the dead-letter
 * view the rows of the "all" view it had already fetched, which is exactly the
 * screen where a person is deciding whether something is broken.
 *
 * ── Nothing here is keyed by a user id ────────────────────────────────────
 *
 * Every read is "mine" — the server decides whose subscriptions those are from
 * the session and the workspace mandate. A key carrying a user id would be a
 * second, client-side answer to a question the server already answered. Core's
 * query runtime partitions the persisted cache per user; sign-out clears it.
 */
const ROOT = "webhooks" as const;

export const webhooksQueryKeys: {
  /** Everything this module caches — the one invalidation a host needs. */
  readonly all: readonly ["webhooks"];
  /** The deployment's event + delivery-type catalogue. */
  readonly catalog: readonly ["webhooks", "catalog"];
  /** Every subscription read (the invalidation a write targets). */
  readonly subscriptions: readonly ["webhooks", "subscriptions"];
  /** One filtered list. `filtersKey` is a stable serialization of the query. */
  subscriptionList(
    filtersKey: string
  ): readonly ["webhooks", "subscriptions", "list", string];
  /** One rule by id. */
  subscription(
    subscriptionId: string
  ): readonly ["webhooks", "subscriptions", "one", string];
  /** Every delivery read. */
  readonly deliveries: readonly ["webhooks", "deliveries"];
  /** One rule's delivery log, at one status filter (`""` = every status). */
  deliveryList(
    subscriptionId: string,
    status: string
  ): readonly ["webhooks", "deliveries", "list", string, string];
  /** One delivery by id. */
  delivery(
    deliveryId: string
  ): readonly ["webhooks", "deliveries", "one", string];
} = {
  all: [ROOT],
  catalog: [ROOT, "catalog"],
  subscriptions: [ROOT, "subscriptions"],
  subscriptionList: (filtersKey) => [ROOT, "subscriptions", "list", filtersKey],
  subscription: (subscriptionId) => [ROOT, "subscriptions", "one", subscriptionId],
  deliveries: [ROOT, "deliveries"],
  deliveryList: (subscriptionId, status) => [
    ROOT,
    "deliveries",
    "list",
    subscriptionId,
    status,
  ],
  delivery: (deliveryId) => [ROOT, "deliveries", "one", deliveryId],
};
