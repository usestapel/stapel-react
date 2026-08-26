/**
 * Machine values → typeset text.
 *
 * The visual pass found `2026-09-23T09:00:00Z` wrapped mid-token across two
 * lines on a screen whose reader needed "in 23 days", and `secretary`
 * rendered lowercase beside title-cased builtin roles. Both are the same
 * defect: a wire value put straight on the glass. This module is the pair's
 * side of the fix — one place that turns an ISO instant into the reader's own
 * calendar, and one place that turns an unlabelled registry key into a word.
 *
 * `@stapel/core` carries no date formatter today (checked: `packages/core/src`
 * has `i18n/`, `flows/`, no `format*`), so these live here, in the model
 * layer, where a skin can reach them and a host can too. They are candidates
 * for core the moment a second pair needs them — noted in the wave's REQUESTS
 * file rather than copied.
 *
 * Everything is `Intl`, so the calendar, the month names and the word for
 * "yesterday" come from the reader's locale rather than from us.
 */
import { useI18n } from "@stapel/core";

/** Seconds in the units `Intl.RelativeTimeFormat` speaks, largest first. */
const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** What {@link useWorkspaceFormat} hands a skin. Every method takes the wire
 * value verbatim — including `null`/`undefined`, which are normal on this
 * contract (`accepted_at: null` while an invitation is pending) — and returns
 * `null` for "there is nothing to typeset", never the string "null". */
export interface WorkspaceFormat {
  /** An absolute instant in the reader's calendar: `23 Sept 2026, 09:00`. */
  dateTime(iso: string | null | undefined): string | null;
  /** Date only, no clock: `23 Sept 2026`. For a day-grained fact (joined). */
  date(iso: string | null | undefined): string | null;
  /**
   * Clock only: `09:00`. For a row inside a list already grouped under its
   * day — repeating the date on every line of a journal is how three events
   * an hour apart end up printing one timestamp three times.
   */
  time(iso: string | null | undefined): string | null;
  /**
   * How long ago / how far ahead, in words: `3 days ago`, `in 2 hours`.
   * Anything under a minute is "now" in every language `Intl` knows, which is
   * what `second`'s own formatting says less well.
   */
  relative(iso: string | null | undefined): string | null;
  /**
   * The pair's standard timestamp line: relative first (what a person
   * actually wants), absolute in parentheses (what a support agent quotes).
   * `3 days ago (23 Sept 2026, 09:00)`.
   */
  timestamp(iso: string | null | undefined): string | null;
}

function parse(iso: string | null | undefined): Date | null {
  if (iso === null || iso === undefined || iso === "") return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Build the formatter for one locale. Exported for tests and for hosts that
 * format outside React; components use {@link useWorkspaceFormat}.
 *
 * `now` is injectable because "3 days ago" is a function of two instants and
 * a test that cannot name the second one has to sleep or to accept whatever
 * the clock says.
 */
export function createWorkspaceFormat(
  locale: string,
  now: () => Date = () => new Date()
): WorkspaceFormat {
  // `Intl` throws on a malformed locale tag; a bad tag must not take a screen
  // down over a date caption, so it degrades to the runtime default.
  const safeLocale = ((): string | undefined => {
    try {
      return Intl.DateTimeFormat.supportedLocalesOf([locale])[0] ?? locale;
    } catch {
      return undefined;
    }
  })();
  const dateTimeFormat = new Intl.DateTimeFormat(safeLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const dateFormat = new Intl.DateTimeFormat(safeLocale, { dateStyle: "medium" });
  const timeFormat = new Intl.DateTimeFormat(safeLocale, { timeStyle: "short" });
  const relativeFormat = new Intl.RelativeTimeFormat(safeLocale, { numeric: "auto" });

  function relative(iso: string | null | undefined): string | null {
    const date = parse(iso);
    if (date === null) return null;
    const deltaSeconds = (date.getTime() - now().getTime()) / 1000;
    const magnitude = Math.abs(deltaSeconds);
    for (const [unit, seconds] of RELATIVE_UNITS) {
      if (magnitude < seconds) continue;
      return relativeFormat.format(Math.round(deltaSeconds / seconds), unit);
    }
    return relativeFormat.format(0, "second");
  }

  function dateTime(iso: string | null | undefined): string | null {
    const date = parse(iso);
    return date === null ? null : dateTimeFormat.format(date);
  }

  return {
    dateTime,
    date: (iso) => {
      const date = parse(iso);
      return date === null ? null : dateFormat.format(date);
    },
    time: (iso) => {
      const date = parse(iso);
      return date === null ? null : timeFormat.format(date);
    },
    relative,
    timestamp: (iso) => {
      const near = relative(iso);
      const exact = dateTime(iso);
      if (near === null || exact === null) return null;
      return `${near} (${exact})`;
    },
  };
}

/**
 * The formatter bound to the host's CURRENT locale — the one a skin uses.
 *
 * Not memoized on purpose: `Intl.DateTimeFormat` is itself cached by the
 * engine per (locale, options), and a stale formatter after a locale switch
 * is the bug this hook exists to make impossible.
 */
export function useWorkspaceFormat(): WorkspaceFormat {
  const i18n = useI18n();
  return createWorkspaceFormat(i18n.locale);
}

/**
 * A registry key nobody wrote a label for, as a word: `secretary` →
 * `Secretary`, `site_admin` → `Site admin`.
 *
 * The fallback under `RoleSelect`'s `labelFor` and the audit pane's action
 * labels. It never invents meaning — it only stops a raw snake_case token
 * from sitting lowercase beside title-cased copy, which is what the visual
 * pass caught. A deployment that wants the real word ships the i18n key.
 */
export function titleCaseKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  if (words.length === 0) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
