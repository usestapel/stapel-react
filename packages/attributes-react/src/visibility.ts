/**
 * The visibility axis, browser side — mirrors `stapel_attributes/visibility.py`.
 *
 * ── Why the axis exists at all ─────────────────────────────────────────────
 *
 * Almost every attribute DESCRIBES the thing being sold: mileage, colour,
 * screen size. A handful IDENTIFY one specific physical unit instead — a VIN,
 * an IMEI, a serial number, a registry number — and that is a different kind
 * of fact. Reading a description tells you what is for sale. Reading an
 * identifier lets a stranger act as if the unit were theirs: order duplicate
 * keys against the VIN, clone a handset from its IMEI, file a registry
 * request against someone else's flat.
 *
 * So the catalogue records, once, per definition, WHO MAY READ a stored
 * value, and every read path obeys that one decision instead of each renderer
 * re-deciding it. The axis is orthogonal to `mandatory`: a non-public feature
 * is still required, still validated, still stored, still moderated and still
 * editable by the seller who typed it. It is only never handed to a reader
 * who is not entitled to it — and, because a hidden value cannot honestly be
 * a headline, it is never a title and never a badge.
 *
 * ── How a withheld value arrives ───────────────────────────────────────────
 *
 * stapel-listings redacts per viewer and keeps the ROW, as a value-free stub,
 * in place and in order:
 *
 * ```json
 * {"slug":"vin","type":"string","name":"VIN","order":15,
 *  "visibility":"owner","redacted":true,"present":true}
 * ```
 *
 * Keeping the row is deliberate: the public spec table then has the same rows
 * in the same order as the seller's own, and a buyer can see that the field
 * exists and was answered. `present` is the only thing this system can
 * honestly say about it.
 *
 * ── Presence is a fact; verification is a claim ────────────────────────────
 *
 * Nothing in the fleet runs a VIN or an IMEI check. A renderer may therefore
 * say "the seller supplied this" off {@link isValuePresent}, and may say
 * "this was checked" ONLY off {@link valueVerification}, which nothing writes
 * today. The engine never synthesizes a verification, so the stronger badge
 * cannot upgrade itself by accident — and the day a real integration writes
 * one, it upgrades without another release here.
 */
import type { FeatureDef } from "./types.js";

/** `FeatureDef.visibility` — which audience may READ a stored value. */
export type FeatureVisibility = "public" | "owner" | "staff";

/** Every accepted visibility, weakest (most readable) first. */
export const FEATURE_VISIBILITIES: readonly FeatureVisibility[] = ["public", "owner", "staff"];

/** A redacted stub says so on its own row, rather than leaving a reader to
 * infer "hidden" from "the `value` key is missing" — which is also what an
 * unanswered optional field looks like. */
const REDACTED_MARKER = "redacted";

/** Whether the seller actually filled the (withheld) value in. */
const PRESENCE_MARKER = "present";

/** Reserved for the day something outside this system checks the value. */
const VERIFICATION_MARKER = "verification";

/**
 * A verification RESULT, passed through redaction verbatim.
 *
 * stapel-attributes deliberately does not define the `status` vocabulary
 * beyond "absent means nobody checked": the product that runs the check owns
 * what its outcomes mean. This package therefore prints a verified badge for
 * exactly one status it can read ({@link VERIFICATION_VERIFIED}) and treats
 * every other one as "something was attempted and this build cannot say
 * what" — which falls back to the neutral presence copy rather than upgrading
 * on a word it does not understand.
 */
export interface FeatureVerification {
  /** The outcome, in the checking product's own vocabulary. */
  readonly status?: string;
  /** ISO-8601 instant the check was run. */
  readonly verified_at?: string | null;
  /** Who checked — a machine identifier, never copy for a reader. */
  readonly source?: string | null;
  readonly [key: string]: unknown;
}

/** The one `verification.status` this package will print a verified badge
 * for. Anything else is not understood, and not understood is not verified. */
export const VERIFICATION_VERIFIED = "verified";

/** Anything with string keys — a `FeatureValueDto`, a stored DAO, a stub. The
 * three markers ride on whichever of them a caller happens to hold. */
type MarkedRow = { readonly [key: string]: unknown } | null | undefined;

/**
 * A feature's declared visibility, defaulting to `public`.
 *
 * FAIL-SAFE, in the one direction that cannot leak: an absent or empty value
 * is `public` (that is the whole point of the default — a definition written
 * before this axis existed keeps behaving as it did), but a string that is
 * NOT a known visibility is treated as `staff`, the most restrictive one.
 * Python raises `UnknownVisibility` on the same input; a browser has nobody
 * to raise at, and a typo like `"privat"` must not publish a VIN.
 */
export function featureVisibility(feature: FeatureDef): FeatureVisibility {
  const raw: unknown = feature?.["visibility"];
  if (raw === undefined || raw === null || raw === "") return "public";
  if (raw === "public" || raw === "owner" || raw === "staff") return raw;
  return "staff";
}

/** Whether anyone may read this feature's stored value — the predicate a
 * badge strip and a title line filter on. */
export function isPublicFeature(feature: FeatureDef): boolean {
  return featureVisibility(feature) === "public";
}

/** Whether this row is a value-free stub rather than a value. */
export function isRedactedValue(row: MarkedRow): boolean {
  return row !== null && row !== undefined && row[REDACTED_MARKER] === true;
}

/** Whether the seller answered the field whose value is withheld. A FACT this
 * system observed — never a statement about the value being correct. */
export function isValuePresent(row: MarkedRow): boolean {
  return row !== null && row !== undefined && row[PRESENCE_MARKER] === true;
}

/**
 * The verification result carried on a row, when one is there.
 *
 * Absent for everything in the fleet today: no product runs a VIN or an IMEI
 * check yet. A renderer branches on it anyway, so the stronger badge is
 * correct on the day a real check writes one and never before.
 */
export function valueVerification(row: MarkedRow): FeatureVerification | undefined {
  if (row === null || row === undefined) return undefined;
  const raw: unknown = row[VERIFICATION_MARKER];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as FeatureVerification;
}

/** Whether a row carries a verification this package understands well enough
 * to print as "checked". See {@link VERIFICATION_VERIFIED}. */
export function isValueVerified(row: MarkedRow): boolean {
  return valueVerification(row)?.status === VERIFICATION_VERIFIED;
}
