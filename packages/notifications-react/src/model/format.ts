/**
 * Time, typeset — never an ISO string on the glass.
 *
 * `FeedItemResponse.created_at` arrives as `2026-03-17T10:30:00Z`, and a feed
 * that prints that has told the reader the one thing they did not ask: which
 * timezone the server keeps its journal in. What a notification list needs is
 * recency ("3 days ago"), with the exact instant available in the markup for
 * anything that wants it.
 *
 * `@stapel/core` ships no date formatter yet (`packages/core/src/i18n` is the
 * engine and the two floors, nothing more), so these live in this pair's model
 * layer and are flagged in `SCRATCH/wave-b/REQUESTS-notifications-react.md` as
 * a candidate to move up: gdpr's `formatDeletionDate` and billing's
 * `formatExpiryDate` are the same function written a third time.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Absolute cutoff past which relative time stops helping and a date starts. */
const RELATIVE_CEILING = 4 * WEEK;

/** `Intl.RelativeTimeFormat` is per-locale; one instance per tag is kept. */
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function relativeFormatter(locale: string): Intl.RelativeTimeFormat {
  let held = relativeFormatters.get(locale);
  if (held === undefined) {
    try {
      held = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    } catch {
      // An unknown locale tag degrades to the runtime default rather than
      // throwing inside a render — the same rule core's `pluralCategory` uses.
      held = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    }
    relativeFormatters.set(locale, held);
  }
  return held;
}

function dateFormatter(locale: string): Intl.DateTimeFormat {
  let held = dateFormatters.get(locale);
  if (held === undefined) {
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    try {
      held = new Intl.DateTimeFormat(locale, options);
    } catch {
      held = new Intl.DateTimeFormat(undefined, options);
    }
    dateFormatters.set(locale, held);
  }
  return held;
}

/**
 * A feed timestamp as a person reads it: "just now", "3 hours ago", "last
 * week", and — past four weeks, where "27 days ago" stops being information —
 * the local date and time.
 *
 * `now` is injectable so a test asserts a sentence rather than a clock, and so
 * a demo variant is byte-stable across runs.
 */
export function formatFeedTime(
  isoTimestamp: string,
  locale: string,
  now: Date = new Date()
): string {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) {
    // A timestamp the runtime cannot parse is a contract violation, not a
    // formatting problem. Returning the raw value keeps it diagnosable instead
    // of rendering "Invalid Date" where a time belongs.
    return isoTimestamp;
  }
  const elapsed = now.getTime() - at.getTime();
  if (elapsed >= RELATIVE_CEILING || elapsed < -MINUTE) {
    return dateFormatter(locale).format(at);
  }
  const rtf = relativeFormatter(locale);
  if (elapsed < MINUTE) return rtf.format(0, "second");
  if (elapsed < HOUR) return rtf.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return rtf.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < WEEK) return rtf.format(-Math.floor(elapsed / DAY), "day");
  return rtf.format(-Math.floor(elapsed / WEEK), "week");
}

/**
 * The same instant, spelled out — used where a row has room for one line only
 * and that line has to be unambiguous (a device's "last seen", which a person
 * checks precisely because they are auditing what is bound to their account).
 */
export function formatDateTime(isoTimestamp: string, locale: string): string {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) return isoTimestamp;
  return dateFormatter(locale).format(at);
}
