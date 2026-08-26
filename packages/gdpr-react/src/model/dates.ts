/**
 * Formatting an instant for a screen about deletion — the ONE arithmetic-free
 * thing this pair does with a date.
 *
 * ── Format, never compute ─────────────────────────────────────────────────
 *
 * Every deadline on this surface (`grace_ends_at`, `due_at`,
 * `fully_erased_by`, `ack_due_at`, `resolve_due_at`, `expires_at`) is computed
 * by the server, in the server's clock, by rules a client does not hold —
 * `ack_due_at` is three BUSINESS days, `fully_erased_by` is the maximum over a
 * host-configured subprocessor table. A browser that turned any of those into
 * "in 5 days" would be publishing a second answer to a legal deadline, and the
 * two would disagree the first time a device clock was wrong or a month was
 * short. So: render the date the server sent, in the reader's locale, and
 * nothing else.
 *
 * (The one place a comparison happens — "is this deadline already past?" —
 * lives in `useDsarQueue`, is about the READER's now, and says so there.)
 *
 * ── An unparseable instant renders as itself ──────────────────────────────
 *
 * `Intl.DateTimeFormat` on a `NaN` date throws in some engines and prints
 * `Invalid Date` in others. On a screen whose subject is when your data
 * disappears, neither is acceptable: the raw wire value is returned instead,
 * because it is at least the truth the server sent.
 */

/** A date a person can check against a calendar: `23 September 2026`. */
export function formatDeletionDate(iso: string, locale: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(at);
  } catch {
    return iso;
  }
}

/**
 * Whole days from `now` until `iso`, or `undefined` when the instant does not
 * parse or is already past.
 *
 * ── Why this is not the "second answer" the module note refuses ───────────
 *
 * The rule above stands: the DATE is the deadline, it is the server's, and
 * nothing here recomputes it. This does not compute a deadline — it counts
 * the distance from the reader's own now to the date already on the screen,
 * and it is only ever rendered BESIDE that date, never instead of it. A grace
 * period is the one place where the absolute date alone fails the reader: two
 * visual reviews found that "September 23, 2026" on the screen where an
 * account is being deleted answers "when" and leaves "how long have I got"
 * to mental arithmetic, on the highest-stakes screen in the product.
 *
 * A wrong device clock therefore skews a hint, not a deadline: the date does
 * not move, and the cancel button is the server's to accept or refuse.
 * `undefined` past the deadline, because "0 days left" during an erasure that
 * is already running is not a countdown, it is a wrong statement about a
 * finished thing.
 */
export function daysUntil(iso: string, now: number = Date.now()): number | undefined {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return undefined;
  const ms = at - now;
  if (ms <= 0) return undefined;
  return Math.ceil(ms / 86_400_000);
}

/** The same instant with a time — for operational tables (receipts, probes). */
export function formatInstant(iso: string, locale: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(at);
  } catch {
    return iso;
  }
}
