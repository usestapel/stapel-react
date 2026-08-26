/**
 * The two glyphs this skin needs, as inline `currentColor` SVGs.
 *
 * No `@ant-design/icons` dependency — the house convention every pair in this
 * monorepo follows (`auth-react`, `profiles-react`, `shell-react` all carry
 * their own `default/icons.tsx`): an icon set is 800 KB of dependency for two
 * shapes, and a monochrome path that inherits `currentColor` themes itself in
 * light and dark with no bridge at all.
 *
 * Both are `aria-hidden`: an icon-only control carries its name in
 * `aria-label` on the BUTTON (`stapel/icon-button-needs-label`), and a glyph
 * that also announced itself would say everything twice.
 */
import type { ReactElement } from "react";
import { spacing } from "@stapel/tokens";

const DEFAULT_SIZE = spacing[4];

function frame(paths: ReactElement, size: number): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
}

/** A globe — the language control, in every product on earth. */
export function GlobeIcon(props: { size?: number }): ReactElement {
  return frame(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </>,
    props.size ?? DEFAULT_SIZE
  );
}

/** Two overlapping characters — "render this in another language". */
export function TranslateIcon(props: { size?: number }): ReactElement {
  return frame(
    <>
      <path d="M4 5h10" />
      <path d="M9 3v2" />
      <path d="M11 5a11 11 0 0 1-7 9" />
      <path d="M6.5 10A9 9 0 0 0 13 14" />
      <path d="M12.5 21l4.5-10l4.5 10" />
      <path d="M14.5 17h5" />
    </>,
    props.size ?? DEFAULT_SIZE
  );
}
