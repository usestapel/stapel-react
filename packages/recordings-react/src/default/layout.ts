/**
 * Geometry the recordings screens share.
 *
 * Two findings from the visual audit are answered here rather than in each
 * component, because both were CLASSES:
 *
 *  - **M-5** (desktop is the phone layout pinned to the top-left): a
 *    page-level surface gets a measure and centres inside it, so 1280px does
 *    not render as a 560px card with 70 % dead canvas.
 *  - **M-4** (content wider than the phone viewport): every width here is
 *    relative, and anything intentionally wide (a transcript line, a long
 *    title) wraps or scrolls inside its own box instead of pushing the page
 *    into horizontal scroll.
 *
 * Element-width geometry, not viewport-width: nothing below reads the window.
 * A pane rendered in a 360px column and the same pane rendered full-bleed
 * behave the same way, because the sizes are `%`/`rem`/`ch` and the stacking
 * is flex.
 */
import type { CSSProperties } from "react";
import { spacing } from "@stapel/tokens";

/** The reading measure a page-level surface centres inside. */
export const PAGE_MEASURE = "56rem";

/** A page-level screen: centred, measured, never wider than its column. */
export const pageStyle: CSSProperties = {
  width: "100%",
  maxWidth: PAGE_MEASURE,
  marginInline: "auto",
  paddingInline: spacing["4"],
  paddingBlock: spacing["5"],
  display: "flex",
  flexDirection: "column",
  gap: spacing["5"],
  boxSizing: "border-box",
};

/** A vertical stack with the default rhythm. */
export const stackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing["3"],
  minWidth: 0,
};

/** A row that wraps rather than overflowing — the phone-safe toolbar. */
export const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: spacing["2"],
  minWidth: 0,
};

/**
 * Long single-line values (a title, a filename, a provider id) truncate
 * instead of widening their column. `minWidth: 0` is the part that actually
 * does it inside a flex row — without it a flex item refuses to shrink below
 * its content and the page scrolls sideways.
 */
export const truncateStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
