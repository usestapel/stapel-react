/**
 * The module's closed vocabularies, hand-mirrored from the backend.
 *
 * ── Why these are not generated ─────────────────────────────────────────────
 *
 * `stapel-moderation` declares every one of them as a Django `TextChoices`
 * class, but the DRF serializers type the fields as plain `CharField`, so
 * `docs/schema.json` says `{"type": "string"}` and `gen:api` can only emit
 * `string`. A console whose decision radio group, sanction ladder and state
 * tags were typed `string` would compile with a typo in it, so the words live
 * here — WITH the source line beside each set, so the drift is greppable — and
 * `test/enums.test.ts` re-reads the sibling's `models.py` and fails when a
 * member is added, removed or renamed there.
 *
 * Nothing here is a UI decision: order is the backend's declaration order,
 * which for `SANCTION_KINDS` is also the escalation ladder.
 */

/** `models.py:33` `CaseState` — the single status vocabulary of the module. */
export const CASE_STATES = [
  "open",
  "screening",
  "queued",
  "claimed",
  "resolved",
] as const;
export type CaseState = (typeof CASE_STATES)[number];

/**
 * `models.py:75` `VerdictDecision`. `needs_review` is the machine saying "a
 * person must look" — it is NOT terminal for the case, which is why the
 * console disables the sanction block under it.
 */
export const DECISIONS = [
  "approved",
  "rejected",
  "needs_review",
  "dismissed",
] as const;
export type Decision = (typeof DECISIONS)[number];

/** `models.py:99` `TERMINAL_DECISIONS` — the three that close a case. */
export const TERMINAL_DECISIONS = ["approved", "rejected", "dismissed"] as const;

/** `models.py:106` `VerdictSource` — who or what produced a verdict. */
export const VERDICT_SOURCES = [
  "llm",
  "rule",
  "human",
  "policy_default",
  "appeal",
] as const;
export type VerdictSource = (typeof VERDICT_SOURCES)[number];

/** `models.py:116` `CaseOrigin` — how the case came into being. */
export const CASE_ORIGINS = [
  "submission",
  "report",
  "manual",
  "rescan",
  "appeal",
] as const;
export type CaseOrigin = (typeof CASE_ORIGINS)[number];

/** `models.py:126` `CaseEventKind` — the append-only audit vocabulary. */
export const CASE_EVENT_KINDS = [
  "created",
  "reported",
  "resubmitted",
  "screen_started",
  "screen_failed",
  "verdict",
  "state_changed",
  "applied",
  "apply_failed",
  "claimed",
  "released",
  "sanctioned",
  "appealed",
  "reopened",
  "notified",
] as const;
export type CaseEventKind = (typeof CASE_EVENT_KINDS)[number];

/** `models.py:146` `SanctionKind` — declared in escalation order. */
export const SANCTION_KINDS = [
  "warning",
  "content_removed",
  "posting_restricted",
  "suspended",
  "banned",
] as const;
export type SanctionKind = (typeof SANCTION_KINDS)[number];

/** `models.py:156` `SanctionState` — a sanction's own lifecycle. */
export const SANCTION_STATES = [
  "active",
  "expired",
  "lifted",
  "overturned",
] as const;
export type SanctionState = (typeof SANCTION_STATES)[number];

/** `models.py:173` `AppealState` (DSA Art. 20). */
export const APPEAL_STATES = [
  "open",
  "upheld",
  "overturned",
  "withdrawn",
] as const;
export type AppealState = (typeof APPEAL_STATES)[number];

/** The three outcomes `POST appeals/{id}/resolve` accepts — `APPEAL_STATES`
 * minus `open`, which is where an appeal starts rather than where it lands. */
export const APPEAL_OUTCOMES = ["upheld", "overturned", "withdrawn"] as const;
export type AppealOutcome = (typeof APPEAL_OUTCOMES)[number];

/**
 * The eleven complaint reasons the module ships (`registry.py:207-223`).
 *
 * A deployment may add, override or remove reasons at runtime, so the FORM is
 * always built from `GET policy` — never from this list. It exists so the pair
 * can ship en/ru/es copy for the built-ins (the backend hands out `label_key`
 * / `description_key`, i18n KEYS, and expects somebody to have the texts), and
 * so a policy carrying an unknown code renders the code rather than nothing.
 */
export const BUILTIN_REASON_CODES = [
  "spam",
  "offensive",
  "harassment",
  "counterfeit",
  "fraud",
  "illegal",
  "adult",
  "personal_data",
  "off_platform_payment",
  "wrong_category",
  "other",
] as const;
export type BuiltinReasonCode = (typeof BUILTIN_REASON_CODES)[number];

/**
 * Reason codes the MODULE produces (`registry.py:228-231`). A person never
 * picks one, but a verdict and a policy disclosure name them, so they need
 * copy exactly as the complaint reasons do.
 */
export const SYSTEM_REASON_CODES = [
  "screening_unavailable",
  "screening_held",
  "low_confidence",
] as const;
export type SystemReasonCode = (typeof SYSTEM_REASON_CODES)[number];

/**
 * Why a case card has no content to show (`views.py:_case_content` +
 * `presenters.present_content`, and `not_loaded` from `CaseDetailPresenterDTO`
 * since backend 0.3.0). Anything else the backend puts in `content.error` is
 * rendered verbatim as a technical detail — the console never swallows it.
 */
export const CONTENT_UNAVAILABLE_REASONS = [
  "no_content_function",
  "forbidden",
  "target_not_found",
  "not_loaded",
] as const;
export type ContentUnavailableReason =
  (typeof CONTENT_UNAVAILABLE_REASONS)[number];

/** Membership test that also narrows — used wherever a wire `string` meets a
 * vocabulary (a state tag, a decision radio, a sanction ladder row). */
export function isMember<T extends string>(
  vocabulary: readonly T[],
  value: string
): value is T {
  return (vocabulary as readonly string[]).includes(value);
}
