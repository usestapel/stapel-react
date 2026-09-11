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

export interface HeartIconProps {
  /** Saved: the glyph is a solid shape rather than an outline. THE state a
   * person reads off a card, so it is the one prop this icon has. */
  readonly filled: boolean;
  /**
   * The accent a SAVED heart is painted in — an antd theme token the caller
   * resolved (`token.colorPrimary`), never a literal.
   *
   * The icon stays `currentColor` by default, which is what keeps it
   * theme-neutral in every other state; this is the one place a colour is
   * warranted, because "filled" and "outline" of the same neutral grey is a
   * difference a person reads at a glance on a mock-up and misses entirely on
   * a 170px feed tile in daylight.
   */
  readonly color?: string;
}

export function HeartIcon(props: HeartIconProps): ReactElement {
  const paint = props.color ?? "currentColor";
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={props.filled ? paint : "none"}
      stroke={paint}
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
 * The share glyph — three nodes and two edges, the platform-neutral shape
 * both Android and the web draw for "send this somewhere else".
 *
 * `aria-hidden`, like the heart: the control it sits in carries the verb as
 * its accessible name in every arm, including the phone arm where the word
 * itself is not painted, and a glyph announced beside its own label reads the
 * action twice.
 *
 * Deliberately not the iOS "box with an arrow": that shape means "share" to
 * an iPhone user and "upload" or "export" to everybody else, and this control
 * is drawn on a browser, not inside an app the platform styled.
 */
export function ShareIcon(): ReactElement {
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
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5 15.4 6.6" />
      <path d="M8.6 13.5 15.4 17.4" />
    </svg>
  );
}

/**
 * A chain link — the copy row's glyph, and the one thing on the menu that is
 * not a network's own brand.
 */
export function LinkIcon(): ReactElement {
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
      <path d="M10 13a5 5 0 0 0 7.5.6l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.6l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
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

/**
 * The condensed bar's back arrow.
 *
 * `aria-hidden`, like the heart and the share glyph: the control around it
 * carries "Back" as its accessible name, and a glyph announced beside its own
 * label reads the action twice.
 *
 * Drawn with the logical writing direction in mind only as far as a library
 * honestly can: the shape points at the INLINE START, and a right-to-left host
 * flips it with one `transform` against this package's own class rather than
 * getting a mirrored copy nobody can name.
 */
export function BackIcon(): ReactElement {
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
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}
