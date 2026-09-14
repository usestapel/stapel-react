/**
 * The geometries this skin owns, lifted to named constants rather than
 * spelled inline. All of them are element-width decisions, not viewport ones:
 * a traceback keeps its shape wherever a host mounts it, including inside a
 * narrow drawer that is nobody's breakpoint.
 */
import type { CSSProperties } from "react";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";

/**
 * A traceback or a context blob is arbitrary text — one long line in it must
 * scroll INSIDE the block, never widen the page. `overflowX: auto` on the
 * `<pre>` is what keeps a phone from horizontally scrolling the whole issue
 * screen because one frame carried a 300-character path.
 *
 * `maxHeight` matters here more than in the pairs this pattern came from: a
 * Python traceback from a Django request is routinely sixty frames, and three
 * of them in a row would push every control on the screen below the fold.
 */
export const TRACE_BLOCK_STYLE: CSSProperties = {
  overflowX: "auto",
  overflowY: "auto",
  maxHeight: "24rem",
  margin: 0,
  padding: spacing[3],
  borderRadius: radii.md,
  fontSize: fontSize.sm.fontSize,
  lineHeight: `${String(fontSize.sm.lineHeight)}px`,
  // No background/colour: the `<pre>` inherits the surface it is dropped into,
  // which is the skin surface `SkinTheme` painted. A colour here would fight
  // the theme in exactly one of the two modes.
};

/**
 * The action row at the foot of a dialog, pinned to the bottom of the
 * dialog's own scroll box.
 *
 * A bottom sheet is a fixed slice of the viewport and these bodies are long —
 * the mute dialog is four presets, a date and a note. Left in the flow, the
 * one control somebody opened the sheet to press sits below an invisible fold.
 *
 * It is NOT `SkinDialog`'s `footer` slot: antd memoises that slot, so a button
 * whose gate opens once a field is filled keeps rendering the state it had on
 * the dialog's first frame.
 */
export const DIALOG_ACTION_BAR_STYLE: CSSProperties = {
  position: "sticky",
  bottom: 0,
  zIndex: 1,
  background: cssVar("surface-overlay"),
  paddingBlock: spacing[3],
};
