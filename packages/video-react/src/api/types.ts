/**
 * Wire types for the stapel-video HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-video's OWN `docs/schema.json` — the §17-native
 * per-module contract). Alias the schemas this pair uses under local names
 * here; do NOT write parallel response bodies.
 *
 * ── The one thing the generated types get RIGHT and a reader gets wrong ─────
 *
 * `ScopeUsageResponse.months` and `ScopeUsageMonth.users` are OPTIONAL in the
 * generated shape, because neither is in the schema's `required` list. That is
 * not a drf-spectacular under-description to correct here: it is the wire
 * saying an answer may legitimately arrive without them. The correction —
 * "absent means no months / no rows" — is a MODEL decision, so it is made in
 * exactly one place (`model/usage.ts`'s `normalizeScopeUsage`) rather than by
 * every reader spelling `?? []` at its own call site. `?? []` at the call site
 * is the defect `@stapel/core`'s `LoadState` exists to prevent.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** `GET /video/api/v1/scopes/{scope_key}/usage/` — the whole answer. */
export type ScopeUsageResponse = Schemas["ScopeUsageResponse"];

/** One calendar month of one scope's usage, cut at LOCAL midnight in `tz`. */
export type ScopeUsageMonth = Schemas["ScopeUsageMonth"];

/**
 * One person's presence inside one scope, for one month.
 *
 * `user_id` is an ID and never a name: stapel-video does not learn names
 * (`ParticipantSpan` carries no FK by design, so erasure can pseudonymize the
 * column). The display name is the HOST's — see `nameFor` on
 * `<ScopeUsageTable>`.
 */
export type ScopeUsageRow = Schemas["ScopeUsageRow"];

// ── The meeting half of the contract ────────────────────────────────────────
//
// Six browser-callable operations the usage read has nothing to do with, and
// the DTOs they answer with. They are aliased here for the same reason the
// usage shapes are: the generated table is the source of truth, and a parallel
// hand-written body would drift the first time the backend adds a field.

/** A room. `scope_key` is `""` for a caller who only holds the join code —
 * the backend blanks it (`views.room_to_dto(reveal_scope=False)`) so a
 * stranger learns the room exists without learning whose it is. */
export type RoomResponse = Schemas["RoomResponse"];

/** `POST /rooms` — the axes a host may set when opening a room. Both are
 * optional and both have a deployment-level default, so omitting them is a
 * real choice ("whatever this deployment does") and not a gap. */
export type RoomCreateRequest = Schemas["RoomCreateRequest"];

/** `POST /rooms/{join_code}/join`. */
export type JoinRequest = Schemas["JoinRequest"];

/**
 * The outcome of asking to join: `admitted` / `waiting` / `denied`, plus the
 * provider `token` — non-null ONLY when admitted.
 *
 * This is the seam a vendor SDK cannot produce: the token is minted by
 * stapel-video's provider (`providers/livekit.py`) out of the join grant, and
 * the lobby that gates it is a stapel concept the SDK has never heard of.
 */
export type JoinResponse = Schemas["JoinResponse"];

/** One participant row. `status` is waiting/admitted/denied/left and `role` is
 * host/guest — both open strings on the wire, mapped to copy in `model/`. */
export type ParticipantResponse = Schemas["ParticipantResponse"];

/** An anchor-paginated page of participants, FIFO by `joined_at`. */
export type ParticipantListResponse = Schemas["ParticipantListResponse"];

/** `POST …/lobby/admit` and `…/lobby/deny` — the host's verdict, by
 * participant id. */
export type LobbyActionRequest = Schemas["LobbyActionRequest"];

/** `POST …/lobby/admit` — the admitted participant and the token minted for
 * them. */
export type AdmitResponse = Schemas["AdmitResponse"];

// ── The call half of the contract (0.3.0) ───────────────────────────────────
//
// stapel-video 0.11.0 added a SECOND lifecycle beside the room one, and the
// types are aliased separately because the two do not meet: a `Call` writes no
// `Room` row, carries no join code and has no lobby. A room is entered with a
// shareable secret and policed by admission; a two-party call has neither a
// third seat nor anything to share.

/**
 * One call, as both parties see it.
 *
 * Three fields a reader is likely to recompute and must not:
 *
 * - `duration_seconds` is DERIVED ON THE SERVER (`ended_at - answered_at`, and
 *   zero for a call nobody answered). A client that subtracts its own two
 *   timestamps gets a different number the moment a clock is off, and this one
 *   is what the thread line and the meter agree on.
 * - `expires_at` is the SERVER's ring deadline. The overlay counts down
 *   against this field rather than starting its own 45 seconds when the frame
 *   happened to arrive — the difference is the delivery latency, and getting
 *   it wrong shows as a ring that outlives the call it announces.
 * - `state` and `end_reason` are open strings on the wire, mapped to copy in
 *   `model/calls.ts`. An unknown value renders as a neutral sentence rather
 *   than as a blank: a backend that grows a seventh state must not blank a
 *   screen in an older client.
 */
export type CallResponse = Schemas["CallResponse"];

/** `POST /calls` — ring somebody. `thread_key` is the conversation the call
 * hangs off, and the server's default authorizer REQUIRES it: a user id is
 * not a phone number, and membership of a conversation is what makes it one. */
export type CallCreateRequest = Schemas["CallCreateRequest"];

/** `POST /calls/{id}/accept` and `POST /calls/{id}/token`. */
export type CallSessionRequest = Schemas["CallSessionRequest"];

/**
 * A call plus the credential and address ONE party dials with.
 *
 * `token` is this caller's own and nobody else's; it is deliberately absent
 * from the ring frame, so the overlay has nothing to redact. `url` is where
 * the BROWSER connects, which on a host-networked deployment is not where the
 * server connects — the backend keeps them as two settings for that reason.
 */
export type CallTokenResponse = Schemas["CallTokenResponse"];

/** `GET /calls/active` — the live call or its absence, `call: null` rather
 * than a 204 so a client parses one shape and "no call" cannot be mistaken for
 * "this request failed". */
export type ActiveCallResponse = Schemas["ActiveCallResponse"];

/** `POST /calls/{id}/token` — a fresh grant for a call already in progress.
 * It exists because a media token is presented AGAIN on every full reconnect
 * and nothing re-mints it automatically, so the TTL is a ceiling on coming
 * back from a tunnel rather than a limit on the credential. */
export type MediaTokenResponse = Schemas["MediaTokenResponse"];
