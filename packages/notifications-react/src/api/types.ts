/**
 * Wire types for the stapel-notifications HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-notifications's OWN `docs/schema.json` — the
 * §17-native per-module contract, not the unified monolith). Alias the schemas this pair uses under local
 * names here; do NOT write parallel response bodies. Where drf-spectacular +
 * openapi-typescript under-describe the runtime, apply a small documented
 * correction (see auth-react `api/types.ts` for the three canonical patterns).
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── aliases (the stapel-notifications schemas this pair uses) ─────────────────

/** POST /devices/ request body — register a push token. */
export type DeviceTokenRequest = Schemas["DeviceTokenRequest"];
/** POST /devices/ 201 body — the registered token echoed back. */
export type DeviceTokenResponse = Schemas["DeviceTokenResponse"];
/**
 * One row of GET /devices/ — a push device registered to the caller.
 *
 * The raw token is deliberately absent: it is a bearer credential for that
 * device's push channel. A client finds ITS OWN row by hashing the token it
 * already holds (SHA-256, hex) and matching `token_fingerprint` — see
 * `model/fingerprint.ts`. `is_active` is false once the push provider rejected
 * the token: the row is still registered and nothing is delivered to it, which
 * is why the backend lists it instead of hiding it (stapel-notifications
 * MODULE.md § "The device registry").
 */
export type DeviceListItem = Schemas["DeviceListItemResponse"];
/**
 * One entry in the notification feed (a sent push, logged).
 *
 * `read_at` (stapel-notifications 0.18.0) is the instant the recipient marked
 * this row read, and `null` while it is unread — null is the state every row
 * is born in. Read it through {@link isFeedItemUnread} rather than by hand:
 * drf-spectacular types the field OPTIONAL (`read_at?`), so `item.read_at ===
 * null` is false for a row that omitted it and the boolean silently inverts.
 */
export type FeedItem = Schemas["FeedItemResponse"];
/**
 * GET /feed/ 200 body — an anchor-paginated page of {@link FeedItem}s.
 *
 * `unread_count` is counted over the WHOLE feed, not the page, and answered by
 * the same request that fills the list: a badge fed by a second endpoint
 * disagrees with the rows under it for one round trip — including the round
 * trip right after marking something read.
 */
export type NotificationFeedPage = Schemas["PaginatedFeedItemResponseList"];
/** POST /feed/read/ request body — exactly one of `ids` / `all` (see
 * {@link FeedReadTarget}, which is the shape a caller should build). */
export type FeedReadRequest = Schemas["FeedReadRequest"];
/** POST /feed/read/ 200 body — `marked` is what CHANGED (0 on a repeat), and
 * `unread_count` is the caller's remaining unread total after the write. */
export type FeedReadResponse = Schemas["FeedReadResponse"];

// ── documented corrections (drf-spectacular under-describes) ──────────────────

/**
 * Is this row still unread?
 *
 * The single reading of `read_at` in the pair. The generated schema types it
 * `string | null | undefined` because drf-spectacular marks the field optional,
 * while the endpoint always sends it — so a hand-written `read_at === null`
 * would call an absent field READ, which is the wrong way round for the one
 * field whose default is unread.
 */
export function isFeedItemUnread(item: FeedItem): boolean {
  return item.read_at === null || item.read_at === undefined;
}

/**
 * What `POST /feed/read/` is being asked to mark — the wire's XOR, spelled as
 * a type so neither-nor and both-at-once are unconstructible.
 *
 * The backend answers `error.400.read_target_required` for either mistake, and
 * deliberately does not disambiguate them: "a mark-all button that lost its
 * flag must not look like a feed that was already read" (0.18.0). A client
 * that builds its body from this union cannot reach that error at all.
 */
export type FeedReadTarget =
  | { readonly ids: readonly string[]; readonly all?: undefined }
  | { readonly all: true; readonly ids?: undefined };

/**
 * The most ids one `POST /feed/read/` accepts — a bound on the `IN (...)` the
 * endpoint can be made to build. More than this is
 * `error.400.too_many_ids`, and the answer is `{all: true}`: one `UPDATE`
 * whatever the size. Stated here so a caller with a long selection can branch
 * before the request rather than after the 400.
 */
export const FEED_READ_MAX_IDS = 500;

/**
 * A {@link FeedReadTarget} as the wire body — exactly one key, never both.
 *
 * The `ids` branch drops `all` entirely rather than sending `all: false`: the
 * backend reads "exactly one of the two was supplied", so an explicit `false`
 * is a second target and a 400.
 */
export function feedReadBody(target: FeedReadTarget): FeedReadRequest {
  return target.all === true ? { all: true } : { ids: [...target.ids] };
}

/**
 * The device platform. The generated schema types `platform` as a bare
 * `string`, but the backend (`views.VALID_PLATFORMS`, error
 * `error.400.invalid_platform`) constrains it to exactly these three values.
 * Narrowing here gives call sites a checked union and keeps the pair honest
 * about what the server accepts — the one documented correction this pair needs.
 */
export type Platform = "ios" | "android" | "web";

/**
 * Anchor-pagination query for GET /feed/ (core `CreatedAtAnchorPagination`).
 * All optional: no params fetches the newest page (default limit 20, max 50).
 */
export interface NotificationFeedParams {
  /** Anchor value to paginate from (exclusive) — a page's `next_anchor`. */
  readonly anchor?: string;
  /** Pagination direction relative to `anchor`. */
  readonly direction?: "next" | "prev" | "center";
  /** Page size (default 20, max 50). */
  readonly limit?: number;
}

/**
 * The deep-link keys `FeedItemResponse.data` may carry.
 *
 * `telemetry.scrub_data` strips everything else before the row is stored, so
 * this is the complete vocabulary the wire can deliver (stapel-notifications
 * MODULE.md § "Live feed"). Typed as a lookup rather than as prose because a
 * feed row exists to take somebody somewhere, and the skin has to know where.
 */
export const FEED_LINK_KEYS: readonly ["listing_url", "chat_url", "notifications_chat_url"] =
  ["listing_url", "chat_url", "notifications_chat_url"];

/**
 * The first declared deep link on a feed item, or `undefined`.
 *
 * Order is the declaration order above, so a row that carries both a listing
 * and a chat link opens the listing — the subject of the notification, not the
 * channel it was discussed in. Non-string values are ignored: `data` is typed
 * `additionalProperties: {}` on the wire, so a number there is a server bug,
 * not a URL.
 */
export function feedItemLink(item: FeedItem): string | undefined {
  for (const key of FEED_LINK_KEYS) {
    const value = item.data[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}
