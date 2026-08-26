/**
 * Display formatters — the layer between a wire value and a sentence.
 *
 * The visual audit's class M-2 is "machine values rendered as user-facing
 * text": `2026-07-13T10:00:00Z`, a bare `1830`, a raw enum member. Nothing in
 * `@stapel/core`'s i18n exports a date, duration or byte formatter today
 * (`packages/core/src/i18n` is `coreErrors.ts` + `coreUi.ts`), so these live in
 * this pair's model layer and are named in REQUESTS as core candidates — a
 * recording's duration and a video's duration are the same problem.
 *
 * All of them take an explicit `locale` and go through `Intl`, so a host that
 * switches locale gets a re-formatted screen rather than an English one with
 * translated labels around it. {@link useRecordingsFormat} binds them to the
 * i18n engine's current locale.
 */
import { useOptionalI18n } from "@stapel/core";

/** The locale used when no `<I18nProvider>` is above (SSR probes, tests). */
const FALLBACK_LOCALE = "en";

/**
 * A media duration as a clock reading: `9:07`, `1:02:03`. NOT `Intl`
 * (`Intl.DurationFormat` is not available everywhere yet, and "1 hr, 2 min"
 * is the wrong register beside a scrub bar); the digits are locale-neutral
 * and the separator is the colon every player on earth uses.
 *
 * Returns `undefined` for a null/absent duration so a caller renders its own
 * placeholder rather than `0:00`, which would be a lie about a recording whose
 * pipeline has not measured it yet.
 */
export function formatDuration(seconds: number | null | undefined): string | undefined {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return undefined;
  }
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");
  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(secs)}`
    : `${String(minutes)}:${pad(secs)}`;
}

/**
 * A transcript segment's start time, in the same clock register as
 * {@link formatDuration} — always at least `m:ss`, so a column of them lines up.
 */
export function formatTimecode(seconds: number): string {
  return formatDuration(seconds) ?? "0:00";
}

/**
 * An ISO instant as a date the reader recognises, in their own locale's
 * conventions (order, month name, 12- vs 24-hour clock). An unparseable value
 * returns `undefined` rather than the string `Invalid Date`.
 */
export function formatInstant(iso: string, locale: string): string | undefined {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** The date half only — for a list row, where the minute is noise. */
export function formatDate(iso: string, locale: string): string | undefined {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

/** A count with the locale's grouping — `4,120` / `4 120`. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * A byte count a person can read — `12.4 MB`. Uses `Intl`'s `unit` style so
 * the unit is localized and the decimal separator follows the locale.
 * Meeting-length audio is measured in megabytes, so the ladder stops there
 * unless the file really is a gigabyte.
 */
export function formatBytes(bytes: number, locale: string): string {
  const units: readonly ["kilobyte", "megabyte", "gigabyte"] = [
    "kilobyte",
    "megabyte",
    "gigabyte",
  ];
  let value = bytes / 1024;
  let unit: "byte" | "kilobyte" | "megabyte" | "gigabyte" = "byte";
  if (bytes < 1024) {
    value = bytes;
  } else {
    unit = "kilobyte";
    for (const next of units) {
      unit = next;
      if (value < 1024) break;
      value = value / 1024;
    }
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: value < 10 && unit !== "byte" ? 1 : 0,
  }).format(value);
}

/**
 * A BCP-47 language tag as a language name in the READER's locale — `en`
 * becomes "English" for an English reader and "Anglais" for a French one.
 *
 * The wire carries the tag stapel-recordings detected or was told, and the
 * detail pane printed it raw: `Language: en` beside a formatted date and a
 * formatted duration (visual pass M-2). `Intl.DisplayNames` is the same family
 * as every other formatter here. A tag it cannot name comes back unchanged —
 * an unfamiliar tag is still more use to a reader than nothing.
 */
export function formatLanguage(tag: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(tag) ?? tag;
  } catch {
    // `of()` throws on a structurally invalid tag; the wire is not ours to
    // trust and a report is not worth a blank screen.
    return tag;
  }
}

/** The formatters, bound to one locale. */
export interface RecordingsFormat {
  readonly locale: string;
  duration(seconds: number | null | undefined): string | undefined;
  timecode(seconds: number): string;
  instant(iso: string): string | undefined;
  date(iso: string): string | undefined;
  count(value: number): string;
  bytes(value: number): string;
  language(tag: string): string;
}

/**
 * The pair's formatters bound to the i18n engine's CURRENT locale. Safe
 * outside an `<I18nProvider>` (falls back to `en`) so a skin can be rendered in
 * isolation without throwing.
 */
export function useRecordingsFormat(): RecordingsFormat {
  const engine = useOptionalI18n();
  const locale = engine?.locale ?? FALLBACK_LOCALE;
  return {
    locale,
    duration: formatDuration,
    timecode: formatTimecode,
    instant: (iso) => formatInstant(iso, locale),
    date: (iso) => formatDate(iso, locale),
    count: (value) => formatCount(value, locale),
    bytes: (value) => formatBytes(value, locale),
    language: (tag) => formatLanguage(tag, locale),
  };
}
