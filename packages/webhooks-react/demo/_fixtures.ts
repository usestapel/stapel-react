/**
 * Bodies stapel-webhooks actually sends, field for field.
 *
 * Every fixture here is shaped by `presenters.py` — snake_case, `has_secret`
 * and never `secret` on a read, `filter` (not `payload_filter`) on the wire,
 * ISO instants that may be `null`. A demo built on a hand-shaped object would
 * document a screen that does not exist.
 */
import type {
  Delivery,
  EventCatalog,
  Subscription,
} from "../src/api/types.js";

export const CATALOG: EventCatalog = {
  events: [
    {
      event: "listings.listing.published",
      module: "listings",
      package: "stapel-listings",
      description: "A listing became visible to buyers.",
      required: ["listing_id", "owner_id"],
      properties: ["listing_id", "owner_id", "city", "price", "currency"],
    },
    {
      event: "listings.listing.archived",
      module: "listings",
      package: "stapel-listings",
      description: "A listing was taken down by its owner.",
      required: ["listing_id"],
      properties: ["listing_id", "owner_id", "reason"],
    },
    {
      event: "booking.reservation.confirmed",
      module: "booking",
      package: "stapel-booking",
      description: "A reservation was confirmed and paid.",
      required: ["reservation_id"],
      properties: ["reservation_id", "listing_id", "amount", "currency"],
    },
  ],
  delivery_types: ["webhook", "notification", "ws", "custom"],
};

/** A healthy signed webhook. */
export const HEALTHY: Subscription = {
  id: "3f1a7c2e-0c4d-4b6f-9a11-2b3c4d5e6f70",
  event_type: "listings.listing.published",
  delivery: "webhook",
  description: "Index new listings in our own search",
  is_active: true,
  consecutive_failures: 0,
  target: { url: "https://hooks.acme.example/stapel/listings" },
  filter: { city: "Berlin", price: { $gte: 500 } },
  has_secret: true,
  owner_id: "u-1",
  workspace_id: null,
  disabled_at: null,
  last_delivery_at: "2026-08-24T09:12:00Z",
  created_at: "2026-07-01T10:00:00Z",
  updated_at: "2026-08-24T09:12:00Z",
};

/** The row somebody has to act on: switched off by the backend, not by them. */
export const AUTO_DISABLED: Subscription = {
  id: "8c2d9e10-7b55-4c31-9f02-1a2b3c4d5e6f",
  event_type: "booking.reservation.confirmed",
  delivery: "webhook",
  description: "Post confirmed bookings to the ops channel",
  is_active: false,
  consecutive_failures: 5,
  target: { url: "https://ops.acme.example/hooks/bookings" },
  filter: {},
  has_secret: true,
  owner_id: "u-1",
  workspace_id: null,
  disabled_at: "2026-08-22T18:40:00Z",
  last_delivery_at: "2026-08-22T18:40:00Z",
  created_at: "2026-05-14T08:00:00Z",
  updated_at: "2026-08-22T18:40:00Z",
};

/** An unsigned delivery type — the one whose secret cannot be rotated. */
export const NOTIFICATION_RULE: Subscription = {
  id: "b7c81f43-2d90-4a52-8e77-9d0c1b2a3f44",
  event_type: "listings.listing.archived",
  delivery: "notification",
  description: "Email the moderation desk",
  is_active: true,
  consecutive_failures: 0,
  target: { notification_type: "moderation_alert", email: "desk@acme.example" },
  filter: {},
  has_secret: false,
  owner_id: "u-1",
  workspace_id: null,
  disabled_at: null,
  last_delivery_at: null,
  created_at: "2026-08-01T12:00:00Z",
  updated_at: "2026-08-01T12:00:00Z",
};

export const DELIVERY_SUCCEEDED: Delivery = {
  id: "d1000000-0000-4000-8000-000000000001",
  subscription_id: HEALTHY.id,
  event_type: "listings.listing.published",
  event_id: "e1000000-0000-4000-8000-000000000001",
  status: "succeeded",
  attempts: 1,
  response_status: 200,
  last_error: "",
  payload: {
    listing_id: "l-8891",
    owner_id: "u-1",
    city: "Berlin",
    price: 890,
    currency: "EUR",
  },
  next_attempt_at: null,
  last_attempt_at: "2026-08-24T09:12:01Z",
  completed_at: "2026-08-24T09:12:01Z",
  created_at: "2026-08-24T09:12:00Z",
};

export const DELIVERY_RETRYING: Delivery = {
  id: "d1000000-0000-4000-8000-000000000002",
  subscription_id: HEALTHY.id,
  event_type: "listings.listing.published",
  event_id: "e1000000-0000-4000-8000-000000000002",
  status: "retrying",
  attempts: 2,
  response_status: 502,
  last_error: "Bad gateway",
  payload: {
    listing_id: "l-8892",
    owner_id: "u-1",
    city: "Berlin",
    price: 1200,
    currency: "EUR",
  },
  next_attempt_at: "2026-08-24T09:20:00Z",
  last_attempt_at: "2026-08-24T09:14:00Z",
  completed_at: null,
  created_at: "2026-08-24T09:13:00Z",
};

export const DELIVERY_DEAD: Delivery = {
  id: "d1000000-0000-4000-8000-000000000003",
  subscription_id: AUTO_DISABLED.id,
  event_type: "booking.reservation.confirmed",
  event_id: "e1000000-0000-4000-8000-000000000003",
  status: "dead",
  attempts: 6,
  response_status: 0,
  last_error:
    "ConnectTimeout: ops.acme.example did not answer within 10s (attempt 6 of 6)",
  payload: {
    reservation_id: "r-4412",
    listing_id: "l-8891",
    amount: 240,
    currency: "EUR",
  },
  next_attempt_at: null,
  last_attempt_at: "2026-08-22T18:40:00Z",
  completed_at: "2026-08-22T18:40:00Z",
  created_at: "2026-08-22T18:30:00Z",
};

/** The 503 every route of this module can answer — not a permission failure. */
export const MANDATE_UNAVAILABLE = [
  503,
  {
    localizable_error: "error.503.mandate_unavailable",
    error: "Cannot verify workspace mandate right now",
    params: {},
  },
] as const;

/** At the per-owner ceiling — a refusal the browser cannot predict. */
export const SUBSCRIPTION_CAP = [
  409,
  {
    localizable_error: "error.409.webhooks_subscription_cap",
    error: "You already have the maximum number of subscriptions",
    params: {},
  },
] as const;

/** The 201 of a create: the one and only time a secret is readable. */
export const CREATED_WITH_SECRET = {
  id: "9a0b1c2d-3e4f-4a5b-8c9d-0e1f2a3b4c5d",
  secret: "whsec_7Qk2m1Zt4pR8vN3sX6yB9dL0fG5hJ2wC",
};
