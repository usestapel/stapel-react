/**
 * The usage answer, normalized once — and the two pieces of arithmetic a
 * reader of it must not improvise.
 *
 * ── 1. `months` and `users` are optional on the wire ───────────────────────
 *
 * Neither is in the schema's `required` list, so the generated types make them
 * `?`. This module is the ONE place allowed to decide that absent means "no
 * months" / "no rows" ({@link normalizeScopeUsage}). Everywhere else the
 * arrays are non-optional, and a reader that wanted `?? []` cannot reach for
 * it — which matters because `data ?? []` is the exact line that turned a
 * 404 into "you have no workspaces" for hours (`@stapel/core`'s `loadState`).
 *
 * Note the ORDER of the two facts: "absent" is flattened here, but the
 * SURROUNDING load is still a `LoadState`. Normalizing an absent array to `[]`
 * is only safe once you already know the request SUCCEEDED — and that is
 * precisely the guarantee `matchLoad`'s `ready` arm hands this function.
 *
 * ── 2. Boundaries come off the wire; only the LABEL is ours ────────────────
 *
 * `period_start`/`period_end` are the server's, cut at local midnight in the
 * requested zone. Nothing here re-derives a boundary, adds 30 days, or
 * multiplies hours: a DST month is genuinely 743 or 745 hours and any
 * client-side month arithmetic would disagree with the numbers it is labelling
 * twice a year.
 */
import { isErrorCode, toFlowError } from "@stapel/core";
import type {
  ScopeUsageMonth,
  ScopeUsageResponse,
  ScopeUsageRow,
} from "../api/types.js";

/** stapel-video's own defaults for the read (`conf.DEFAULTS` / the view). */
export const DEFAULT_USAGE_MONTHS = 6;
/** The view's ceiling — beyond it the answer is `video_invalid_usage_period`. */
export const MAX_USAGE_MONTHS = 36;
/** `?tz=` defaults to UTC server-side; spelled here so the query key is total. */
export const DEFAULT_USAGE_TZ = "UTC";

/** One month, with its rows made non-optional. */
export interface UsageMonth {
  /** The bucket label, `YYYY-MM`, in the answer's zone. */
  readonly month: string;
  /** The month's first instant, UTC ISO-8601 — the SERVER's boundary. */
  readonly periodStart: string;
  /** The month's end (exclusive), UTC ISO-8601 — the SERVER's boundary. */
  readonly periodEnd: string;
  /** One row per person, longest presence first. Empty is a real answer. */
  readonly rows: readonly ScopeUsageRow[];
}

/** The whole answer, with both optional arrays resolved. */
export interface ScopeUsageAnswer {
  readonly scopeKey: string;
  readonly tz: string;
  /** Newest month first. Empty is a real answer. */
  readonly months: readonly UsageMonth[];
}

/**
 * The wire body → {@link ScopeUsageAnswer}. The single place `months`/`users`
 * being absent is turned into an empty array.
 */
export function normalizeScopeUsage(
  response: ScopeUsageResponse
): ScopeUsageAnswer {
  return {
    scopeKey: response.scope_key,
    tz: response.tz,
    months: (response.months ?? []).map(normalizeMonth),
  };
}

function normalizeMonth(month: ScopeUsageMonth): UsageMonth {
  return {
    month: month.month,
    periodStart: month.period_start,
    periodEnd: month.period_end,
    rows: month.users ?? [],
  };
}

/** The month labels an answer carries, newest first — the selector's options. */
export function usageMonthLabels(answer: ScopeUsageAnswer): readonly string[] {
  return answer.months.map((m) => m.month);
}

/**
 * One month out of an answer: the named label, else the newest month present.
 *
 * `undefined` — and NOT `[]` — when the answer carries no month at all, so a
 * caller cannot mistake "this answer has nothing in it" for "this month had no
 * calls". The two render differently and only one of them is about a month.
 */
export function usageMonth(
  answer: ScopeUsageAnswer,
  label?: string | undefined
): UsageMonth | undefined {
  if (label !== undefined) {
    const named = answer.months.find((m) => m.month === label);
    if (named) return named;
  }
  return answer.months[0];
}

/** The footer numbers for one month's rows. */
export interface UsageTotals {
  /** People with any presence in the month — the row count. */
  readonly people: number;
  /** Person-seconds: each row is already unioned, so the sum is meaningful. */
  readonly presenceSeconds: number;
  /**
   * The sum of each person's distinct-call count — ATTENDANCES, not distinct
   * calls in the scope. Three people in one meeting sum to 3. There is no
   * scope-wide distinct-room number on the wire and this pair does not invent
   * one; the column footer says "attendances" for that reason.
   */
  readonly attendances: number;
  /** The sum of each person's distinct connections (where reconnects show up). */
  readonly connections: number;
}

export function usageTotals(rows: readonly ScopeUsageRow[]): UsageTotals {
  let presenceSeconds = 0;
  let attendances = 0;
  let connections = 0;
  for (const row of rows) {
    presenceSeconds += row.presence_seconds;
    attendances += row.rooms;
    connections += row.connections;
  }
  return { people: rows.length, presenceSeconds, attendances, connections };
}

/**
 * Seconds → `h:mm`, hours uncapped (`25:30` is a real answer for a month).
 *
 * Deliberately not `Intl.NumberFormat`-flavoured and not locale-switched: the
 * unit separators of a duration are the same glyph everywhere this ships, and
 * the column reads as a column when every cell has the same shape. Seconds are
 * dropped (rounded DOWN), because a talk-time report that disagrees with
 * itself by a rounding-up minute is worse than one that is consistently
 * conservative.
 */
export function formatPresence(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${hours}:${minutes < 10 ? "0" : ""}${minutes}`;
}

/**
 * Is this the refusal that means "not available for this workspace"?
 *
 * `error.404.video_scope_not_found` is UNIFORM over three situations — the
 * scope does not exist, it holds no calls, and the caller has no
 * `USAGE_MANDATE` in it — because a 403 would confirm that a guessed tenant id
 * is real. A screen must therefore say one sentence covering all three and
 * must NOT render an empty table: "no rows" would be a claim about the
 * workspace that this pair has no way to check.
 */
export function isScopeUnavailable(error: unknown): boolean {
  return isErrorCode(toFlowError(error), "error.404.video_scope_not_found");
}

/** The narrowest window the read accepts. Below it the answer is
 * `video_invalid_usage_period`. */
export const MIN_USAGE_MONTHS = 1;

/**
 * A caller's `months` brought onto the range the view accepts (1..36).
 *
 * The predicate below has existed since 0.1.0 and reached no screen, so
 * `<ScopeUsagePane months={48}/>` produced a server 400 rendered as a generic
 * error — a refusal the pair already owned the rule for. Clamping rather than
 * throwing: `months` is a display preference, and the report a person came for
 * is better served by 36 months than by an error page about the number 48. The
 * screen still names the clamp, so nobody thinks they are reading 48.
 */
export function clampUsageMonths(months: number): number {
  if (!Number.isFinite(months)) return DEFAULT_USAGE_MONTHS;
  const whole = Math.trunc(months);
  if (whole < MIN_USAGE_MONTHS) return MIN_USAGE_MONTHS;
  if (whole > MAX_USAGE_MONTHS) return MAX_USAGE_MONTHS;
  return whole;
}

/** Would this `months` be refused by the view? The predicate the pane uses to
 * say so BEFORE asking. */
export function isUsageMonthsOutOfRange(months: number): boolean {
  return (
    !Number.isFinite(months) ||
    Math.trunc(months) < MIN_USAGE_MONTHS ||
    Math.trunc(months) > MAX_USAGE_MONTHS
  );
}

/**
 * Is this the refusal about the PERIOD rather than the scope?
 * `error.400.video_invalid_usage_period` — a malformed `month`, a `months`
 * outside 1..36, or a `tz` that is not an IANA zone.
 */
export function isInvalidUsagePeriod(error: unknown): boolean {
  return isErrorCode(toFlowError(error), "error.400.video_invalid_usage_period");
}

/**
 * `YYYY-MM` as a month a person reads — "August 2026", in their language.
 *
 * The wire's month key is a machine value and the selector offered it raw, so
 * the one control on the usage screen read `2026-08` while every date beside it
 * was formatted (visual pass M-2, N-5). Formatted at UTC noon: the key names a
 * calendar month, not an instant, and constructing it at local midnight moves
 * it to the previous month west of Greenwich. A value that is not a month is
 * returned unchanged rather than guessed at.
 */
export function usageMonthLabel(
  month: string,
  locale: string | undefined
): string {
  const parts = /^(\d{4})-(\d{2})$/.exec(month);
  if (parts === null) return month;
  const year = Number(parts[1]);
  const index = Number(parts[2]) - 1;
  if (index < 0 || index > 11) return month;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, index, 1, 12)));
}
