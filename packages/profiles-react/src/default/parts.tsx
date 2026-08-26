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
