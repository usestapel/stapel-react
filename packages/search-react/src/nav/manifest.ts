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
 *
 * ── A nav label is not a page heading ─────────────────────────────────────
 *
 * Both entries carry their OWN label keys (`search.nav.*`) rather than
 * borrowing the surfaces' captions. `search.results.title` is the heading over
 * a list of matches, so it reads "Results" — correct above rows, and useless
 * in a menu, where "Results" answers nothing about where the link goes. The
 * destination is the search. `search.ranking.title` is worse in the other
 * direction: it is a whole sentence ("How these results are ordered"), which
 * is right on the page it captions and cannot be a menu row.
 *
 * Sharing one key would also make the two uses move together forever: a
 * translator improving the heading would silently rewrite the menu, and there
 * is no locale in which the best heading and the best menu label are reliably
 * the same words.
 *
 * `shortLabelKey` on the disclosure for the same reason one step smaller: a
 * five-cell phone dock gives a destination roughly ten characters, and
 * "Ranking disclosure" ellipsizes there to a fragment a person has to guess
 * at. `search.results` declares none — its label is already one word in every
 * locale this pair ships.
 */
import type { NavEntry } from "@stapel/core";

export const navEntries: readonly NavEntry[] = [
  {
    id: "search.results",
    labelKey: "search.nav.results",
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
    labelKey: "search.nav.ranking",
    shortLabelKey: "search.nav.ranking.short",
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
