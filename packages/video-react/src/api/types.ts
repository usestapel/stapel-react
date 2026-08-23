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
