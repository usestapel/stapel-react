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
 *
 * THE GLYPH USED TO CONTRADICT THE STATE. It was a shield with a CHECK MARK
 * inside it, and the check mark is a claim: "you are protected". The state it
 * illustrated was "you have no passkeys" — the opposite claim — so the one
 * screen whose job is to tell a person how well defended they are opened by
 * reassuring them about a protection they had not set up (visual pass C7). The
 * shield is now empty: a place where something belongs, with nothing in it,
 * which is exactly what an empty security list means.
 */
import type { ReactElement } from "react";

/**
 * An empty shield outline — `currentColor` so it inherits antd's `Empty`
 * description colour (light/dark both handled for free). Decorative: the copy
 * beside it carries the meaning, so it is `aria-hidden` and has no role.
 */
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
      aria-hidden="true"
      focusable="false"
      style={{ opacity: 0.45 }}
    >
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
    </svg>
  );
}

/**
 * The same shield WITH the check — for a state that really is "this is
 * covered". Kept separate from {@link SecurityEmptyIcon} so the two can never
 * be swapped by accident again.
 */
export function SecurityOkIcon(): ReactElement {
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
      aria-hidden="true"
      focusable="false"
      style={{ opacity: 0.45 }}
    >
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
