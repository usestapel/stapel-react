/**
 * Bodies stapel-webhooks actually sends. Shaped by `presenters.py`: snake_case,
 * `has_secret` and never `secret` on a read, `filter` (not `payload_filter`) on
 * the wire, nullable ISO instants.
 */
import type { Delivery, EventCatalog, Subscription } from "../src/api/types.js";

export const CATALOG: EventCatalog = {
  events: [
    {
      event: "listings.listing.published",
      module: "listings",
      package: "stapel-listings",
      description: "A listing became visible to buyers.",
      required: ["listing_id"],
      properties: ["listing_id", "city", "price"],
    },
    {
      event: "booking.reservation.confirmed",
      module: "booking",
      package: "stapel-booking",
      description: "A reservation was confirmed and paid.",
      required: ["reservation_id"],
      properties: ["reservation_id", "amount"],
    },
  ],
  delivery_types: ["webhook", "notification", "ws", "custom"],
};

export const HEALTHY: Subscription = {
  id: "3f1a7c2e-0c4d-4b6f-9a11-2b3c4d5e6f70",
  event_type: "listings.listing.published",
  delivery: "webhook",
  description: "Index new listings",
  is_active: true,
  consecutive_failures: 0,
  target: { url: "https://hooks.acme.example/stapel/listings" },
  filter: { city: "Berlin" },
  has_secret: true,
  owner_id: "u-1",
  workspace_id: null,
  disabled_at: null,
  last_delivery_at: "2026-08-24T09:12:00Z",
  created_at: "2026-07-01T10:00:00Z",
  updated_at: "2026-08-24T09:12:00Z",
};

export const AUTO_DISABLED: Subscription = {
  ...HEALTHY,
  id: "8c2d9e10-7b55-4c31-9f02-1a2b3c4d5e6f",
  event_type: "booking.reservation.confirmed",
  description: "Post confirmed bookings to ops",
  is_active: false,
  consecutive_failures: 5,
  target: { url: "https://ops.acme.example/hooks/bookings" },
  filter: {},
  disabled_at: "2026-08-22T18:40:00Z",
};

export const NOTIFICATION_RULE: Subscription = {
  ...HEALTHY,
  id: "b7c81f43-2d90-4a52-8e77-9d0c1b2a3f44",
  delivery: "notification",
  description: "Email the moderation desk",
  target: { notification_type: "moderation_alert", email: "desk@acme.example" },
  filter: {},
  has_secret: false,
  last_delivery_at: null,
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
  payload: { listing_id: "l-8891", city: "Berlin", price: 890 },
  next_attempt_at: null,
  last_attempt_at: "2026-08-24T09:12:01Z",
  completed_at: "2026-08-24T09:12:01Z",
  created_at: "2026-08-24T09:12:00Z",
};

export const DELIVERY_RETRYING: Delivery = {
  ...DELIVERY_SUCCEEDED,
  id: "d1000000-0000-4000-8000-000000000002",
  event_id: "e1000000-0000-4000-8000-000000000002",
  status: "retrying",
  attempts: 2,
  response_status: 502,
  last_error: "Bad gateway",
  next_attempt_at: "2026-08-24T09:20:00Z",
  completed_at: null,
};

export const DELIVERY_DEAD: Delivery = {
  ...DELIVERY_SUCCEEDED,
  id: "d1000000-0000-4000-8000-000000000003",
  event_id: "e1000000-0000-4000-8000-000000000003",
  status: "dead",
  attempts: 6,
  response_status: 0,
  last_error: "ConnectTimeout: no answer within 10s (attempt 6 of 6)",
};

/** The 201 of a create — the one and only time a secret is readable. */
export const CREATED_WITH_SECRET = {
  id: "9a0b1c2d-3e4f-4a5b-8c9d-0e1f2a3b4c5d",
  secret: "whsec_7Qk2m1Zt4pR8vN3sX6yB9dL0fG5hJ2wC",
};
