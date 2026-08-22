/**
 * Demo fixtures — real response BODIES, not convenient inventions.
 *
 * Every shape here is what stapel-listings 0.6.1 actually serializes,
 * including the two things the OpenAPI schema does not say: a stored DAO
 * carries its `slug` (the projection is a `JSONField`), and it carries the
 * type's display config inline, which is why a card can format a badge with
 * no category read.
 */
import type {
  ListingCard,
  ListingDetailData,
  MyCounters,
  PaginatedListingCards,
} from "../src/index.js";

const BADGES = [
  {
    slug: "brand",
    type: "select" as const,
    value: ["demo.brand.bosch"],
    name: "demo.feature.brand",
    badge: true,
    order: 1,
  },
  {
    slug: "power",
    type: "int" as const,
    value: 1200,
    name: "demo.feature.power",
    badge: true,
    order: 2,
    postfix: "W",
  },
];

const TITLE_FEATURES = [
  {
    slug: "condition",
    type: "select" as const,
    value: ["demo.condition.used"],
    name: "demo.feature.condition",
    title: true,
    order: 0,
  },
];

export const DEMO_CARD: ListingCard = {
  id: 7,
  title: "Bosch GSB 1200 hammer drill",
  price: "4500.00",
  price_base: "4500.00",
  currency: "RUB",
  images: ["image/9f2c1a"],
  features_title: TITLE_FEATURES,
  features_badges: BADGES,
  location_label: "Kazan",
  status: "published",
  is_favorited: false,
};

export const DEMO_PAGE: PaginatedListingCards = {
  items: [DEMO_CARD, { ...DEMO_CARD, id: 8, title: "Makita HR2470", is_favorited: true }],
  next_anchor: null,
  prev_anchor: null,
  has_next: false,
  has_prev: false,
  count: 2,
};

export const DEMO_DETAIL: ListingDetailData = {
  id: 7,
  owner: "1f5b2b3c-0000-4000-8000-000000000001",
  category_id: "tools/power",
  title: "Bosch GSB 1200 hammer drill",
  description:
    "Barely used, one owner, comes with the original case and two drill bits.",
  language: "ru",
  price: "4500.00",
  price_base: "4500.00",
  currency: "RUB",
  images: ["image/9f2c1a", "image/71b0dd"],
  location_id: "ru-kzn",
  location_label: "Kazan",
  geohash: "ucsu5uh",
  lat: "55.796100",
  lon: "49.106400",
  features: [...TITLE_FEATURES, ...BADGES],
  features_title: TITLE_FEATURES,
  features_badges: BADGES,
  features_search: { brand: ["demo.brand.bosch"], power: [1200] },
  status: "published",
  moderation_status: "pending",
  auto_republish: false,
  countable: true,
  stock_quantity: 1,
  published_at: "2026-08-01T10:00:00Z",
  expires_at: "2026-08-31T10:00:00Z",
  created_at: "2026-07-30T09:00:00Z",
  updated_at: "2026-08-20T12:00:00Z",
  is_favorited: false,
};

export const DEMO_COUNTERS: MyCounters = { active: 2, archived: 1, drafts: 3 };
