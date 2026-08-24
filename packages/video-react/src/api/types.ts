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
