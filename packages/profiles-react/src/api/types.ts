/**
 * Wire types for the stapel-profiles HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from `@stapel/core`
 * (`packages/core/src/generated/schema.ts`, produced by `pnpm gen:api` from the
 * unified all-modules OpenAPI). Alias the schemas this pair uses under local
 * names here; do NOT write parallel response bodies. Where drf-spectacular +
 * openapi-typescript under-describe the runtime, apply a small documented
 * correction (see auth-react `api/types.ts` for the three canonical patterns).
 */
import type { components } from "@stapel/core";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── aliases (the stapel-profiles schemas this pair uses) ──────────────────────

/** GET /me 200 body — the caller's own, full profile (all settings visible). */
export type MyProfile = Schemas["ProfileResponse"];
/** PATCH /me request body — a partial update; every field is optional. */
export type ProfileUpdate = Schemas["PatchedProfileUpdateRequest"];
/** GET /{user_id} 200 body — another user's public profile projection. */
export type PublicProfile = Schemas["ProfilePublicResponse"];
/** GET /{user_id}/relationship 200 body — the caller↔target relationship. */
export type RelationshipInfo = Schemas["RelationshipResponse"];
/** 200 body of a follow/unfollow/block/unblock action — the new status. */
export type RelationshipAction = Schemas["RelationshipActionResponse"];
/** GET /me/followers 200 body — the caller's followers as user ids + count. */
export type Followers = Schemas["FollowersResponse"];
/** GET /me/following 200 body — the users the caller follows + count. */
export type Following = Schemas["FollowingResponse"];
/** One entry of GET /languages/ — a supported UI language. */
export type Language = Schemas["LanguageResponse"];

// ── documented corrections (drf-spectacular under-describes) ──────────────────

/**
 * The caller↔target relationship as seen from the caller. The generated schema
 * types `status` / `relationship_status` as a bare `string`, but the backend
 * (`models.RelationshipStatus` + the public serializer) constrains it to exactly
 * these values: the stored `neutral | following | blocked`, plus `self` when the
 * target IS the caller. Narrowing here gives call sites a checked union — the
 * one documented correction this pair needs.
 */
export type RelationshipStatus = "neutral" | "following" | "blocked" | "self";

/**
 * GET /me/blocked 200 body. drf-spectacular emits a bare `array` for this view
 * (no element serializer), so the generated schema can't type the items; the
 * backend returns the blocked users' ids. Typed here as a `user_id` list —
 * flagged NOT GENERATED so it can drop to the alias once the backend annotates
 * the response.
 */
export type Blocked = readonly string[];
