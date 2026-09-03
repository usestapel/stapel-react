/**
 * Demo fixtures — real response BODIES, not convenient inventions.
 *
 * Every shape here is what stapel-listings 0.7.1 actually serializes,
 * including the two things the OpenAPI schema does not say: a stored DAO
 * carries its `slug` (the projection is a `JSONField`), and it carries the
 * type's display config inline, which is why a card can format a badge with
 * no category read.
 *
 * ── Names are copy, option VALUES are keys ─────────────────────────────────
 *
 * A DAO's `name` is `Feature.name` and a deployment stores display copy there;
 * a `select`'s stored value is the option's KEY when the catalogue is
 * translatable, which is the default. The demo used to put `demo.feature.*`
 * keys in BOTH, and the visual pass photographed the result: `demo.condition
 * .used`, `demo.feature.condition` and `demo.brand.bosch` printed at people
 * across the card, the spec table and the composer. Names are copy here now,
 * and the option values stay keys — resolved through the harness bundle, which
 * is the path a real translatable catalogue takes and the one worth showing.
 */
import type {
  ListingCard,
  ListingDetailData,
  MyCounters,
  MyListingCard,
  PaginatedListingCards,
  PaginatedMyListingCards,
} from "../src/index.js";

const BADGES = [
  {
    slug: "brand",
    type: "select" as const,
    value: ["demo.brand.bosch"],
    name: "Brand",
    badge: true,
    order: 1,
  },
  {
    slug: "power",
    type: "int" as const,
    value: 1200,
    name: "Power",
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
    name: "Condition",
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
  // The public card states an AREA (~1.1km), never the seller's door
  // (stapel-listings 0.21.0).
  geo_precision_km: 1.113,
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

/** The OWNER's card: the public one plus the moderation axis and the draft
 * twins (`MyListingCardSerializer`, stapel-listings 0.7.0). */
export function demoMyCard(
  overrides: Partial<MyListingCard> = {}
): MyListingCard {
  return {
    ...DEMO_CARD,
    moderation_status: "approved",
    // The moves the SERVER offers this row's owner (`OWNER_TRANSITIONS`,
    // stapel-listings 0.20.0) — the third axis, and the one the dashboard
    // draws its buttons from.
    available_transitions: ["paused", "sold", "archived"],
    title_draft: "",
    price_draft: null,
    images_draft: [],
    created_at: "2026-08-01T09:00:00Z",
    updated_at: "2026-08-20T12:00:00Z",
    ...overrides,
  };
}

function demoMyPage(
  items: readonly MyListingCard[]
): PaginatedMyListingCards {
  return {
    items: [...items],
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: items.length,
  };
}

/** A tab's worth of rows: one live listing whose EDIT is under review (the
 * combination `model/status.ts` exists for) and one never-published draft,
 * which renders off `title_draft` because `title` is empty until a publish. */
export const DEMO_MY_PAGE: PaginatedMyListingCards = demoMyPage([
  demoMyCard({ moderation_status: "pending" }),
  demoMyCard({
    id: 8,
    title: "",
    price: "0.00",
    status: "draft",
    moderation_status: "pending",
    title_draft: "Makita HR2470 — still writing this",
    price_draft: "6900.00",
    images_draft: ["image/aa11bb"],
  }),
]);

/** No takedowns — what almost every seller sees. */
export const DEMO_MY_NONE_BLOCKED: PaginatedMyListingCards = demoMyPage([]);

/** One takedown. It is in NO tab (`my/counters` counts it in none), which is
 * why the pane shows it above them. */
export const DEMO_MY_BLOCKED: PaginatedMyListingCards = demoMyPage([
  demoMyCard({
    id: 9,
    title: "Angle grinder, boxed",
    status: "blocked",
    moderation_status: "rejected",
  }),
]);

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
  // The OWNER's read keeps the exact point — `geo_precision_km: 0` — which
  // is what `fromDetail` loads into the composer. A public reader of the
  // same listing gets ~1.1km and a blank geohash.
  geo_precision_km: 0,
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

/** A listing with a second page behind it — the only state in which the pager
 * is drawn at all. */
export const DEMO_PAGE_WITH_NEXT: PaginatedListingCards = {
  ...DEMO_PAGE,
  next_anchor: "c2Vjb25kLXBhZ2U=",
  has_next: true,
};

/** What `GET /listings/{id}/status/` says about DEMO_DETAIL. */
export const DEMO_STATUS = {
  status: "published" as const,
  moderation_status: "pending" as const,
  is_deleted: false,
  is_expired: false,
  is_active: true,
  owner_id: DEMO_DETAIL.owner,
};
