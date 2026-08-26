/**
 * Wire types for the stapel-webhooks HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-webhooks's OWN `docs/schema.json` — the §17-native
 * per-module contract, a build artifact of the backend since 0.1.1).
 *
 * ── The two documented corrections ────────────────────────────────────────
 *
 * 1. `status` on a delivery is `string` in the schema because drf-spectacular
 *    sees a presenter field, not the model's `choices`. The runtime values are
 *    the four in {@link DELIVERY_STATUSES} (`models.py` `DeliveryStatus`), and
 *    the whole delivery log branches on them — a `string` there would let a
 *    skin invent a fifth. Narrowed here, and {@link isDeliveryStatus} is the
 *    only way in, so an unknown value from a future backend degrades to
 *    "unknown" rather than crashing a `switch`.
 * 2. `delivery` is deliberately NOT narrowed. The delivery-type registry is a
 *    merge-registry a host extends (`registry.py`
 *    `register_delivery_type()`), so a closed union here would be a union this
 *    package has to re-release every time a deployment adds a type.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** One subscribable event, as the subscription builder needs it. */
export type CatalogEvent = Schemas["CatalogEventDTO"];

/** What this deployment can react to, and how it can deliver. */
export type EventCatalog = Schemas["EventCatalogDTO"];

/** A reaction rule as its owner reads it. `has_secret` — never the secret. */
export type Subscription = Schemas["SubscriptionPresenterDTO"];

/** The body `POST subscriptions` takes. */
export type SubscriptionCreate = Schemas["SubscriptionCreate"];

/** The body `PATCH subscriptions/{id}` takes. */
export type SubscriptionPatch = Schemas["PatchedSubscriptionPatch"];

/**
 * The one and only time a signing secret is readable — the 201 of create and
 * the 200 of rotate. A read never returns it, so a screen that fails to show
 * it here has lost it for good.
 */
export type SubscriptionSecret = Schemas["SubscriptionSecretDTO"];

/** One delivery attempt record, payload included — what a replay would send. */
export type Delivery = Schemas["DeliveryPresenterDTO"];

/** What a replay did: the row is queued again, from attempt zero. */
export type ReplayResult = Schemas["ReplayResultDTO"];

/**
 * The delivery lifecycle (`models.py` `DeliveryStatus`). `pending` and
 * `retrying` are in flight, `succeeded` is done, `dead` is the dead letter —
 * and `dead` is the ONLY status a replay accepts.
 */
export const DELIVERY_STATUSES = [
  "pending",
  "retrying",
  "succeeded",
  "dead",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** The only narrowing from the wire's `string` to {@link DeliveryStatus}. */
export function isDeliveryStatus(value: string): value is DeliveryStatus {
  return (DELIVERY_STATUSES as readonly string[]).includes(value);
}

/** A subscription's `target` — shape decided by its delivery type. */
export type DeliveryTarget = Readonly<Record<string, unknown>>;
