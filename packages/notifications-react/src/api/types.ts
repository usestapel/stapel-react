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
/** One entry in the notification feed (a sent push, logged). */
export type FeedItem = Schemas["FeedItemResponse"];
/** GET /feed/ 200 body — an anchor-paginated page of {@link FeedItem}s. */
export type NotificationFeedPage = Schemas["PaginatedFeedItemResponseList"];

// ── documented corrections (drf-spectacular under-describes) ──────────────────

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
