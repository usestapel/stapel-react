/**
 * `<AppShell/>`'s icon registry: `NavEntry.icon` is a plain string (the
 * contract stays free of any UI-library dependency — see
 * `@stapel/core`'s `nav.ts`), and THIS module is what resolves that string
 * to an actual glyph. No `@ant-design/icons` dependency (house convention —
 * see `auth-react`/`profiles-react`'s own `default/icons.tsx`): plain,
 * monochrome, `currentColor` inline SVGs in the same spirit as auth-react's
 * `icon_svg` contract.
 *
 * KNOWN GAP (honest, not silently papered over): this registry only covers
 * the icon names the 3 Ф1-wired pairs actually declare today
 * (`LoginOutlined`, `SafetyCertificateOutlined`, `UserOutlined`,
 * `BellOutlined`). A pair declaring a new icon name renders the generic
 * `fallback` glyph until this registry grows a case for it — that is a
 * follow-up (a per-project icon registry override, or a small curated set
 * shipped here), not something an npm-installed consumer can silently work
 * around today.
 */
import type { ReactElement } from "react";

function svg(paths: ReactElement): (props: { size?: number }) => ReactElement {
  return function Icon({ size = 16 }: { size?: number }): ReactElement {
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
      >
        {paths}
      </svg>
    );
  };
}

const LoginOutlined = svg(
  <>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
  </>
);

const SafetyCertificateOutlined = svg(
  <>
    <path d="M12 2l8 3v6c0 5-3.4 8.4-8 11-4.6-2.6-8-6-8-11V5l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </>
);

const UserOutlined = svg(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </>
);

const BellOutlined = svg(
  <>
    <path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </>
);

/** Generic fallback — a plain square outline — for an icon name this
 * registry doesn't recognize (see module doc's KNOWN GAP). */
const fallback = svg(<rect x="5" y="5" width="14" height="14" rx="2" />);

const REGISTRY: Record<string, (props: { size?: number }) => ReactElement> = {
  LoginOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  BellOutlined,
};

/** Resolve a `NavEntry.icon` name to its glyph, falling back to a generic
 * square for an unregistered name (see module doc's KNOWN GAP). */
export function resolveNavIcon(name: string): ReactElement {
  const Icon = REGISTRY[name] ?? fallback;
  return <Icon />;
}
