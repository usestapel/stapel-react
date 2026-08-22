/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`). `scripts/gen-nav-
 * manifest.mjs` reads `navEntries` below, stamps `package`/`version` from THIS
 * package's own `package.json`, and emits
 * `packages/categories-react/nav-manifest.json` plus this package's slice of
 * the root aggregate.
 *
 * ── Why `/` is NOT claimed here ────────────────────────────────────────────
 *
 * The spec's route table (§5.1) gives `/` to "categories + search": a carousel
 * of categories above a feed of the newest listings. That screen is COMPOSED
 * of two pairs, and a composed route belongs to the container that composes it
 * (§6.2 — wiring adds, generation emits). A pair claiming `/` would be one
 * package deciding the landing page of every host that installs it, and the
 * second pair would have nowhere to put its half.
 *
 * So the catalogue's own root is `/c` — the whole tree as a browsable page,
 * which is a real single-pair screen — and `/c/:slug` is the category page.
 * The container's landing mounts `<CategoryCarousel>` (or the skin's
 * `CategoryCarouselStrip`) itself, which is one line and no manifest entry.
 *
 * Both entries declare `surface: "public"` EXPLICITLY. The derivation
 * `requiresAuth ? "member" : "public"` lands on the same answer today; the
 * explicit declaration is what a public container can rely on if an entry ever
 * gains an auth requirement for an unrelated reason (`core/src/nav.ts`,
 * `navEntrySurface`; the trap is §1.3 — `audience: undefined` does not filter).
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    // The catalogue root: the tree, browsable, with the carousel above it.
    // This one IS a menu item — "Catalogue" is the browse bar's anchor, which
    // is why it is the single entry in this pair with
    // `menuVisibleDefault: true`.
    id: "categories.catalog",
    labelKey: "categories.catalog.title",
    icon: "AppstoreOutlined",
    route: { path: "/c" },
    component: { export: "CatalogPage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: false,
    surface: "public",
    order: 5,
  },
  {
    // `/c/:slug`, not `/c/:id`. `Category.slug` is `unique=True` on the model,
    // but the SERVER cannot look a category up by it — `lookup_field` is never
    // overridden and the list endpoint has no slug filter — so the resolution
    // happens client-side against the synced tree (spec §4.3). A
    // parameterized route is a navigation TARGET, not a menu item: the same
    // treatment `auth.login` and `search.results` get.
    id: "categories.category",
    labelKey: "categories.category.title",
    icon: "FolderOpenOutlined",
    route: { path: "/c/:slug" },
    component: { export: "CategoryPage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: false,
    surface: "public",
    order: 6,
  },
];
