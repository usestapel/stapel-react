/**
 * The skin's glyphs.
 *
 * Local SVGs rather than `@ant-design/icons`: that package is 500+ components
 * behind one barrel and no pair in the fleet carries it, so five inline paths
 * are both smaller and one fewer dependency to reason about. Every glyph paints
 * with `currentColor` — the colour is the surrounding text's, which is what
 * makes them correct in both themes without a single colour literal.
 *
 * They are decorative by construction (`aria-hidden`): the accessible name of
 * an icon-only control lives on the BUTTON, as `aria-label`
 * (`stapel/icon-button-needs-label`), never on the picture inside it.
 */
import type { ReactElement } from "react";

interface GlyphProps {
  readonly size?: number;
}

function glyph(path: ReactElement, size: number): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}

/** Dismiss / remove. */
export function CloseGlyph({ size = 16 }: GlyphProps): ReactElement {
  return glyph(<path d="M6 6l12 12M18 6L6 18" />, size);
}

/** The drag affordance on a card and on a column row. */
export function DragGlyph({ size = 16 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </>,
    size
  );
}

/** A card that other cards block. */
export function LockGlyph({ size = 14 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>,
    size
  );
}

/** The per-item overflow control. */
export function MoreGlyph({ size = 16 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>,
    size
  );
}
