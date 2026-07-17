/**
 * Wire types for the stapel-profiles HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-profiles's OWN `docs/schema.json` — the
 * §17-native per-module contract, not the unified monolith). Alias the schemas this pair uses under local
 * names here; do NOT write parallel response bodies. Where drf-spectacular +
 * openapi-typescript under-describe the runtime, apply a small documented
 * correction (see auth-react `api/types.ts` for the three canonical patterns).
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── aliases (the stapel-profiles schemas this pair uses) ──────────────────────

/**
 * GET /me 200 body — the caller's own, full profile (all settings visible).
 *
 * OPEN ENVELOPE (§66 "Дополнение владельца" tier 1, docs/pending/
 * profile-fields.md): a project may swap `PROFILES_PROFILE_MODEL` to a
 * generated subclass carrying identity/standard/custom fields this pair's
 * OWN generated schema (built from the un-swapped default package) never
 * declares. The `& Record<string, unknown>` keeps every field the schema
 * DOES know (`user_id`, `avatar`, …) fully typed while letting the
 * data-driven skin (`<ProfileSettings/>`) read `profile[entry.name]` for a
 * manifest-supplied field name without a cast. Tier 2 (a project's own
 * regenerated typed client, `docs/pending/profile-fields.md` §"Дополнение
 * владельца" point 2) is how product code gets those fields BACK as real
 * literal keys — this alias only has to not be IN THE WAY of tier 1.
 */
export type MyProfile = Schemas["ProfileResponse"] & Record<string, unknown>;
/** PATCH /me request body — a partial update; every field is optional. See
 * {@link MyProfile} for why this is an open envelope, not a closed shape. */
export type ProfileUpdate = Schemas["PatchedProfileUpdateRequest"] &
  Record<string, unknown>;
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
/**
 * One entry of GET /field-manifest — the active field manifest driving the
 * data-driven default skin (§66 "Дополнение владельца" tier 1). `kind` is
 * narrowed below ({@link ProfileFieldKind}) the same way {@link
 * RelationshipStatus} narrows a generated bare `string`.
 */
export type ProfileFieldManifestEntry = Omit<
  Schemas["ProfileFieldManifestEntry"],
  "kind"
> & { kind: ProfileFieldKind };

// ── documented corrections (drf-spectacular under-describes) ──────────────────

/**
 * `ProfileFieldManifestEntry.kind` — the backend's `ProfileFieldKind` enum
 * (`stapel_profiles/field_defs.py`), generated only as a bare `string`
 * (drf-spectacular can't type a plain-dataclass `str` attribute as a
 * choices enum the way it does a Django `TextChoices` model field). An
 * unrecognized/future kind still round-trips as a string at runtime; the
 * default skin's widget-mapper falls back to a plain text edit for anything
 * outside this union (forward-compatible, never a hard crash).
 */
export type ProfileFieldKind = "text" | "bool" | "enum" | "model_ref" | "geohash";

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
