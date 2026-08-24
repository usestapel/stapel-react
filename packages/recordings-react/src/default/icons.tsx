/**
 * The skin's glyphs: plain monochrome `currentColor` SVGs.
 *
 * No `@ant-design/icons` dependency — the house convention (listings-react's
 * and profiles-react's `icons.tsx`, shell-react's registry): a glyph that
 * inherits the theme instead of carrying a colour of its own, and one fewer
 * package in a consumer's graph.
 *
 * All `aria-hidden`: the control holding them carries the label, and a glyph
 * announced beside its own label reads the action twice.
 */
import type { ReactElement } from "react";

function Glyph(props: { children: ReactElement }): ReactElement {
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
      {props.children}
    </svg>
  );
}

/** A waveform — the recordings mark. */
export function WaveformIcon(): ReactElement {
  return (
    <Glyph>
      <g>
        <path d="M3 12h2" />
        <path d="M8 7v10" />
        <path d="M12 4v16" />
        <path d="M16 8v8" />
        <path d="M20 11v2" />
      </g>
    </Glyph>
  );
}

/** A padlock — the passcode gate. */
export function LockIcon(): ReactElement {
  return (
    <Glyph>
      <g>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </g>
    </Glyph>
  );
}

/** A circular arrow — re-run / refresh. */
export function RefreshIcon(): ReactElement {
  return (
    <Glyph>
      <g>
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </g>
    </Glyph>
  );
}

/** A coin — the metered refusal. */
export function CreditIcon(): ReactElement {
  return (
    <Glyph>
      <g>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8" />
        <path d="M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" />
      </g>
    </Glyph>
  );
}
