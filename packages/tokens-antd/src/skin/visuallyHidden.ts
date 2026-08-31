/**
 * `visuallyHidden` — the fleet's one way to take text off the screen while
 * leaving it in the accessibility tree.
 *
 * The rule it encodes is that `display: none` and `visibility: hidden` remove
 * a node from BOTH, which is the wrong tool every time the text is still the
 * thing a screen reader needs: a results heading a phone has no room to
 * print, the name of an icon-only control, the caption of a table a sighted
 * person reads from its columns.
 *
 * Clipped rather than sized to zero. A zero-sized box is dropped from the
 * accessibility tree by some engines, so the box keeps one spacing step of
 * size and `clip-path` does the hiding; `position: absolute` takes it out of
 * flow so it cannot open a gap in the row it sits in, and `white-space:
 * nowrap` stops a long sentence from being clipped into a single character
 * column that some engines then report as empty.
 *
 * Written once here because it was written twice before — `calendar-react`
 * and `search-react` each had their own copy, and the two disagreed on
 * `clip-path` versus the deprecated `clip` property.
 */
import type { CSSProperties } from "react";
import { spacing } from "@stapel/tokens";

export const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: spacing[1],
  height: spacing[1],
  margin: 0,
  padding: 0,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};
