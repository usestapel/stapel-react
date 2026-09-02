/**
 * Wire types for the FIVE operations stapel-docs 0.5.0 added — **derived from
 * the generated OpenAPI surface** (frontend-standard §2/§3), never
 * hand-maintained.
 *
 * This pair does not restate the docs contract. `DocFolder` / `DocDocument`
 * and every request body of the 27 pre-existing operations are re-exported
 * from `@stapel/docs-react` (a peer), which owns them; the aliases below are
 * only for what did not exist before this wave: the star verbs, the starred
 * listing, recents, name search, and thumbnails. The generated schema module
 * beside this file is produced by `pnpm gen:api` from stapel-docs' own
 * `docs/schema.json` at the pinned v0.5.0 ref, and is drift-gated.
 */
import type { DocDocument, DocFolder } from "@stapel/docs-react";
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** One rung of a search hit's server-materialized ancestor chain. */
export type DriveBreadcrumbNode = Schemas["BreadcrumbNodeDTO"];

/**
 * One `GET /search?q=` hit. `kind` dispatches the rendering; `breadcrumb` is
 * the root-first ancestor chain of the hit's CONTAINER, materialized
 * server-side so a result list costs exactly one request (spec §3.3).
 *
 * DOCUMENTED CORRECTION, in the calendar-react style: the contract types
 * `kind` as a bare `string`, while the backend's `present_search_hits` emits
 * only `"folder"` and `"document"` and the client dispatches on it. Narrowing
 * a two-valued enum the schema widened is a correction, not an invention — a
 * bare `string` here is what would make `hit.kind === "folder"` a branch
 * nobody could prove.
 */
export type DriveSearchHit = Omit<Schemas["SearchHitDTO"], "kind"> & {
  readonly kind: "folder" | "document";
};

/**
 * `GET /starred?workspace_id=` body — everything the user starred in the
 * workspace, live rows only, folders and documents in their own arrays.
 *
 * DOCUMENTED CORRECTION (same class as docs-react's `TrashListing`):
 * `StarredView.get` is decorated `@extend_schema(responses={200: None})`, so
 * the generated operation carries "No response body" and there is no schema
 * to alias. The shape below is the view's literal response, composed from the
 * docs pair's OWN row aliases so the row types cannot drift even while the
 * envelope is unschema'd. Recorded as a backend schema gap in the wave's
 * REQUESTS file.
 */
export interface StarredListing {
  readonly folders: readonly DocFolder[];
  readonly documents: readonly DocDocument[];
}

/**
 * A zip document's central directory as a browsable listing
 * (`GET /documents/:id/archive`, stapel-docs 0.8.0). Complete or refused —
 * the backend answers 413 past its entry-count / total-size ceilings rather
 * than truncating, so a rendered listing is never silently partial.
 */
export type ArchiveListing = Schemas["ArchiveListingDTO"];

/** One member of a browsed zip. `mime_type` is guessed from the member's
 * NAME server-side — a viewer-picking hint, not a promise about the bytes;
 * `encrypted` marks members whose extraction needs the per-request password. */
export type ArchiveEntry = Schemas["ArchiveEntryDTO"];

/** The fixed thumbnail ladder (`GET /documents/:id/thumbnail?tier=`). */
export const THUMBNAIL_TIERS = [160, 480] as const;

/** A tier of {@link THUMBNAIL_TIERS} — the server 400s on anything else. */
export type ThumbnailTier = (typeof THUMBNAIL_TIERS)[number];

// ── query params (camelCase JS-facing shapes, not wire bodies) ───────────────

/** Query for `GET /search` (`q` is mandatory: an absent query is a 400). */
export interface DriveSearchParams {
  readonly workspaceId: string;
  readonly q: string;
  /** Ceiling on returned hits; the server's own default applies when absent. */
  readonly limit?: number;
}

/** What a star verb targets — exactly one kind, like the backend's model. */
export type StarTargetKind = "folder" | "document";

/** Variables of the star toggle (`POST`/`DELETE …/star`). */
export interface StarTarget {
  readonly kind: StarTargetKind;
  readonly id: string;
}
