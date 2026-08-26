/**
 * The report glyph, inline.
 *
 * No `@ant-design/icons` dependency — the house convention (listings-react,
 * profiles-react, shell-react's registry): a monochrome `currentColor` SVG so
 * it inherits the theme instead of carrying a colour of its own, and the pair
 * stays one package lighter.
 *
 * `aria-hidden`, always: the button that holds it carries the label, and a
 * glyph announced beside its own label reads the action twice.
 */
import type { ReactElement } from "react";

/** A flag on a pole — "report this". */
export function FlagIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
    >
      <path d="M4 22V4" />
      <path d="M4 4h11l-1.5 4L15 12H4z" />
    </svg>
  );
}
