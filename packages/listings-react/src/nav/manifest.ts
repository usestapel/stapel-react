/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`). `scripts/gen-nav-
 * manifest.mjs` reads `navEntries` below, stamps `package`/`version` from THIS
 * package's own `package.json`, and emits
 * `packages/listings-react/nav-manifest.json` plus this package's slice of the
 * root aggregate.
 *
 * ── Four entries, and the one thing they are NOT ───────────────────────────
 *
 * There is no entry for a card. A card is a SLOT, not a route (spec §3.7):
 * `@stapel/search-react` takes `renderCard`, the container passes
 * `<ListingCard>` from this pair's `/default`, and the two L2 pairs never
 * import each other. A nav entry for it would claim a page that does not
 * exist.
 *
 * `surface` is declared EXPLICITLY on all four. The derivation
 * `requiresAuth ? "member" : "public"` lands on the same answer today, but
 * the explicit declaration is what a public container can rely on: an entry
 * that later gains `requiresAuth` for an unrelated reason must not silently
 * fall out of the anonymous tree (`core/src/nav.ts`, `navEntrySurface`).
 *
 * ── Why the detail is public and the other three are not ───────────────────
 *
 * `/l/:id` is the page a shared link opens, the page a search result leads
 * to, and the page a message quotes — a marketplace whose listing page needs
 * a session has no shop window. It is spelled out in spec §5.2 with this
 * exact path and this exact surface. `menuVisibleDefault: false` because a
 * parameterized route is a navigation TARGET, not a menu item (the same
 * treatment `auth.login` and `search.results` get).
 *
 * The other three need a mandate and say so. Two of them are SUBMENU entries
 * under `account.root` — an id this pair does not own and does not declare:
 * the cabinet has no module of its own, so the CONTAINER declares that top
 * entry in its `stapel.nav.json` override. `resolveNav` drops an orphaned
 * submenu entry instead of throwing (`NavPlacement.parentId`), so a host that
 * installs this pair without a cabinet gets a smaller menu rather than a
 * broken build.
 */
import type { NavEntry } from "@stapel/core";

/** The container-owned top entry the cabinet's submenu hangs from. Declared
 * as a constant so the two references below cannot drift apart, and exported
 * so a container can assert it against its own override file. */
export const ACCOUNT_ROOT_ID = "account.root";

export const navEntries: readonly NavEntry[] = [
  {
    id: "listings.detail",
    labelKey: "listings.nav.detail",
    icon: "TagOutlined",
    route: { path: "/l/:id" },
    component: { export: "ListingDetailPane", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: false,
    surface: "public",
    order: 10,
  },
  {
    id: "listings.compose",
    labelKey: "listings.nav.compose",
    icon: "PlusOutlined",
    route: { path: "/new" },
    component: { export: "ListingComposerPage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 20,
  },
  {
    // Relative path: a child of the container's `/account` layout route.
    id: "listings.mine",
    labelKey: "listings.nav.mine",
    icon: "ProfileOutlined",
    route: { path: "listings" },
    component: { export: "MyListingsPane", subpath: "default" },
    placement: { level: "submenu", parentId: ACCOUNT_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 10,
  },
  {
    id: "listings.favorites",
    labelKey: "listings.nav.favorites",
    icon: "HeartOutlined",
    route: { path: "favorites" },
    component: { export: "FavoritesPane", subpath: "default" },
    placement: { level: "submenu", parentId: ACCOUNT_ROOT_ID },
    menuVisibleDefault: true,
    requiresAuth: true,
    surface: "member",
    order: 20,
  },
];
