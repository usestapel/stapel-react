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

// ── documented corrections ────────────────────────────────────────────────────
//
// None. Unlike calendar-react (whose error registry — `calendar_invalid_rsvp` —
// enumerated the exact submittable values, licensing a bare-`string` → union
// narrowing), stapel-recordings' contract does NOT enumerate the values of any
// bare-`string` field: `RecordingDTO.status` and `.source_type` are opaque, and
// `error.400.recording_invalid_state` names no states. Narrowing them here would
// be invention, not a correction, so the generated `string` types stand. The GET
// /recordings list carries no documented query params (it "lists your own"), so
// no params type is added either. Revisit when the backend widens the contract.
