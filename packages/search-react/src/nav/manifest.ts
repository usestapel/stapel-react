/**
 * This pair's contribution to the scripted-fullstack nav contract
 * (`@stapel/core`'s `NavEntry`/`PackageNavManifest`). `scripts/gen-nav-
 * manifest.mjs` reads `navEntries` below, stamps `package`/`version` from THIS
 * package's own `package.json`, and emits
 * `packages/search-react/nav-manifest.json` plus this package's slice of the
 * root aggregate.
 *
 * Both entries declare `surface: "public"` EXPLICITLY. The derivation
 * `requiresAuth ? "member" : "public"` would land on the same answer here, but
 * the explicit declaration is what a public container can rely on: an entry
 * that later gains `requiresAuth` for an unrelated reason must not silently
 * fall out of the anonymous tree (`core/src/nav.ts`, `navEntrySurface`).
 *
 * `menuVisibleDefault: false` on both: the results page is a navigation TARGET
 * reached from the header's search box, and the ranking disclosure is a
 * footer link. Neither is a menu item — the same treatment `auth.login` gets.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "search.results",
    labelKey: "search.results.title",
    icon: "SearchOutlined",
    route: { path: "/s" },
    component: { export: "SearchPage", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: false,
    surface: "public",
    order: 10,
  },
  {
    // The P2B Art. 5 disclosure as a PAGE, not a link to raw JSON. The
    // regulation asks for a plain-language description of the main ranking
    // parameters; `GET /search/api/v1/ranking` is the data behind it, and
    // handing a visitor that JSON would satisfy nobody's reading of it. The
    // route is `/ranking-disclosure`, not `/ranking`, so the SPA path cannot
    // be mistaken — by a person or by `stapel/no-string-paths` — for the API
    // operation of the same name.
    id: "search.ranking",
    labelKey: "search.ranking.title",
    icon: "OrderedListOutlined",
    route: { path: "/ranking-disclosure" },
    component: { export: "RankingDisclosurePane", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: false,
    requiresAuth: false,
    surface: "public",
    order: 11,
  },
];
