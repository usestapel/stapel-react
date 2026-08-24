/**
 * Wire types for the stapel-recordings HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained.
 *
 * §17-native per-module contract: stapel-recordings is NOT part of the unified
 * monolith schema — it emits its OWN `docs/schema.json` (schema.json / flows.json
 * / errors.json). So, unlike the pairs that alias `@stapel/core`'s shared
 * `components`, this pair generates a package-LOCAL schema module (`pnpm gen:api`
 * with `API_SCHEMA=../stapel-recordings/docs/schema.json` + `API_OUT` pointing
 * here) and aliases the schemas it uses from `./generated/schema.js`. Do NOT
 * write parallel response bodies.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── aliases (the stapel-recordings schemas this pair uses) ────────────────────

/**
 * A recording as read from the API — its lifecycle `status`, the transcription
 * outputs (`segments_count` / `speakers_count` / `word_count` / `summary`), and
 * provenance (`source_type`, `provider_used`). Nullable fields stay unset until
 * the finalize-triggered pipeline fills them in.
 *
 * `is_processing` / `poll_after_seconds` (backend 0.20.0) are the polling
 * contract: the module serves no socket, so a client learns a recording moved
 * by re-reading it, and these two say whether that is worth doing and how soon.
 * `poll_after_seconds` is `null` exactly when `is_processing` is false, and
 * that absence is the instruction to STOP — see {@link isProcessingStatus}.
 */
export type Recording = Schemas["RecordingDTO"];
/** POST /recordings request body — open a recording + its single-PUT upload session. */
export type CreateRecordingRequest = Schemas["CreateRecordingRequest"];
/** POST /recordings 201 body — the created {@link Recording} plus its {@link UploadSession}. */
export type CreateRecordingResponse = Schemas["CreateRecordingResponse"];
/** A single-PUT upload session: where to PUT the media and by when. */
export type UploadSession = Schemas["UploadSessionDTO"];
/** POST /recordings/{id}/finalize request body — the uploaded object's size. */
export type FinalizeUploadRequest = Schemas["FinalizeUploadRequest"];
/**
 * A short-lived authorized URL to a recording's media object. The expiry
 * travels WITH the url because a player has to plan around it: the link dies
 * and the player must come back here rather than retry a dead one.
 */
export type MediaUrl = Schemas["MediaURLDTO"];
/** The receipt for a 202 — which background run was accepted, and its state. */
export type Job = Schemas["JobDTO"];
/** One speaker-attributed transcript segment. ONE shape for both doors — the
 * owner's paginated read and the projection inside a share link. */
export type TranscriptSegment = Schemas["TranscriptSegmentDTO"];
/** The anchor-paginated envelope one transcript page arrives in. */
export type TranscriptPage = Schemas["TranscriptPage"];
/** A recording as seen through a public share link. Field presence follows the
 * share's granted {@link SharePermission}s, not the caller's request. */
export type SharedRecording = Schemas["SharedRecordingDTO"];
/** The token a client presents after passing a share's passcode. */
export type ShareUnlock = Schemas["ShareUnlockDTO"];
/** Passcode presented to a share's unlock endpoint. */
export type ShareUnlockRequest = Schemas["ShareUnlockRequest"];

// ── lifecycle vocabulary (values, not a narrowed type) ───────────────────────

/**
 * The eleven values `RecordingStatus` (stapel-recordings `models.py`) can
 * carry, as DATA.
 *
 * The wire type stays `string` on purpose (see "documented corrections"
 * below); what a UI needs is not a narrower type but a VOCABULARY it can map
 * to copy, and a way to say "this is not one I know" instead of printing the
 * enum member. Fixtures use these values too — a showcase that invents
 * `"processing"` / `"done"` teaches a lifecycle no deployment emits.
 */
export const RECORDING_STATUSES = [
  "created",
  "uploading",
  "queued",
  "analyzing",
  "normalizing",
  "transcribing",
  "diarizing",
  "merging",
  "completed",
  "error",
  "deleted",
] as const;

/** One of the eleven values {@link RECORDING_STATUSES} names. */
export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

/**
 * The six statuses the PIPELINE owns the next transition of
 * (`PROCESSING_STATUSES`, stapel-recordings `models.py`). `created` /
 * `uploading` wait on the client's own upload; `completed` / `error` /
 * `deleted` are terminal.
 */
export const PROCESSING_STATUSES: readonly RecordingStatus[] = [
  "queued",
  "analyzing",
  "normalizing",
  "transcribing",
  "diarizing",
  "merging",
];

/** Statuses after which nothing further arrives. */
export const TERMINAL_STATUSES: readonly RecordingStatus[] = [
  "completed",
  "error",
  "deleted",
];

/** Is this string one of the eleven values the backend enum defines? */
export function isKnownRecordingStatus(status: string): status is RecordingStatus {
  return (RECORDING_STATUSES as readonly string[]).includes(status);
}

/** Is the pipeline the one that moves this recording next? */
export function isProcessingStatus(status: string): boolean {
  return (PROCESSING_STATUSES as readonly string[]).includes(status);
}

/** Is this status terminal (nothing further arrives)? */
export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

// ── share grants ─────────────────────────────────────────────────────────────

/**
 * The four grants a share link can carry (`SHARE_PERMISSIONS`,
 * stapel-recordings `shares.py`). `view` is implied by holding any grant at
 * all; the other three decide whether the transcript, the summary and the
 * media exist in the projection.
 */
export const SHARE_PERMISSIONS = ["view", "transcript", "summary", "media"] as const;

/** One of the four grants {@link SHARE_PERMISSIONS} names. */
export type SharePermission = (typeof SHARE_PERMISSIONS)[number];

/**
 * Does this share grant that permission? The viewer branches on the GRANT, not
 * on what it would like to render — a `view`-only link must not put up a
 * player that cannot play.
 */
export function shareGrants(
  shared: Pick<SharedRecording, "permissions">,
  permission: SharePermission
): boolean {
  return shared.permissions.includes(permission);
}

// ── query params (camelCase JS-facing shapes) ────────────────────────────────

/**
 * Query for `GET /recordings`. Without params the endpoint lists what
 * `RECORDING_POLICY` makes visible to the caller (default: their own
 * recordings). `workspaceId` narrows that to one workspace they are a member
 * of — a non-member gets `error.403.recording_workspace_forbidden`, and what
 * comes back INSIDE the workspace is still policy-filtered (a deployment opts
 * into "every member sees everything" with `WORKSPACE_LISTING_MEMBERS_SEE_ALL`).
 * `resourceKey` narrows to the single recording an opaque signed handle
 * references; a forged key yields an EMPTY listing, never an error.
 */
export interface RecordingListParams {
  /** Narrow the listing to this workspace (requires membership). */
  readonly workspaceId?: string;
  /** Narrow the listing to the recording this opaque `resource_key` references. */
  readonly resourceKey?: string;
}

/**
 * Query for `GET /recordings/{id}/transcript` — anchor pagination over
 * `sequence_num`. Omit `anchor` for the first page and pass the previous
 * page's `next_anchor` to continue; the anchor is what keeps a page stable
 * while the pipeline is still appending segments to the end.
 */
export interface TranscriptParams {
  /** `sequence_num` to page from, exclusive. */
  readonly anchor?: number;
  /** `next` = later segments (the reading direction), `prev` = earlier,
   * `center` = the window around the anchor. Defaults to `next`. */
  readonly direction?: "next" | "prev" | "center";
  /** Segments per page (backend default `TRANSCRIPT_PAGE_SIZE`). */
  readonly limit?: number;
}

/**
 * Access options for the anonymous share endpoints. `unlockToken` is what
 * `POST /shares/{token}/unlock` handed back for a passcode-protected share; it
 * travels as `X-Share-Unlock-Token` and expires on its own schedule.
 */
export interface ShareAccessOptions {
  /** The verified unlock token from {@link ShareUnlock.unlock_token}. */
  readonly unlockToken?: string;
}

/** Options for the two media reads: `?redirect=1` answers 302 to the object. */
export interface MediaUrlOptions {
  /** Ask for a 302 to the object instead of the JSON body. Only useful when
   * the URL is handed straight to an `<audio src>`; the JSON form is what lets
   * a player plan around `expires_in`. */
  readonly redirect?: boolean;
}

// ── documented corrections ────────────────────────────────────────────────────
//
// No bare-`string` narrowing on the WIRE types. stapel-recordings' contract
// types `RecordingDTO.status`, `.source_type` and `.resource_key` as open
// strings, and `source_type` really is deploy-configurable (the SOURCE_TYPES
// registry is a backend-side merge extension). Narrowing the generated types
// here would be invention. The vocabulary above is the correction that IS
// warranted: the values exist and a UI must map them, so they ship as data
// with an explicit "unknown" path, not as a type that would make the wire lie.
