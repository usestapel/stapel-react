/**
 * Small inline glyphs for the default settings skins (owner UX audit
 * 2026-07-17, "Settings Interactions" canon — frontend-guidelines.md §8): a
 * read-only text row's edit affordance. No `@ant-design/icons` dependency
 * (profiles-react carries none) — a plain, monochrome, `currentColor` SVG in
 * the same spirit as auth-react's `icon_svg` contract glyphs.
 */
import type { ReactElement } from "react";

export function EditPencilIcon(): ReactElement {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

/**
 * "Copy this" — for the revealed number's control, which is icon-only so that
 * a number and its copy button fit one line in a narrow box (see
 * `RevealPhoneButton.tsx`, CONTACT_REVEAL_LABEL_MIN_WIDTH). The button carries
 * the words as `aria-label`/`title`; the glyph is `aria-hidden`.
 */
export function CopyIcon(): ReactElement {
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
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** "Copied" — the same control, one gesture later. */
export function CheckIcon(): ReactElement {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
