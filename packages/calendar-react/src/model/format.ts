/**
 * Formatting instants for a screen a person reads.
 *
 * ── Why this file exists at all ───────────────────────────────────────────
 *
 * The visual pass photographed this pair's only story rendering
 * `2026-07-13T10:00:00Z` as an event time — "machine format shown to a human,
 * no locale, no timezone, no relative day", and the first defect a stakeholder
 * spots. A calendar that prints ISO-8601 fails at the one job its name
 * promises, so no component in this package may interpolate a wire instant
 * into JSX: every visible time goes through a function here.
 *
 * `@stapel/core` has no date formatter today (only `useT`/`useTPlural`), so
 * this lives in the pair's model layer, in the shape the gdpr-react precedent
 * (`gdpr-react/src/model/dates.ts`) already proved. It is a candidate to move
 * into core — recorded as such in the wave's REQUESTS file.
 *
 * ── Format, never compute ─────────────────────────────────────────────────
 *
 * Every instant on this surface is the server's, in the server's clock. These
 * functions render what arrived, in the reader's locale, and derive nothing a
 * backend already answered. The one arithmetic here is grid arithmetic
 * (`range.ts`), which is about which WINDOW to ask for, not about what a
 * returned instant means.
 *
 * ── An unparseable instant renders as itself ──────────────────────────────
 *
 * `Intl.DateTimeFormat` on a `NaN` date throws in some engines and prints
 * `Invalid Date` in others. Both are worse than the raw wire value, which is
 * at least the truth the server sent — the gdpr-react rule, applied here for
 * the same reason.
 */

/** Parse a wire instant, or `null` when it is not one. */
function parse(iso: string): Date | null {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at;
}

function safeFormat(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  const at = parse(iso);
  if (at === null) return iso;
  try {
    return new Intl.DateTimeFormat(locale, options).format(at);
  } catch {
    return iso;
  }
}

/** `10:00` — the clock time alone, for a row inside a day that is already named. */
export function formatTime(iso: string, locale: string): string {
  return safeFormat(iso, locale, { timeStyle: "short" });
}

/** `13 Jul 2026, 10:00` — an instant that must stand on its own. */
export function formatDateTime(iso: string, locale: string): string {
  return safeFormat(iso, locale, { dateStyle: "medium", timeStyle: "short" });
}

/** `Monday, 13 July` — a day heading in an agenda. */
export function formatDayHeading(iso: string, locale: string): string {
  return safeFormat(iso, locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** `July 2026` — the label above a month grid. */
export function formatMonthLabel(iso: string, locale: string): string {
  return safeFormat(iso, locale, { month: "long", year: "numeric" });
}

/** `13` — the day-of-month numeral in a grid cell. */
export function formatDayNumber(iso: string, locale: string): string {
  return safeFormat(iso, locale, { day: "numeric" });
}

/**
 * `10:00 – 11:00`, or the start alone for a zero-duration marker.
 *
 * Zero-duration events (`end == start`) are valid in this module — MODULE.md
 * calls them markers: stored, listed, occupying no time. Rendering
 * `10:00 – 10:00` would invite a reader to wonder what broke, so a marker
 * shows the one instant it has.
 */
export function formatTimeRange(
  startIso: string,
  endIso: string,
  locale: string
): string {
  const from = formatTime(startIso, locale);
  if (startIso === endIso) return from;
  const to = formatTime(endIso, locale);
  // U+2013 EN DASH with hair spaces: a time range, not a subtraction.
  return `${from} – ${to}`;
}

/**
 * The weekday column headings of a grid, Monday first — the same convention
 * the backend's `recurrence_weekdays` uses (`0=Mon..6=Sun`), so a weekday
 * chip in the recurrence editor and a column in the grid are the same index.
 */
export function weekdayNames(
  locale: string,
  width: "short" | "narrow" = "short"
): readonly string[] {
  // 2024-01-01 was a Monday; the date is a fixed anchor, never displayed.
  const monday = Date.UTC(2024, 0, 1);
  const day = 86_400_000;
  try {
    const format = new Intl.DateTimeFormat(locale, {
      weekday: width,
      timeZone: "UTC",
    });
    return Array.from({ length: 7 }, (_unused, index) =>
      format.format(new Date(monday + index * day))
    );
  } catch {
    return FALLBACK_WEEKDAYS;
  }
}

/** Used only when the environment has no `Intl` data for the locale at all. */
const FALLBACK_WEEKDAYS: readonly string[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

/**
 * The `<input type="datetime-local">` spelling of a wire instant
 * (`YYYY-MM-DDTHH:mm`, in the reader's own zone), and back.
 *
 * The editor's fields are local-time controls and the wire is tz-aware ISO
 * 8601; converting in one documented place keeps every call site from
 * inventing its own string surgery.
 */
export function toLocalInput(iso: string): string {
  const at = parse(iso);
  if (at === null) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `T${pad(at.getHours())}:${pad(at.getMinutes())}`
  );
}

/** The inverse of {@link toLocalInput}: a local-time field back to the wire. */
export function fromLocalInput(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? "" : at.toISOString();
}

/** The `<input type="date">` spelling of a wire instant (`YYYY-MM-DD`). */
export function toDateInput(iso: string): string {
  return toLocalInput(iso).slice(0, 10);
}

/** A `YYYY-MM-DD` field back to the wire, at the end of that local day. */
export function fromDateInput(value: string): string {
  if (value.length === 0) return "";
  const at = new Date(`${value}T23:59:59`);
  return Number.isNaN(at.getTime()) ? "" : at.toISOString();
}
