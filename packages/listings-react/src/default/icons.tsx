/**
 * The pair's inline glyphs: the favourite heart, and the price-trend arrow.
 *
 * No `@ant-design/icons` dependency — the house convention (profiles-react's
 * `icons.tsx`, shell-react's icon registry): a plain monochrome
 * `currentColor` SVG, so it inherits the theme instead of carrying a colour
 * of its own, and the pair stays one package lighter.
 *
 * `aria-hidden` on the heart: the button that holds it carries the label, and
 * a glyph announced beside its own label reads the action twice. The TREND
 * arrow is the opposite case — it is the only thing on the line saying which
 * way the price moved, so it takes a name from the caller and is announced.
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

/**
 * Which way the asking price moved — an arrow, and a NAME for it.
 *
 * The arrow is the whole message ("this got cheaper"), so unlike the heart it
 * is not `aria-hidden`: it carries `role="img"` and the sentence the caller
 * resolved from its own key registry. A glyph that means something and is
 * hidden from assistive tech means nothing to the people who need it stated.
 */
export function PriceTrendIcon(props: {
  direction: "down" | "up";
  label: string;
}): ReactElement {
  const down = props.direction === "down";
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
      aria-label={props.label}
    >
      <path d={down ? "M12 5v14" : "M12 19V5"} />
      <path d={down ? "M6 13l6 6 6-6" : "M6 11l6-6 6 6"} />
    </svg>
  );
}
