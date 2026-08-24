/**
 * Which WINDOW to ask the backend for, and which cells to draw in it.
 *
 * The range is a real dimension of this contract — `GET /calendar`,
 * `GET /events` and `GET /availability` all take `?start=&end=`, declared in
 * the schema since stapel-calendar 0.6.1. A view that never sent them could
 * only ever show the server's default window (now .. now + 90 days), which is
 * a list, not a calendar: there would be no previous month.
 *
 * ── Local time, Monday first ──────────────────────────────────────────────
 *
 * Grid arithmetic happens in the READER's zone: a month grid is a picture of
 * the reader's calendar, and asking "which day is this instant on" is a
 * question only their zone can answer. The wire stays tz-aware ISO 8601 in
 * both directions.
 *
 * Weeks start on Monday, matching the backend's `recurrence_weekdays`
 * convention (`0=Mon..6=Sun`) — so a weekday index means the same thing in a
 * grid column and in a recurrence rule.
 */

/** The three shapes a calendar screen takes. */
export type CalendarViewMode = "month" | "week" | "day";

/** A half-open window, as the wire spells it. */
export interface CalendarRange {
  readonly start: string;
  readonly end: string;
}

const DAY_MS = 86_400_000;

/** Midnight at the start of the local day `at` falls on. */
function startOfDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

/** `0` for Monday … `6` for Sunday (JS `getDay()` is Sunday-first). */
export function weekdayIndex(at: Date): number {
  return (at.getDay() + 6) % 7;
}

function startOfWeek(at: Date): Date {
  const day = startOfDay(at);
  day.setDate(day.getDate() - weekdayIndex(day));
  return day;
}

function addDays(at: Date, days: number): Date {
  const next = new Date(at.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/** The anchor a view is centred on, as a wire instant. Invalid input falls
 * back to now, so a bad URL parameter shows this month instead of nothing. */
function anchorDate(anchorIso: string): Date {
  const at = new Date(anchorIso);
  return Number.isNaN(at.getTime()) ? new Date() : at;
}

/** A month grid is always six weeks, so the grid does not change height as
 * the reader pages through the year. */
const MONTH_GRID_WEEKS = 6;

/**
 * The days a view draws, as local-midnight wire instants.
 *
 * - `month` — 42 days: the Monday on or before the 1st, then six full weeks.
 *   The trailing/leading days belong to the neighbouring months and are drawn
 *   muted; they are inside the query window because they are on screen.
 * - `week` — 7 days from the Monday of the anchor's week.
 * - `day` — the anchor's day alone.
 */
export function viewDays(
  mode: CalendarViewMode,
  anchorIso: string
): readonly string[] {
  const anchor = anchorDate(anchorIso);
  if (mode === "day") return [startOfDay(anchor).toISOString()];
  const first =
    mode === "week"
      ? startOfWeek(anchor)
      : startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const count = mode === "week" ? 7 : MONTH_GRID_WEEKS * 7;
  return Array.from({ length: count }, (_unused, index) =>
    addDays(first, index).toISOString()
  );
}

/** The query window for a view: the first drawn day through the end of the
 * last one. Exactly what is on screen — no more, so a month page is one
 * month's worth of expansion, and no less, so nothing on screen is missing. */
export function viewRange(
  mode: CalendarViewMode,
  anchorIso: string
): CalendarRange {
  const days = viewDays(mode, anchorIso);
  const first = days[0] ?? new Date().toISOString();
  const last = days[days.length - 1] ?? first;
  return {
    start: first,
    end: new Date(new Date(last).getTime() + DAY_MS - 1).toISOString(),
  };
}

/** Page a view forwards (`+1`) or back (`-1`) by its own unit. */
export function shiftAnchor(
  mode: CalendarViewMode,
  anchorIso: string,
  delta: number
): string {
  const anchor = anchorDate(anchorIso);
  if (mode === "month") {
    return new Date(
      anchor.getFullYear(),
      anchor.getMonth() + delta,
      1
    ).toISOString();
  }
  return addDays(anchor, delta * (mode === "week" ? 7 : 1)).toISOString();
}

/** Do two wire instants fall on the same local day? */
export function isSameDay(a: string, b: string): boolean {
  const left = new Date(a);
  const right = new Date(b);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) {
    return false;
  }
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

/** Is this drawn day outside the month the view is anchored on? (The muted
 * leading/trailing cells of a month grid.) */
export function isOutsideMonth(dayIso: string, anchorIso: string): boolean {
  const day = new Date(dayIso);
  const anchor = anchorDate(anchorIso);
  if (Number.isNaN(day.getTime())) return false;
  return (
    day.getMonth() !== anchor.getMonth() ||
    day.getFullYear() !== anchor.getFullYear()
  );
}

/** Group anything carrying a wire `start` by the local day it falls on, in
 * the order the days were drawn. Days with nothing on them are kept — an
 * empty Tuesday is a cell, not a gap. */
export function groupByDay<T extends { readonly start: string }>(
  days: readonly string[],
  items: readonly T[]
): readonly { readonly day: string; readonly items: readonly T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const day of days) buckets.set(day, []);
  for (const item of items) {
    for (const day of days) {
      if (isSameDay(day, item.start)) {
        buckets.get(day)?.push(item);
        break;
      }
    }
  }
  return days.map((day) => ({ day, items: buckets.get(day) ?? [] }));
}
