/**
 * Small inline glyphs for the default settings skins (owner UX audit
 * 2026-07-17, "Интеракции настроек" canon — frontend-guidelines.md §8): a
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
