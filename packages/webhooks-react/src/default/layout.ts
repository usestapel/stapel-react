/**
 * The two geometries this skin owns, lifted to named constants rather than
 * spelled inline.
 *
 * Both are element-width decisions, not viewport ones: a JSON block and a
 * settings column keep their shape wherever a host mounts them, including
 * inside a narrow drawer that is nobody's breakpoint.
 */
import type { CSSProperties } from "react";
import { fontSize, radii, spacing } from "@stapel/tokens";

/**
 * A payload or an envelope is arbitrary JSON — one long line in it must scroll
 * INSIDE the block, never widen the page. `overflowX: auto` on the `<pre>` is
 * what keeps a phone from horizontally scrolling the whole settings screen
 * because one event carried a long URL.
 */
export const CODE_BLOCK_STYLE: CSSProperties = {
  overflowX: "auto",
  margin: 0,
  padding: spacing[3],
  borderRadius: radii.md,
  fontSize: fontSize.sm.fontSize,
  lineHeight: `${String(fontSize.sm.lineHeight)}px`,
  // No background/colour here: `Typography`'s own code styling would fight the
  // theme. The `<pre>` inherits the surface it is dropped into, which is the
  // skin surface `SkinTheme` painted.
};

/**
 * The settings column. A rule's event name, destination and status are read
 * left to right; past roughly this width the eye has to travel further than
 * the information justifies, so the column stops rather than filling a 27"
 * display with one table.
 */
export const SETTINGS_MAX_WIDTH = "56rem";
