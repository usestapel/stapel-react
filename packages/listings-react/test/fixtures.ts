/**
 * Real response bodies. Two properties they carry that the OpenAPI schema
 * does not describe, and that the suite depends on:
 *
 *  - a stored DAO carries its `slug` (`build_features_list` injects it, and
 *    the field is a `JSONField`, so nothing filters it out);
 *  - a stored DAO carries its type's display config inline (`postfix`,
 *    `precision`, …), which is what lets a card format a badge with no
 *    category read.
 */
import type { FeatureDef } from "@stapel/attributes-react";
import type {
  ListingCard,
  ListingDetailData,
  ListingDraft,
  ListingStatusInfo,
  MyCounters,
  MyListingCard,
  PaginatedListingCards,
  PaginatedMyListingCards,
} from "../src/index.js";

export const OWNER = "1f5b2b3c-0000-4000-8000-000000000001";
export const STRANGER = "1f5b2b3c-0000-4000-8000-0000000000ff";

export const BADGE_DAOS = [
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

export const TITLE_DAOS = [
  {
    slug: "condition",
    type: "string" as const,
    value: "used",
    name: "Condition",
    title: true,
    order: 0,
  },
];

export const CARD: ListingCard = {
  id: 7,
  title: "Bosch GSB 1200",
  price: "4500.00",
  price_base: "4500.00",
  currency: "RUB",
  images: ["image/9f2c1a"],
  features_title: TITLE_DAOS,
  features_badges: BADGE_DAOS,
  location_label: "Kazan",
  // The public read's AREA, not its point (stapel-listings 0.21.0): the
  // card is served to strangers, so the coordinates are rounded to ~1.1km
  // and `geohash` comes back blank.
  geo_precision_km: 1.113,
  status: "published",
  is_favorited: false,
};

export const PAGE: PaginatedListingCards = {
  items: [CARD],
  next_anchor: null,
  prev_anchor: null,
  has_next: false,
  has_prev: false,
  count: 1,
};

/**
 * The OWNER's card — what `GET my/listings/` sends (`MyListingCardSerializer`,
 * stapel-listings 0.7.0): the public card plus `moderation_status` and the
 * `*_draft` twins. Defaults describe a published, approved listing whose
 * draft twins are empty, which is what a row looks like after a publish
 * promotes them.
 */
export function myCard(overrides: Partial<MyListingCard> = {}): MyListingCard {
  return {
    ...CARD,
    moderation_status: "approved",
    // What the SERVER says this row's owner may do with it
    // (`OWNER_TRANSITIONS`, 0.20.0). A published listing may be paused,
    // marked sold or archived — and nothing else: publishing is
    // moderation's decision, not the seller's.
    available_transitions: ["paused", "sold", "archived"],
    title_draft: "",
    price_draft: null,
    images_draft: [],
    created_at: "2026-07-30T09:00:00Z",
    updated_at: "2026-08-20T12:00:00Z",
    ...overrides,
  };
}

export const MY_CARD: MyListingCard = myCard();

export function myPage(
  items: readonly MyListingCard[] = [MY_CARD],
  overrides: Partial<PaginatedMyListingCards> = {}
): PaginatedMyListingCards {
  return {
    items: [...items],
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: items.length,
    ...overrides,
  };
}

export const MY_PAGE: PaginatedMyListingCards = myPage();

/** No takedowns — the answer to `?status=blocked` for almost every seller. */
export const NO_BLOCKED: PaginatedMyListingCards = myPage([]);

export function detail(
  overrides: Partial<ListingDetailData> = {}
): ListingDetailData {
  return {
    id: 7,
    owner: OWNER,
    category_id: "tools/power",
    title: "Bosch GSB 1200",
    description: "Barely used, one owner.",
    language: "ru",
    price: "4500.00",
    price_base: "4500.00",
    currency: "RUB",
    images: ["image/9f2c1a"],
    location_id: "ru-kzn",
    location_label: "Kazan",
    geo_precision_km: 0,
    geohash: "ucsu5uh",
    lat: "55.796100",
    lon: "49.106400",
    features: [...TITLE_DAOS, ...BADGE_DAOS],
    features_title: TITLE_DAOS,
    features_badges: BADGE_DAOS,
    features_search: { power: [1200] },
    status: "published",
    moderation_status: "approved",
    auto_republish: false,
    countable: false,
    stock_quantity: null,
    published_at: "2026-08-01T10:00:00Z",
    expires_at: "2026-08-31T10:00:00Z",
    created_at: "2026-07-30T09:00:00Z",
    updated_at: "2026-08-20T12:00:00Z",
    is_favorited: false,
    ...overrides,
  };
}

export function statusInfo(
  overrides: Partial<ListingStatusInfo> = {}
): ListingStatusInfo {
  return {
    status: "published",
    moderation_status: "approved",
    is_deleted: false,
    is_expired: false,
    is_active: true,
    owner_id: OWNER,
    ...overrides,
  };
}

export const DRAFT: ListingDraft = {
  id: 42,
  category_id: "tools/power",
  currency: "RUB",
  // Server-computed since 0.7.1 and `readOnly` in the schema, so it is present
  // on every response and absent from every request body. Empty here: this
  // draft carries no coordinates for `geo.geohash_encode` to bucket.
  geohash_draft: "",
  status: "draft",
  moderation_status: "pending",
  created_at: "2026-08-22T09:00:00Z",
  updated_at: "2026-08-22T09:00:00Z",
};

export const COUNTERS: MyCounters = { active: 2, archived: 1, drafts: 3 };

/**
 * A category schema exactly as `GET /categories/{id}/features/` sends it:
 * `config` VERBATIM, with no defaults filled in (`FeatureCompactSerializer
 * .get_config` returns `obj.config`, never `get_config_with_defaults()`).
 */
export const FEATURES: readonly FeatureDef[] = [
  {
    slug: "brand",
    name: "Brand",
    mandatory: true,
    config: {
      type: "select",
      options: [
        { value: "bosch", label: "Bosch" },
        { value: "makita", label: "Makita" },
      ],
      maxSelected: 1,
    },
  },
  {
    slug: "power",
    name: "Power",
    config: { type: "int", min: 0, max: 5000, postfix: "W" },
  },
];
