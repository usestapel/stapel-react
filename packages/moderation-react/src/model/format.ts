/**
 * The pair's formatters. Every one of them turns a WIRE value into something a
 * person reads; none of them computes a moderation fact.
 *
 * `@stapel/core` ships no date/duration formatters today (its i18n engine is
 * keys, interpolation and plurals), so these live here — and they are filed in
 * `SCRATCH/wave-b/REQUESTS-moderation-react.md` as candidates for core, since
 * gdpr-react already carries a near-identical `formatInstant`.
 */

/** An instant with a time, for the console's operational tables. */
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

/** A date a person can check against a calendar. */
export function formatDate(iso: string, locale: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(at);
  } catch {
    return iso;
  }
}

/**
 * The time left on a lease, as a coarse `"12 min"` / `"2 h"` / `"expired"`.
 *
 * A lease is the one deadline this pair DOES arithmetic on, and it is honest
 * arithmetic: `claimed_until` is the server's instant, the countdown is
 * against the READER's clock, and the only decision it drives — whether the
 * console offers "extend" — is re-answered by the server on the next call.
 * Returns `null` when the instant is unreadable, so a caller renders the raw
 * value rather than a confident lie.
 */
export function remainingMinutes(iso: string, now: number): number | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  return Math.round((at - now) / 60_000);
}

/**
 * A duration in seconds as a whole-unit sentence part (`"7 d"`, `"12 h"`).
 *
 * `Intl.NumberFormat`'s `unit` style is used where the engine has it, so the
 * unit word is the locale's; `narrow` keeps a sanction ladder readable in a
 * `Select` option. Falls back to the number of seconds, which is what the wire
 * actually carries.
 */
export function formatDuration(seconds: number, locale: string): string {
  const units: readonly [number, string][] = [
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
  ];
  for (const [size, unit] of units) {
    if (seconds >= size && seconds % size === 0) {
      try {
        return new Intl.NumberFormat(locale, {
          style: "unit",
          unit,
          unitDisplay: "short",
        }).format(seconds / size);
      } catch {
        return String(seconds / size);
      }
    }
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "second",
      unitDisplay: "short",
    }).format(seconds);
  } catch {
    return String(seconds);
  }
}

/**
 * A UUID shortened to its first segment for display.
 *
 * Every actor in this module is a bare UUID and no endpoint resolves one to a
 * name (`MODULE.md`: "every actor is a bare `UUIDField`"). A console that
 * printed 36 hex characters in a table column would be unreadable, and one
 * that printed nothing would hide who is holding a case — so the short form is
 * the default and `createModerationRuntime({ userLabel })` is the seam a host
 * fills with a real name from whatever pair owns identities.
 */
export function shortId(id: string): string {
  const head = id.split("-")[0];
  return head !== undefined && head.length > 0 ? head : id;
}
