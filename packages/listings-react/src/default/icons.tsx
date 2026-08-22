/**
 * One inline glyph: the favourite heart, filled and outlined.
 *
 * No `@ant-design/icons` dependency — the house convention (profiles-react's
 * `icons.tsx`, shell-react's icon registry): a plain monochrome
 * `currentColor` SVG, so it inherits the theme instead of carrying a colour
 * of its own, and the pair stays one package lighter.
 *
 * `aria-hidden` on both: the button that holds them carries the label, and a
 * glyph announced beside its own label reads the action twice.
 */
import type { ReactElement } from "react";

export function HeartIcon(props: { filled: boolean }): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={props.filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}
