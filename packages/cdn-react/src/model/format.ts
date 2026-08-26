/**
 * The two numbers an attachment shows a person, formatted where the pair can
 * see the contract that produced them.
 *
 * Neither of these is in `@stapel/core`'s i18n layer today (it formats money,
 * dates and plurals and nothing else numeric), and both are read straight off
 * `render_meta` — `duration_ms` and `bytes` — so they live beside the rest of
 * the snapshot's semantics rather than in a skin, where five components would
 * each grow their own rounding. Recorded in REQUESTS-cdn-react.md as candidates
 * for core, because every pair that renders a file will want them.
 *
 * WHAT THEY DO NOT DO: they never produce a UNIT WORD. "3 files" and "2 min"
 * are plural families (`tPlural`), and a formatter that concatenates an English
 * suffix onto a number is a translation bug with a helper's name on it. These
 * return the numeral part; the sentence around it is an i18n key.
 */

/** Milliseconds in the two units a clip is read in. */
const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/**
 * `duration_ms` as a clock reading — `0:07`, `4:03`, `1:02:30`.
 *
 * `null` in, `null` out, and that distinction is the whole reason the contract
 * separates them: `null` is UNMEASURED (no probe ran, or ffprobe was missing —
 * `meta_reason` says which) and `0` is a real, measured, empty recording. A
 * formatter that answered `"0:00"` for both would erase a fact the backend went
 * out of its way to keep.
 *
 * Seconds are floored rather than rounded: a 59.6-second clip that reads `1:00`
 * and then plays for 59 seconds is the small lie that makes a progress bar look
 * broken.
 */
export function formatDurationMs(durationMs: number | null | undefined): string | null {
  if (durationMs === null || durationMs === undefined) return null;
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  const totalSeconds = Math.floor(durationMs / MS_PER_SECOND);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${String(minutes)}:${pad(seconds)}`;
}

/** The unit a byte count was rendered in, so a skin can name it in the locale. */
export type ByteUnit = "b" | "kb" | "mb" | "gb";

export interface FormattedBytes {
  /** The number, already localized by `Intl.NumberFormat`. */
  readonly value: string;
  /** Which unit {@link value} is in — an i18n key suffix, never a word. */
  readonly unit: ByteUnit;
}

const BYTE_STEP = 1024;
const UNITS: readonly ByteUnit[] = ["b", "kb", "mb", "gb"];
/** Below this many of a unit, one decimal is worth showing (1.4 MB, not 1 MB). */
const DECIMAL_CEILING = 10;

/**
 * A byte count as a number plus a UNIT NAME, not as a string.
 *
 * The split exists because the abbreviation differs by language: it is copy and
 * belongs to a locale bundle, while 1.4 is a number and belongs to
 * `Intl.NumberFormat`. Every helper in this fleet that returned `"1.4 MB"` put
 * an English abbreviation into a Russian sentence.
 *
 * Binary steps (1024), because that is what `original_size` counts and what the
 * backend's own ceilings are written in (`MAX_IMAGE_SIZE = 20 * 1024 * 1024`);
 * showing 21.0 MB for a file the server refuses at "20 MB" is how a refusal
 * stops making sense.
 */
export function formatBytes(
  bytes: number | null | undefined,
  locale: string
): FormattedBytes | null {
  if (bytes === null || bytes === undefined) return null;
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  let scaled = bytes;
  let step = 0;
  while (scaled >= BYTE_STEP && step < UNITS.length - 1) {
    scaled /= BYTE_STEP;
    step += 1;
  }
  const fractionDigits = step > 0 && scaled < DECIMAL_CEILING ? 1 : 0;
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
  return { value: format.format(scaled), unit: UNITS[step] as ByteUnit };
}
