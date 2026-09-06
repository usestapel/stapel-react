/**
 * `<ProfileNameHeading/>` — a person's name as the heading of a page, and the
 * SPACE that name will need before it has arrived.
 *
 * ── What was on screen (D453) ─────────────────────────────────────────────
 *
 * A seller page measured on the stand: while the profile read was in flight
 * the slot above the results held a plain 24px line of muted text ("loading
 * the seller's profile"), and when the answer landed that line was replaced by
 * an `h4` with antd's heading margins — 86px in the same slot. The 46px
 * difference pushed the rating line, the whole results grid and everything
 * under them down the page, 537ms after first paint. That one swap was the
 * page's entire layout shift: CLS **0.0281** at 1440 and **0.0396** at 1280,
 * the only one of four measured surfaces above 0.01.
 *
 * Nothing was wrong with either state on its own. What was missing is that
 * they are the SAME SLOT, and only one side of the app knows how tall a
 * heading is — this one. A host cannot reserve a height it would have to
 * measure out of antd's heading tokens by hand, and a host that guessed would
 * be back here the next time the type scale moved.
 *
 * ── The fix is that both states are the HEADING ───────────────────────────
 *
 * Loading does not render a different element with different metrics; it
 * renders the same `<Typography.Title>` at the same level with a placeholder
 * bar inside it. Antd's margins therefore apply identically in both states,
 * and the line box is one line in both, because an inline-block inside a
 * heading makes a line box at least as tall as that heading's own strut.
 *
 * The class contract states the floor as well ({@link profileNameCss}), from
 * the level's own antd tokens rather than a number typed here: a placeholder
 * that shrank, a skin that retuned the heading, or a font that failed to load
 * would otherwise all be ways for the reserved height to quietly stop matching
 * the height it is reserving for.
 *
 * ── What it says while it waits ───────────────────────────────────────────
 *
 * The bar is `aria-hidden` and the heading carries `aria-busy` plus the
 * pair's own "loading the profile" sentence as its accessible name: a heading
 * announced with no name at all is worse than one that says what it is
 * waiting for, and the sentence is a key like every other string here.
 */
import type { CSSProperties, ReactElement } from "react";
import { Typography, theme as antdTheme } from "antd";
import type { GlobalToken } from "antd";
import { cssVar, radii } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

/** The class both states carry — the reserved height, and a host's hook. */
export const PROFILE_NAME_CLASS = "stapel-profile-name";
/** The class the loading bar carries. */
export const PROFILE_NAME_PLACEHOLDER_CLASS = "stapel-profile-name-bar";
/** The custom property the heading publishes its own line height through, so
 * ONE hoisted stylesheet serves every level and either theme. */
export const PROFILE_NAME_LINE_VAR = "--stapel-profile-name-line";
/** The `href` the hoisted stylesheet is deduplicated by. */
export const PROFILE_NAME_STYLE_HREF = "stapel-profiles-name-heading";

/** Which heading a name is drawn as. `4` is the page-heading level a seller
 * page uses; the prop exists because only the host knows what else is on the
 * page above it. */
export type ProfileNameLevel = 1 | 2 | 3 | 4 | 5;

/**
 * The rules an inline style cannot express: the placeholder's own geometry
 * (it is a child) and the floor, which both states read from the same
 * per-instance custom property.
 */
export function profileNameCss(): string {
  return [
    // The RESERVATION. One line of this heading, whether or not there is a
    // line of text in it yet.
    `.${PROFILE_NAME_CLASS}{min-block-size:var(${PROFILE_NAME_LINE_VAR})}`,
    // The bar. `1em` rather than the full line height so the inline-block
    // cannot make the line box taller than the strut it is standing in; the
    // floor above is what guarantees the height, not this.
    `.${PROFILE_NAME_PLACEHOLDER_CLASS}{display:inline-block;` +
      `inline-size:min(14ch,60%);block-size:1em;vertical-align:middle;` +
      `border-radius:${String(radii.sm)}px;background:${cssVar("surface-sunken")}}`,
  ].join("");
}

/** One line of this heading, in CSS pixels — the level's own antd tokens,
 * multiplied. Written as a table rather than an index expression because the
 * five tokens are five separately named fields. */
export function headingLineHeight(token: GlobalToken, level: ProfileNameLevel): number {
  // antd types both halves `string | number` (a theme may state a size or a
  // unitless ratio either way), so each is read through `Number` rather than
  // asserted — and a theme that made either unreadable falls back rather than
  // reserving `NaN` pixels.
  const scale: Readonly<
    Record<ProfileNameLevel, readonly [string | number, string | number]>
  > = {
    1: [token.fontSizeHeading1, token.lineHeightHeading1],
    2: [token.fontSizeHeading2, token.lineHeightHeading2],
    3: [token.fontSizeHeading3, token.lineHeightHeading3],
    4: [token.fontSizeHeading4, token.lineHeightHeading4],
    5: [token.fontSizeHeading5, token.lineHeightHeading5],
  };
  const [size, line] = scale[level];
  const px = Number(size);
  const ratio = Number(line);
  if (!Number.isFinite(px)) return 0;
  return Math.round(px * (Number.isFinite(ratio) ? ratio : 1));
}

export interface ProfileNameHeadingProps {
  /** The person's display name. Empty or absent draws the pair's word for a
   * profile with no name, exactly as `<PersonRow>` does — never blank space
   * where a heading should be. */
  readonly name?: string | null;
  /**
   * The read has not answered yet. The heading still renders, at the same
   * level and with the same margins, holding a placeholder bar — which is the
   * whole point of the component (see the file header).
   */
  readonly loading?: boolean;
  /** Which heading level. Default `4`. */
  readonly level?: ProfileNameLevel;
  /** Default `profile-name`. */
  readonly testId?: string;
  readonly style?: CSSProperties;
}

export function ProfileNameHeading(props: ProfileNameHeadingProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const level = props.level ?? 4;
  const loading = props.loading === true;
  const name = props.name?.trim() ?? "";
  const testId = props.testId ?? "profile-name";

  return (
    <>
      <style href={PROFILE_NAME_STYLE_HREF} precedence="default">
        {profileNameCss()}
      </style>
      <Typography.Title
        level={level}
        className={PROFILE_NAME_CLASS}
        data-testid={testId}
        // WHICH STATE IS ON SCREEN, published rather than inferred — a walker
        // measuring the swap has no other way to tell "still loading" from "a
        // person whose name happens to be missing".
        data-state={loading ? "loading" : "ready"}
        style={{
          [PROFILE_NAME_LINE_VAR as string]: `${String(
            headingLineHeight(token, level)
          )}px`,
          ...props.style,
        }}
        {...(loading
          ? { "aria-busy": true, "aria-label": t(PROFILES_I18N_KEYS.profileLoading) }
          : {})}
      >
        {loading ? (
          <span
            className={PROFILE_NAME_PLACEHOLDER_CLASS}
            data-testid={`${testId}-placeholder`}
            aria-hidden="true"
          />
        ) : name.length > 0 ? (
          name
        ) : (
          t(PROFILES_I18N_KEYS.personUnnamed)
        )}
      </Typography.Title>
    </>
  );
}
