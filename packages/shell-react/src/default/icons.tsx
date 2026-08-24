/**
 * `<AppShell/>`'s icon registry: `NavEntry.icon` is a plain string (the
 * contract stays free of any UI-library dependency — see
 * `@stapel/core`'s `nav.ts`), and THIS module is what resolves that string
 * to an actual glyph. No `@ant-design/icons` dependency (house convention —
 * see `auth-react`/`profiles-react`'s own `default/icons.tsx`): plain,
 * monochrome, `currentColor` inline SVGs in the same spirit as auth-react's
 * `icon_svg` contract.
 *
 * COVERAGE: this registry carries a case for every icon name any pair in
 * this monorepo declares in its `nav-manifest.json` today. A name from
 * OUTSIDE the monorepo — a downstream consumer's own pair, or a name typo'd
 * in a manifest — still resolves to the generic `fallback` square: that is
 * the honest answer for a name this registry has never heard of, not a gap.
 * Adding a new pair with a new icon name means adding a case here too (a
 * test in `test/navIconRegistry.test.tsx` fails otherwise).
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

const AppstoreOutlined = svg(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </>
);

const AuditOutlined = svg(
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M9 13l2 2 4-4.5" />
  </>
);

const ClockCircleOutlined = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </>
);

const FolderOpenOutlined = svg(
  <>
    <path d="M3 7.5V6a1 1 0 0 1 1-1h4.5l2 2H19a1 1 0 0 1 1 1v1.5" />
    <path d="M2.2 9.5h19.1a.8.8 0 0 1 .78.97l-1.6 7.2a1 1 0 0 1-.98.83H4a1 1 0 0 1-.98-.8l-1.6-7.2a.8.8 0 0 1 .78-1z" />
  </>
);

const HeartOutlined = svg(
  <path d="M12 20.5s-7.5-4.7-9.8-9.4A5.2 5.2 0 0 1 12 6.3a5.2 5.2 0 0 1 9.8 4.8c-2.3 4.7-9.8 9.4-9.8 9.4z" />
);

const MessageOutlined = svg(
  <>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 17l-1.5 4v-4" />
  </>
);

const OrderedListOutlined = svg(
  <>
    <path d="M9 6h11" />
    <path d="M9 12h11" />
    <path d="M9 18h11" />
    <path d="M4 4.5v3" />
    <path d="M3.5 10.5h1.5l-1.5 1.5h1.5" />
    <path d="M3.5 16.5h1.3a.8.8 0 0 1 0 1.6h-.3a.9.9 0 0 1 .3 1.7h-1.3" />
  </>
);

const PlusOutlined = svg(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);

const ProfileOutlined = svg(
  <>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8" />
    <path d="M8 12h8" />
    <path d="M8 16h5" />
  </>
);

const QrcodeOutlined = svg(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="5.5" y="5.5" width="2" height="2" />
    <rect x="16.5" y="5.5" width="2" height="2" />
    <rect x="5.5" y="16.5" width="2" height="2" />
    <rect x="14" y="14" width="3" height="3" />
    <rect x="19" y="14" width="2" height="2" />
    <rect x="14" y="19" width="2" height="2" />
    <rect x="19" y="19" width="2" height="2" />
  </>
);

const SearchOutlined = svg(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </>
);

const TagOutlined = svg(
  <>
    <path d="M12.5 3H5a2 2 0 0 0-2 2v7.5a2 2 0 0 0 .586 1.414l8.5 8.5a2 2 0 0 0 2.828 0l6.086-6.086a2 2 0 0 0 0-2.828l-8.5-8.5A2 2 0 0 0 12.5 3z" />
    <circle cx="8" cy="8" r="1.5" />
  </>
);

/** Generic fallback — a plain square outline — for an icon name this
 * registry doesn't recognize (see module doc's COVERAGE note). */
const fallback = svg(<rect x="5" y="5" width="14" height="14" rx="2" />);

const REGISTRY: Record<string, (props: { size?: number }) => ReactElement> = {
  LoginOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  BellOutlined,
  AppstoreOutlined,
  AuditOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  HeartOutlined,
  MessageOutlined,
  OrderedListOutlined,
  PlusOutlined,
  ProfileOutlined,
  QrcodeOutlined,
  SearchOutlined,
  TagOutlined,
};

/**
 * Every icon name this registry resolves to a real glyph — the reference set
 * `scripts/gen-nav-manifest.mjs` validates a manifest's `icon` fields against
 * (shared-layer audit G5: a typo used to ship a blank square with no error
 * anywhere).
 *
 * The gate reads the `REGISTRY` object literal above out of this file's TEXT,
 * because a lint/codegen script cannot import TSX. This export is the same
 * set for anything that CAN import it (a host validating its own pair's
 * manifest, this package's own tests), derived from the one table rather than
 * hand-listed beside it — a second list is a second thing to forget.
 */
export const NAV_ICON_NAMES: readonly string[] = Object.keys(REGISTRY).sort();

/** Does this registry resolve `name` to a real glyph (rather than the generic
 * fallback square)? */
export function isNavIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRY, name);
}

/** Resolve a `NavEntry.icon` name to its glyph, falling back to the generic
 * `fallback` square for a name outside this registry's coverage (see the
 * module doc's COVERAGE note). */
export function resolveNavIcon(name: string): ReactElement {
  const Icon = REGISTRY[name] ?? fallback;
  return <Icon />;
}

/**
 * The hamburger. Deliberately NOT in `REGISTRY`: that table is the set of
 * names a nav MANIFEST may declare, and no manifest ever declares the shell's
 * own chrome. It was a `☰` text glyph, which is a character whose size,
 * weight and vertical alignment are whatever the host's font decided — inside
 * a button sized for a 44px touch target, on a phone, that is the one control
 * every visitor has to hit first.
 */
export function MenuGlyph({ size = 18 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      role="img"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}
