/**
 * Wire types for the stapel-gdpr HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-gdpr's OWN `docs/schema.json` — the §17-native
 * per-module contract). Alias the schemas this pair uses under local names
 * here; do NOT write parallel response bodies.
 *
 * ── The `DTO` suffix stays on the wire type, and comes off the local name ──
 *
 * stapel-gdpr serializes dataclasses (`StapelDataclassSerializer`), so the
 * emitted component names are the dataclass names: `ClosureStatusDTO`,
 * `ErasureStatusDTO`, … The alias is what this pair's public API says, and it
 * drops the suffix — a host writing `AccountClosure` should not have to know
 * which serialization strategy the backend picked. The right-hand side is
 * still the generated type, so a field that moves upstream moves here.
 *
 * ── Dates are ISO STRINGS, and stay strings ───────────────────────────────
 *
 * Every instant on this surface (`grace_ends_at`, `due_at`, `fully_erased_by`,
 * `ack_due_at`, …) is an ISO 8601 string the server computed. Nothing in this
 * pair parses one to do arithmetic on it: a "days remaining" derived in the
 * browser is a different number from the one the sweep task will act on the
 * moment a clock is off, and the whole point of these screens is that the date
 * a person reads is the date the machine will honour. Formatting for display
 * is the SKIN's job and stays a formatting-only operation.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** `GET/POST /user/account/close…` — the account's closure state. */
export type AccountClosure = Schemas["ClosureStatusDTO"];

/** One erasure request: what is being erased, and everything it waits on. */
export type ErasureStatus = Schemas["ErasureStatusDTO"];

/** One data owner's receipt inside an erasure (`recordings`, `media`, …). */
export type ErasurePart = Schemas["ErasurePartDTO"];

/** One processor's contractual deletion window for an erasure. */
export type SubprocessorObligation = Schemas["SubprocessorObligationDTO"];

/** `POST /user/data-export/request` — the accepted export job. */
export type ExportRequest = Schemas["ExportRequestDTO"];

/** `GET /user/data-export/status` — how far the archive got. */
export type ExportStatus = Schemas["ExportStatusDTO"];

/** One data-subject request and the statutory clocks on it. */
export type DsarStatus = Schemas["DsarStatusDTO"];

/** One declared data owner's liveness row (staff). */
export type DataOwnerHealth = Schemas["DataOwnerHealthDTO"];

/**
 * What a DSAR asks for. The wire declares the four Art. 15/16/17/20 kinds as
 * an enum, so the union comes off the contract rather than being retyped.
 */
export type DsarKind = NonNullable<Schemas["GDPRDsarRequest"]["kind"]>;

/**
 * A DSAR's triage state. Read off the PATCH body's enum — the response DTO
 * types `state` as a plain string (a dataclass `str` field), and a staff
 * control that offers states must offer exactly the ones the server accepts.
 */
export type DsarState = NonNullable<Schemas["PatchedGDPRDsarPatch"]["state"]>;
