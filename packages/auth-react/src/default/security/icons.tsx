/**
 * Security-tab empty-state glyph (owner UX audit 2026-07-17, point 6): antd's
 * `<Empty/>` default image is a cartoonish "no data" illustration — fine for a
 * generic list, out of place in a security settings context next to the
 * plain, functional line-art the `icon_svg` auth-contract already
 * standardizes on (see `AuthPanel.tsx`'s `ChannelIcon` / `channels.ts`'s
 * `methodIconSvg`). One small, consistent, monochrome glyph replaces it
 * everywhere in this tab (sessions/passkeys/OAuth links) instead of three
 * different antd mascots — overridable per component via an `emptyIcon` prop
 * for a host that wants its own.
 */
import type { ReactElement } from "react";

/** A simple shield-outline glyph — `currentColor` so it inherits antd's
 * `Empty` description colour (light/dark both handled for free). */
export function SecurityEmptyIcon(): ReactElement {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
      style={{ opacity: 0.45 }}
    >
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
