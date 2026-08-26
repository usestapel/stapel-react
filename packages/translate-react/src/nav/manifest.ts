/**
 * @stapel/translate-react's contribution to the scripted-fullstack navigation
 * contract (`@stapel/core`'s `NavEntry` / `PackageNavManifest`).
 *
 * `scripts/gen-nav-manifest.mjs` reads `navEntries` below, stamps
 * `package`/`version` from this package's own `package.json`, and writes
 * `packages/translate-react/nav-manifest.json` plus this package's slice of the
 * monorepo's root aggregate. `resolveNav` (`@stapel/shell-react`) turns that
 * aggregate plus a host's override file into the tree a shell renders.
 *
 * ── ONE entry, and its id does not start with `translate.` ────────────────
 *
 * `account.language`, following gdpr-react's `account.privacy` precedent
 * (design §3): the id names the MENU an entry belongs to, because that is what
 * an id is for in a tree assembled from many packages. Nobody looks for "change
 * the language" under the name of the translation service; a person looks in
 * their account settings. `account.root` is a CONTAINER-owned parent this pair
 * does not declare — `resolveNav` DROPS an orphaned submenu entry rather than
 * throwing, so a host with no account section gets a smaller menu, not a broken
 * build.
 *
 * ── What is deliberately NOT here ─────────────────────────────────────────
 *
 * `<LanguageSwitcher compact/>` is header chrome: the container passes it into
 * `AppShell`'s existing `headerExtra` slot (`packages/shell-react/src/default/
 * AppShell.tsx`). Chrome that appears on every page is not a destination, and
 * giving it a route would put "Language" in the menu twice.
 *
 * `<TranslatedText/>` / `<TranslateButton/>` mount inside somebody else's
 * screen (a listing, a review) — they have no address of their own either.
 *
 * ICON: this entry wants a globe. `@stapel/shell-react`'s registry has no
 * `GlobalOutlined` yet (an unregistered name renders a generic square), so it
 * borrows the registered neighbour `MessageOutlined` — the same borrow
 * profiles-react's `profiles.language` makes. Requested in the wave-B REQUESTS
 * file; this pair's own skin draws its globe from `src/default/icons.tsx`.
 */
import type { NavEntry } from "@stapel/core";

/** The container-owned account section this screen hangs from. */
export const ACCOUNT_ROOT_ID = "account.root";

export const navEntries: readonly NavEntry[] = [
  {
    id: "account.language",
    labelKey: "translate.nav.language",
    // Wants a globe — see the icon note above.
    icon: "MessageOutlined",
    route: { path: "language" },
    component: { export: "LanguageSettingsPane", subpath: "default" },
    placement: { level: "submenu", parentId: ACCOUNT_ROOT_ID },
    menuVisibleDefault: true,
    // The choice is remembered for a visitor too (device scope), but the
    // SCREEN is account chrome: a shell renders it inside the signed-in area,
    // and an anonymous storefront reaches the same control through the header.
    requiresAuth: true,
    surface: "member",
    order: 40,
  },
];
