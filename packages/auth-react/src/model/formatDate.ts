/**
 * Locale-aware date formatting for the default skin.
 *
 * The visual pass found `6/14/2026` on the passkeys screen: a bare
 * `toLocaleDateString()` reads the BROWSER's locale, not the one the app is
 * running in, so a Spanish interface printed US month/day/year — and "last
 * used" was an absolute date where the only question a person asks is "how
 * long ago". Both are fixed here, once, for every surface in the pair.
 *
 * `@stapel/core` ships no date formatter today (its i18n layer is keys and
 * plurals only), so this lives in the pair's model layer — the placement the
 * wave brief prescribes for a formatter core lacks. It is a candidate to move
 * up: see `SCRATCH/wave-b/REQUESTS-auth-react.md`.
 *
 * Everything degrades rather than throws: an unparseable timestamp renders
 * verbatim (it is still information), and outside an `<I18nProvider>` the
 * platform default locale applies.
 */
import { useCallback } from "react";
import { useOptionalI18n } from "@stapel/core";

/** A year in seconds — the point where a calendar date beats "13 months ago". */
const YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Seconds in the units `Intl.RelativeTimeFormat` speaks, coarsest first. */
const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", YEAR_SECONDS],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** Below this, "3 seconds ago" is noise — say "just now" instead. */
const JUST_NOW_SECONDS = 45;

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface AuthDateFormatters {
  /** Calendar date only — "14 Jun 2026". */
  date(iso: string): string;
  /** Date and clock time — "14 Jun 2026, 09:12". */
  dateTime(iso: string): string;
  /**
   * How long ago, in words — "3 days ago", "just now". Falls back to
   * {@link AuthDateFormatters.date} for anything a year or more out, where a
   * calendar date is the more useful answer.
   */
  relative(iso: string, now?: Date): string;
}

/**
 * Formatters bound to the app's CURRENT locale (core's i18n engine), not the
 * browser's. Stable across renders for a given locale, so passing one of these
 * into a memoized list row does not re-render it.
 */
export function useAuthDateFormat(): AuthDateFormatters {
  const i18n = useOptionalI18n();
  const locale = i18n?.locale;

  const date = useCallback(
    (iso: string): string => {
      const d = parse(iso);
      if (d === null) return iso;
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(d);
    },
    [locale]
  );

  const dateTime = useCallback(
    (iso: string): string => {
      const d = parse(iso);
      if (d === null) return iso;
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    },
    [locale]
  );

  const relative = useCallback(
    (iso: string, now?: Date): string => {
      const d = parse(iso);
      if (d === null) return iso;
      const deltaSeconds = (d.getTime() - (now ?? new Date()).getTime()) / 1000;
      const magnitude = Math.abs(deltaSeconds);
      if (magnitude >= YEAR_SECONDS) return date(iso);
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      if (magnitude < JUST_NOW_SECONDS) return rtf.format(0, "second");
      for (const [unit, seconds] of RELATIVE_UNITS) {
        if (magnitude >= seconds) {
          return rtf.format(Math.round(deltaSeconds / seconds), unit);
        }
      }
      return rtf.format(Math.round(deltaSeconds), "second");
    },
    [locale, date]
  );

  return { date, dateTime, relative };
}
