/**
 * The picker's caret.
 *
 * No `@ant-design/icons` dependency — the house convention (listings-react's
 * `icons.tsx`, profiles-react's, shell-react's icon registry): a plain
 * monochrome `currentColor` SVG, so it inherits the theme instead of carrying
 * a colour of its own, and the pair stays one package lighter.
 *
 * `aria-hidden`: the trigger it sits in carries the accessible name, and a
 * glyph announced beside its own label reads the control twice.
 */
import type { ReactElement } from "react";

export function ChevronDown(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
