/**
 * `<MemberSince/>` — how long this person has been here, as one line.
 *
 * stapel-profiles 0.19.2 puts `created_at` on the public read, and the whole
 * reason it is there is a seller page that wants to say "on the site since
 * March 2024" without a second lookup. Tenure is the cheapest trust signal a
 * marketplace has, and every consumer that wanted it was formatting the raw
 * ISO string itself — which is visual class VC-A8 (a raw `2024-03-15T…` on the
 * glass) one careless render away.
 *
 * ── A MONTH AND A YEAR, never a day ───────────────────────────────────────
 *
 * The field is an exact instant and this component deliberately throws most of
 * it away. "Since 15 March 2024, 09:41" reads as surveillance of a stranger;
 * "since March 2024" is the same fact at the resolution the question was asked
 * at. The precision that is dropped here is not lost — `created_at` is on the
 * profile for anything that genuinely needs the instant.
 *
 * ── How the Russian line gets its preposition back ────────────────────────
 *
 * This line used to read "registration date: <month> <year>" — a label and a
 * colon — because `Intl` writes a bare month-and-year in the NOMINATIVE case
 * and every natural Russian "since <month>" governs the GENITIVE. The
 * recorded blocker was that a pair cannot decline a month it did not build and
 * a hand-kept twelve-word genitive table is a translation memory nobody would
 * maintain.
 *
 * The table was never needed. `Intl` already knows both cases; it just does
 * not offer the genitive for a month-and-year, because in that phrase the
 * month is the subject. Ask the SAME formatter for a month-day-year and the
 * month becomes a modifier, so the locale's own data declines it (September
 * 2026 at `ru`, transliterated here because source is English-only):
 *
 * ```
 * {month:"long", year:"numeric"}             -> "sentyabr 2026 g."   (nominative)
 * {day:"numeric", month:"long", year:"numeric"}
 *   .formatToParts()  -> [… {month:"sentyabrya"} …]                  (genitive)
 * ```
 *
 * The day is requested ONLY to put the month in that grammatical position. It
 * is never printed: what is rendered is the nominative phrase's own parts with
 * the `month` part swapped for the declined word.
 *
 * ── Why a REBUILD and not a `{month} {year}` of our own ───────────────────
 *
 * Reading the two parts out and joining them with a space is the obvious
 * version and it is wrong in most of the world. Spanish joins them with a
 * word — `marzo de 2024`; Russian carries a trailing abbreviation for "year"
 * behind a narrow no-break space; Japanese writes the year FIRST, as
 * `2024`+year-sign+`3`+month-sign, with no month NAME at all. Those are the
 * locale's pattern, not decoration, and a pair that assembles the pieces
 * itself silently flattens every one of them. So only the WORD moves. The
 * pattern around it stays whatever `Intl` wrote, which is why this is a real
 * technique rather than a trick that happens to read well in two languages.
 *
 * For a language with no nominative/genitive split the swap is a no-op by
 * construction: English reads `September` in both shapes, so the rebuild
 * returns the identical string it was handed.
 *
 * ── What it does when it cannot ───────────────────────────────────────────
 *
 * A tag the runtime refuses (`en_US` — an underscore is a `RangeError` to
 * `Intl`, and tags reach a host from config, a URL segment and stored
 * preferences alike), or a shape whose parts carry no `month` at all, falls
 * back to the plain nominative phrase — the WHOLE line this component
 * rendered before any of this existed. Never a half sentence with the date
 * missing out of it.
 *
 * The locale is always the ENGINE's, through `useFormat()`. `toLocaleDateString`
 * and a bare `new Intl.DateTimeFormat(undefined, …)` read the BROWSER's
 * preference, which is how a product whose user switched to `ru` in the app
 * kept rendering English months beside Russian sentences.
 */
import type { ReactElement } from "react";
import { Typography } from "antd";
import type { Format, Instant } from "@stapel/core";
import { toDate, useFormat, useT } from "@stapel/core";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

/** The shape of the phrase — a month and a year, at the app's locale. */
const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };

/**
 * The same phrase with a day in it. The day is NEVER rendered; it is there to
 * move the month into the grammatical position where a locale that declines
 * its months declines this one. See the module doc.
 */
const MONTH_YEAR_WITH_DAY: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

/**
 * The two formatters per locale, or `null` for a tag `Intl` refuses.
 *
 * Cached for the same reason `@stapel/core`'s formatters are: constructing an
 * `Intl.DateTimeFormat` is among the more expensive things a render can do,
 * and these are immutable and locale-pure. `null` is cached too — a malformed
 * tag should cost one `RangeError`, not one per render.
 */
const cache = new Map<string, readonly [Intl.DateTimeFormat, Intl.DateTimeFormat] | null>();

function formattersFor(
  locale: string | undefined
): readonly [Intl.DateTimeFormat, Intl.DateTimeFormat] | null {
  const key = locale ?? "";
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let built: readonly [Intl.DateTimeFormat, Intl.DateTimeFormat] | null;
  try {
    built = [
      new Intl.DateTimeFormat(locale, MONTH_YEAR),
      new Intl.DateTimeFormat(locale, MONTH_YEAR_WITH_DAY),
    ];
  } catch {
    built = null;
  }
  cache.set(key, built);
  return built;
}

/**
 * The month and year the sentence takes, with the month in whatever case the
 * locale's "since" wants — or the plain nominative phrase where that cannot be
 * worked out, and `null` where there is no date at all.
 */
function tenurePhrase(format: Format, value: Instant): string | null {
  const nominative = format.date(value, MONTH_YEAR);
  if (nominative === null) return null;
  const date = toDate(value);
  if (date === null) return null;

  const formatters = formattersFor(format.locale);
  if (formatters === null) return nominative;
  const [plain, withDay] = formatters;

  const declined = withDay.formatToParts(date).find((part) => part.type === "month");
  if (declined === undefined) return nominative;

  const parts = plain.formatToParts(date);
  if (!parts.some((part) => part.type === "month")) return nominative;
  return parts
    .map((part) => (part.type === "month" ? declined.value : part.value))
    .join("");
}

export interface MemberSinceProps {
  /**
   * The profile's `created_at`, straight off the wire — the prop carries the
   * FIELD NAME rather than a translated one so a call site reads
   * `created_at={profile.created_at}` and there is no second name for the same
   * value to get wrong.
   *
   * Absent, `null`, or unparseable renders NOTHING (see the component doc): a
   * deployment whose profile model predates the field has no tenure to state,
   * and a placeholder for it would be a sentence about the backend.
   */
  readonly created_at?: string | null;
  /** Default `member-since`. */
  readonly testId?: string;
}

/**
 * The tenure line, or `null` when there is nothing to say.
 *
 * NOTHING is the honest answer to an absent or unreadable `created_at`: this
 * component states a fact, and a component that cannot state it should not
 * take up a line saying so.
 */
export function MemberSince(props: MemberSinceProps): ReactElement | null {
  const t = useT();
  const format = useFormat();
  const date = tenurePhrase(format, props.created_at);
  if (date === null) return null;
  return (
    <Typography.Text
      type="secondary"
      data-testid={props.testId ?? "member-since"}
      data-stapel-member-since={props.created_at ?? ""}
    >
      {t(PROFILES_I18N_KEYS.publicMemberSince, { date })}
    </Typography.Text>
  );
}
