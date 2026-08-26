/**
 * `@stapel/core`'s i18n formatters — dates, relative times, durations and
 * numbers, rendered at the APP's locale.
 *
 * ## Why this had to be one module
 *
 * Wave B's audit found the same file written independently in sixteen pairs:
 * `calendar-react/src/model/format.ts`, `workspaces-react`'s
 * `useWorkspaceFormat`, `recordings-react`'s `formatDuration`/`formatInstant`,
 * `reviews-react`'s `formatReviewDate`, `auth-react`'s `useAuthDateFormat`,
 * `docs-react`, `gdpr-react`, `notifications-react`, `moderation-react`,
 * `tasks-react`, `webhooks-react`, `cdn-react`, `attributes-react` … Every one
 * of them re-decided the same four questions, and they did not all decide
 * them the same way: what an invalid or absent instant renders as (`null`,
 * `undefined`, the raw ISO string, an empty span), which `Intl` style a
 * "date" is (`dateStyle: "medium"` vs `{year, month: "short", day}`), where
 * the relative/absolute cutoff sits, and whether a locale the runtime does
 * not know throws. Nine of those requests asked, in the same words, for the
 * thing to live here — `@stapel/core`'s i18n engine shipped `t`/`tPlural` and
 * nothing numeric, so "dates through core's helpers if they exist" was
 * satisfied by nothing existing.
 *
 * Two things make this core's business rather than a pair's:
 *
 *  1. **The locale is the engine's, not the browser's.** `toLocaleDateString()`
 *     and a bare `new Intl.DateTimeFormat(undefined, …)` read the BROWSER's
 *     preference, so a product whose user switched to `ru` in the app kept
 *     rendering `Aug 24, 2026` beside Russian sentences. Everything here takes
 *     the locale explicitly, and {@link useFormat} binds it to the live engine
 *     locale — a runtime language switch re-renders the dates with the copy.
 *  2. **Copy must not be able to crash a render.** Every function here answers
 *     `null` for an instant it cannot read (absent, empty, unparseable) and
 *     degrades an unknown locale tag to the runtime default instead of
 *     throwing, the same contract `pluralCategory` already holds.
 *
 * ## What is deliberately NOT here
 *
 * - **Money.** `formatMoney`/`formatPerCredit` need a currency, its minor
 *   units and the host's rounding policy, which is `@stapel/currencies-react`'s
 *   contract, not a locale question. `formatNumber` with
 *   `{ style: "currency", currency }` is available for a caller that already
 *   knows the code.
 * - **Bytes.** The unit ladder (`byte`→`kilobyte`→…) is a two-line caller of
 *   {@link formatNumber} with `{ style: "unit", unit }` and belongs beside the
 *   thing measuring the bytes.
 * - **Anything that returns a SENTENCE.** "Nothing here yet", "3 days left"
 *   with a word in it — those are keys, and they go through `t`/`tPlural`.
 *   `Intl.RelativeTimeFormat` is the exception the platform already
 *   translates.
 */

import { useMemo } from "react";
import { useOptionalI18n } from "../i18n.js";

/** Anything a wire field can carry for an instant. `Date` for a caller that
 * already parsed, `number` for epoch milliseconds. */
export type Instant = string | number | Date | null | undefined;

/**
 * `Intl` formatter instances, keyed by locale and shape.
 *
 * Constructing an `Intl.DateTimeFormat` is one of the more expensive things a
 * render can do, and a list of 200 rows asked for the same one 200 times in
 * every copy this module replaces (`new Intl.DateTimeFormat(locale, …)`
 * inside the per-row function). One instance per distinct (locale, shape)
 * pair, forever: they are immutable and locale-pure.
 */
const formatterCache = new Map<string, unknown>();

function cached<T>(key: string, build: () => T): T {
  const hit = formatterCache.get(key);
  if (hit !== undefined) return hit as T;
  const built = build();
  formatterCache.set(key, built);
  return built;
}

/**
 * A locale tag the runtime will accept, or `undefined` (its own default).
 *
 * A tag can reach here from a host's config, a URL segment or a stored
 * preference, so it can be malformed; `new Intl.DateTimeFormat("en_US")`
 * throws a `RangeError` on the underscore, and a date is not worth a blank
 * screen. Two of the copies this module replaces had already hit that and
 * wrapped every call site in `try`/`catch`.
 */
function safeLocale(locale: string | undefined): string | undefined {
  if (locale === undefined || locale === "") return undefined;
  try {
    new Intl.NumberFormat(locale);
    return locale;
  } catch {
    return undefined;
  }
}

/** Parse any {@link Instant}; `null` for absent, empty or unreadable. */
export function toDate(value: Instant): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A calendar date at the app's locale — `24 Aug 2026` in `en-GB`, and
 * whatever the reader's language writes that as.
 *
 * `dateStyle: "medium"` is the fleet's shape: it names the month, so it can
 * never be read as `08/09` in the wrong order, and it is short enough for a
 * table cell. Pass `options` to override for one call (a header wanting
 * `"long"`, a log wanting the weekday); the override is part of the cache key,
 * so it costs no more than the default.
 *
 * `null` when the instant is absent or unreadable — render a designed
 * placeholder, never the raw ISO string. (Raw ISO on the glass is visual
 * class VC-A8, found in gdpr, billing and workspaces.)
 */
export function formatDate(
  value: Instant,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string | null {
  const date = toDate(value);
  if (date === null) return null;
  const tag = safeLocale(locale);
  const formatter = cached(
    `d|${tag ?? ""}|${options === undefined ? "" : JSON.stringify(options)}`,
    () => new Intl.DateTimeFormat(tag, options ?? { dateStyle: "medium" })
  );
  return formatter.format(date);
}

/**
 * A date AND a time of day — `24 Aug 2026, 09:00`.
 *
 * The time is `"short"`: seconds on a screen are noise unless the thing being
 * timed is measured in them, and a caller that means seconds says so through
 * `options`.
 */
export function formatDateTime(
  value: Instant,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string | null {
  return formatDate(
    value,
    locale,
    options ?? { dateStyle: "medium", timeStyle: "short" }
  );
}

/** Seconds in each unit the relative ladder steps through, longest first. */
const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

export interface RelativeOptions {
  /** What "now" is. Injectable so a test is not a race; defaults to the clock. */
  readonly now?: Date | number;
  /**
   * Beyond this many seconds of distance, answer with {@link formatDate}
   * instead of a relative phrase. "in 3 years" is not information; a date is.
   * Default: one year. `Infinity` to always stay relative.
   */
  readonly absoluteAfterSeconds?: number;
}

/**
 * How far from now, in words the platform translates — `3 hours ago`,
 * `tomorrow`, `in 2 weeks`.
 *
 * `numeric: "auto"` so a language that HAS a word for the day before
 * yesterday uses it. Distances under a minute answer `now` rather than
 * counting seconds at a person: the copies that counted produced a label that
 * changed while it was being read.
 *
 * Past a year (see {@link RelativeOptions.absoluteAfterSeconds}) it hands back
 * to {@link formatDate}. The pairs that did not do this rendered "in 4 years"
 * on a retention deadline, which no one can act on.
 *
 * `null` follows {@link formatDate}: an unreadable instant has no phrase.
 */
export function formatRelative(
  value: Instant,
  locale?: string,
  options?: RelativeOptions
): string | null {
  const date = toDate(value);
  if (date === null) return null;
  const now = options?.now ?? new Date();
  const nowMs = now instanceof Date ? now.getTime() : now;
  const deltaSeconds = (date.getTime() - nowMs) / 1000;
  const magnitude = Math.abs(deltaSeconds);
  const cutoff = options?.absoluteAfterSeconds ?? 31_536_000;
  if (magnitude >= cutoff) return formatDate(date, locale);

  const tag = safeLocale(locale);
  const formatter = cached(
    `r|${tag ?? ""}`,
    () => new Intl.RelativeTimeFormat(tag, { numeric: "auto" })
  );
  if (magnitude < 60) return formatter.format(0, "second");
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (magnitude < seconds) continue;
    return formatter.format(Math.round(deltaSeconds / seconds), unit);
  }
  return formatter.format(0, "second");
}

/** How a duration reads. */
export type DurationStyle =
  /** `1:02:03` / `2:03` — a media timecode, monospace-friendly, locale-free. */
  | "clock"
  /** `1 hr, 2 min` at the locale — for a duration that is a fact, not a scrub
   * position (a meeting's length, a retention window). */
  | "units";

/**
 * A span of SECONDS as a duration.
 *
 * Not an instant, and deliberately a different argument type: every copy of
 * this that took "a number" ended up with a caller passing milliseconds. The
 * wire carries seconds for a recording's length, a call's length and a slot's
 * size alike.
 *
 * `null` for absent, non-finite or negative-by-nonsense input; a negative
 * duration is a contract violation upstream, not a `-1:00` to render.
 */
export function formatDuration(
  seconds: number | null | undefined,
  locale?: string,
  style: DurationStyle = "clock"
): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return null;
  }
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (style === "clock") {
    const pad = (value: number): string => String(value).padStart(2, "0");
    return hours > 0
      ? `${String(hours)}:${pad(minutes)}:${pad(secs)}`
      : `${String(minutes)}:${pad(secs)}`;
  }
  const parts: string[] = [];
  if (hours > 0) parts.push(formatUnit(hours, "hour", locale));
  if (minutes > 0) parts.push(formatUnit(minutes, "minute", locale));
  if (secs > 0 || parts.length === 0) parts.push(formatUnit(secs, "second", locale));
  const tag = safeLocale(locale);
  const list = cached(
    `l|${tag ?? ""}`,
    () => new Intl.ListFormat(tag, { style: "narrow", type: "unit" })
  );
  return list.format(parts);
}

function formatUnit(
  value: number,
  unit: "hour" | "minute" | "second",
  locale?: string
): string {
  return (
    formatNumber(value, locale, {
      style: "unit",
      unit,
      unitDisplay: "short",
    }) ?? String(value)
  );
}

/**
 * A number at the app's locale — thousands separated the way the reader's
 * language separates them (`1,240` / `1 240` / `1.240`).
 *
 * A follower count in the thousands, a quota, a credit balance. NOT a plural:
 * "3 items" is a `tPlural` family whose `{count}` this can format first.
 *
 * `null` for a non-finite value, so `NaN` reaches a designed placeholder
 * rather than the page.
 */
export function formatNumber(
  value: number | null | undefined,
  locale?: string,
  options?: Intl.NumberFormatOptions
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const tag = safeLocale(locale);
  const formatter = cached(
    `n|${tag ?? ""}|${options === undefined ? "" : JSON.stringify(options)}`,
    () => new Intl.NumberFormat(tag, options)
  );
  return formatter.format(value);
}

/** The formatters of {@link useFormat}, bound to one locale. */
export interface Format {
  /** The locale every method below is bound to (the engine's, or the
   * runtime's where no engine is mounted). */
  readonly locale: string | undefined;
  date(value: Instant, options?: Intl.DateTimeFormatOptions): string | null;
  dateTime(value: Instant, options?: Intl.DateTimeFormatOptions): string | null;
  relative(value: Instant, options?: RelativeOptions): string | null;
  duration(
    seconds: number | null | undefined,
    style?: DurationStyle
  ): string | null;
  number(value: number | null | undefined, options?: Intl.NumberFormatOptions): string | null;
  /**
   * The pattern `useWorkspaceFormat().timestamp` and three other pairs
   * arrived at independently: the near phrase for reading, the exact instant
   * for acting on. Both, or `null` — never a relative phrase alone on a
   * timestamp someone has to reason about.
   */
  timestamp(value: Instant, options?: RelativeOptions): string | null;
}

/**
 * Build a {@link Format} for a locale. Pure — `useFormat()` is the React half.
 *
 * Cheap to call per render: every `Intl` instance behind it is cached by
 * locale, so this allocates a small object and nothing else.
 */
export function createFormat(locale: string | undefined): Format {
  return {
    locale,
    date: (value, options) => formatDate(value, locale, options),
    dateTime: (value, options) => formatDateTime(value, locale, options),
    relative: (value, options) => formatRelative(value, locale, options),
    duration: (seconds, style) => formatDuration(seconds, locale, style),
    number: (value, options) => formatNumber(value, locale, options),
    timestamp: (value, options) => {
      const near = formatRelative(value, locale, options);
      const exact = formatDateTime(value, locale);
      if (near === null || exact === null) return null;
      return near === exact ? exact : `${near} (${exact})`;
    },
  };
}

/**
 * {@link Format} bound to the LIVE engine locale, re-rendering when it moves.
 *
 * ```tsx
 * const fmt = useFormat();
 * <td>{fmt.date(row.created_at) ?? t(KEYS.unknownDate)}</td>
 * <td>{fmt.relative(row.expires_at)}</td>
 * ```
 *
 * Uses {@link useOptionalI18n}, so it never throws outside an
 * `<I18nProvider>`: a date is not a translated string, and where there is no
 * app locale the runtime's own is the only honest answer. Everything that
 * renders a KEY keeps using `useT`, where a missing provider is a wiring
 * defect and throwing is right.
 */
export function useFormat(): Format {
  const engine = useOptionalI18n();
  const locale = engine?.locale;
  return useMemo(() => createFormat(locale), [locale]);
}
