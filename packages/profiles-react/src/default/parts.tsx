/**
 * Shared row anatomy for this pair's settings-shaped skins.
 *
 * Three files used to carry their own copy of the same wrapper, and they had
 * drifted: `<ProfileSettings/>`'s manifest rows drew a MUTED label,
 * `<LanguageSettings/>` and the editable text row drew a DARK one, and the
 * visual pass read the two weights inside one card as two kinds of field. One
 * label style is a property of the screen, not of each component that happens
 * to draw a field, so it is stated once here and imported.
 *
 * Deliberately NOT exported from `./index.ts`: these are internal to the skin
 * (the default-skin gate requires a demo per barrel export, and a label
 * wrapper is not a screen).
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { cssVar, spacing } from "@stapel/tokens";

/**
 * One setting per row (owner UX audit 2026-07-17; frontend-guidelines §8): a
 * subtitle-weight label ABOVE its own control, stacked top to bottom. For
 * manifest-driven rows the label text IS `entry.docstring`, so a custom field
 * a host selects gets a readable label with no frontend translation work.
 */
export function SettingRow(props: {
  label: string;
  children: ReactNode;
  /** Give the label an `id` so a control can point `aria-labelledby` at it. */
  labelId?: string;
}): ReactElement {
  return (
    <div>
      <span
        {...(props.labelId !== undefined ? { id: props.labelId } : {})}
        style={{
          display: "block",
          marginBottom: spacing[1],
          color: cssVar("text-muted"),
        }}
      >
        {props.label}
      </span>
      {props.children}
    </div>
  );
}

/**
 * A `Segmented`'s track.
 *
 * antd derives the track from its own algorithm, and the two sides do not
 * match: in light it lands within a hair of the card it sits on (the visual
 * pass found the theme picker with no visible track at all), while in dark it
 * separates clearly. A control cannot have one anatomy in light and another in
 * dark, so the track is painted from the role token that means exactly this —
 * a recess in a raised surface — which resolves per side from the same
 * stylesheet the rest of the skin reads.
 */
export const SEGMENTED_TRACK: CSSProperties = {
  background: cssVar("surface-sunken"),
};

/**
 * WHO OWNS THE EDGE OF A SETTINGS SECTION.
 *
 * Every section on this screen is an antd `Card`, and a Card is a raised box:
 * `paddingLG` (24) plus a 1px border, so its content starts 25px in from
 * wherever the card was placed. Mounted straight into a router that is the
 * whole point — the card IS the page's frame. Inside a shell it is the second
 * frame: `@stapel/shell-react` already pads its content box with
 * `--stapel-page-gutter`, so on a phone the settings rows sat ~29px in while
 * the header above them sat at 4, which reads as a column that missed the
 * page rather than as a card.
 *
 * `"shell"` therefore drops the two things that draw a second frame — the
 * INLINE padding and the border — and keeps every vertical measure, because
 * the rhythm between a section's title and the section above it is this
 * screen's own business and no shell supplies it. It is the same trade
 * `<SecuritySettings gutter>` makes for the page it owns.
 *
 * A prop rather than a context read, for the reason `<CategoryPage gutter>`
 * gives: whether there is a gutter outside this component is a fact about the
 * COMPOSITION, and only the composing surface knows it.
 */
export function sectionCardChrome(gutter: "own" | "shell" | undefined): {
  style: CSSProperties;
  styles: { body: CSSProperties };
} {
  if (gutter !== "shell") return { style: { width: "100%" }, styles: { body: {} } };
  return {
    // `borderWidth` and not the `border` shorthand: the card's border is
    // `1px solid …` and zeroing the width is what removes it, in a longhand
    // every engine (and jsdom, so the test can see it) actually keeps.
    style: { width: "100%", borderWidth: 0 },
    styles: { body: { paddingInline: 0 } },
  };
}
