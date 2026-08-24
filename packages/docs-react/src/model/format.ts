/**
 * Formatting wire values for a screen a person reads.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 *
 * `Date#toLocaleDateString()` reads the BROWSER's locale, not the one the app
 * is running in: a Russian-language deployment opened in an en-US browser
 * printed `8/2/2026` in the middle of Russian copy. Every visible instant in
 * this pair therefore goes through a function here, which takes the APP
 * locale (`useI18n().locale`) explicitly.
 *
 * `@stapel/core` ships no date/size formatter today (only `useT`/`useTPlural`),
 * so this lives in the pair's model layer, in the shape the calendar-react and
 * gdpr-react precedents already proved. It is a candidate to move into core —
 * recorded as such in the wave's REQUESTS file.
 *
 * ── Format, never compute ─────────────────────────────────────────────────
 *
 * Every instant here is the server's. These functions render what arrived, in
 * the reader's locale, and derive nothing the backend already answered. An
 * unparseable instant renders as ITSELF: `Intl.DateTimeFormat` on a `NaN` date
 * throws in some engines and prints `Invalid Date` in others, and both are
 * worse than the raw wire value, which is at least the truth the server sent.
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

/** `2 Aug 2026` — a row's "last changed", where the day is the useful grain. */
export function formatDate(iso: string, locale: string): string {
  return safeFormat(iso, locale, { dateStyle: "medium" });
}

/** `2 Aug 2026, 09:00` — a revision, where the minute distinguishes two saves. */
export function formatDateTime(iso: string, locale: string): string {
  return safeFormat(iso, locale, { dateStyle: "medium", timeStyle: "short" });
}

/** The unit ladder `formatBytes` walks. `B` is not localized by `Intl` in a
 * useful way for every locale; the NUMBER is, which is the half that differs
 * between `1.5 KB` and `1,5 KB`. */
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * `11 B` / `1.4 KB` / `2.3 MB` — a document's size with the number formatted
 * in the app's locale (decimal comma where the locale uses one).
 *
 * Decimal units (1000), not binary: this is the number a person compares with
 * their storage quota, and every operating system's file manager shows the
 * decimal one.
 */
export function formatBytes(bytes: number, locale: string): string {
  if (!Number.isFinite(bytes) || bytes < 0) return String(bytes);
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const fractionDigits = unit === 0 ? 0 : 1;
  let text: string;
  try {
    text = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    text = value.toFixed(fractionDigits);
  }
  return `${text} ${BYTE_UNITS[unit] ?? "B"}`;
}
