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
