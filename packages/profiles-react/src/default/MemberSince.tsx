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
 * ── Why the Russian line carries no preposition ───────────────────────────
 *
 * `Intl` writes a Russian month-and-year in the NOMINATIVE case, and every
 * natural Russian phrasing of "since <month>" governs the genitive. A pair
 * cannot decline a month it did not build, and hand-keeping a twelve-word
 * genitive table for one caption is a translation memory nobody would
 * maintain. So the Russian key states the fact as "registration date:
 * <month year>" — the PHRASING moves, never the formatter. English and
 * Spanish keep their preposition, which their grammar allows.
 */
import type { ReactElement } from "react";
import { Typography } from "antd";
import { useFormat, useT } from "@stapel/core";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

/** The shape of the phrase — a month and a year, at the app's locale. */
const MONTH_YEAR = { month: "long", year: "numeric" } as const;

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
  const date = format.date(props.created_at, MONTH_YEAR);
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
