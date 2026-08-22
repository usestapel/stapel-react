/**
 * `@stapel/search-react/default` — the antd default skin.
 *
 * A SEPARATE entry point on purpose: the main entry is headless and carries
 * no antd, so a storefront that renders its own cards over `<SearchResults>`
 * never pays for this bundle (enforced by size-limit and the bundle-purity
 * test).
 *
 * Three override levers, none of which requires forking anything:
 *
 *  1. **`renderCard`** — the card slot. A storefront passes
 *     `<ListingCard>` from `@stapel/listings-react/default`; the generic card
 *     here is the documented default, not the intended end state (spec §3.7).
 *  2. **`categoryFeatures`** — the facet-label slot. The server sends
 *     `{value: count}` and no labels; the schema that names them lives in
 *     categories, and the container hands it in (spec §6.2 item 2).
 *  3. **retheming through the §68 token JSON** — every surface wraps itself
 *     in `<SearchSkinTheme>`, so a host's regenerated `--stapel-*` custom
 *     properties reach this skin with zero code.
 */

// ── surfaces ────────────────────────────────────────────────────────────────
export { SearchPage } from "./SearchPage.js";
export type { SearchPageProps } from "./SearchPage.js";

export { SearchResultsPane } from "./SearchResultsPane.js";
export type { SearchResultsPaneProps } from "./SearchResultsPane.js";

export { FacetPanelPane } from "./FacetPanelPane.js";
export type { FacetPanelPaneProps } from "./FacetPanelPane.js";

export { RankingDisclosurePane } from "./RankingDisclosurePane.js";
export type { RankingDisclosurePaneProps } from "./RankingDisclosurePane.js";

// ── parts, exported so a host can compose or wrap one ───────────────────────
export { SearchResultCard, GENERIC_CARD_FIELDS } from "./SearchResultCard.js";
export type { SearchCardProps, SearchCardRenderer } from "./SearchResultCard.js";
export { DegradationNotice } from "./DegradationNotice.js";
export type { DegradationNoticeProps } from "./DegradationNotice.js";
export { UrlIssueNotice } from "./UrlIssueNotice.js";
export { SortSelect } from "./SortSelect.js";
export type { SortSelectProps } from "./SortSelect.js";
export { ErrorAlert } from "./ErrorAlert.js";

// ── theming ─────────────────────────────────────────────────────────────────
export { SearchSkinTheme } from "./theme.js";
export type { SearchSkinThemeProps } from "./theme.js";
export type { ThemeModeProp } from "./types.js";
