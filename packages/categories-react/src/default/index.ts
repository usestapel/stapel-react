/**
 * `@stapel/categories-react/default` — the antd skin over the headless pair.
 *
 * A separate entry point (the convention every pair's `/default` follows) so a
 * host rendering its own catalogue chrome never pulls `antd` into its bundle.
 * The main entry has no visual opinion at all and no import path from it
 * reaches this directory — size-limit and the bundle-purity test are the
 * teeth on that.
 *
 * ```tsx
 * import { createCategoriesRuntime, CategoriesProvider } from "@stapel/categories-react";
 * import { CatalogPage, CategoryPage } from "@stapel/categories-react/default";
 * ```
 *
 * `CategoryPage` takes `renderListings` — the half of `/c/:slug` that belongs
 * to `@stapel/search-react`, handed in by the container rather than imported
 * across the L2 layer.
 *
 * The pair no longer exports a `CategoriesSkinTheme` or its own `ErrorAlert`:
 * every surface here wraps itself in `SkinTheme` from
 * `@stapel/tokens-antd/skin`, which is where the light/dark decision, the
 * painted surface, the 44px phone control height and the one error surface now
 * live for the whole fleet. A host that wrapped a composition of these parts
 * imports `SkinTheme` from there instead.
 */
export { CatalogPage } from "./CatalogPage.js";
export type { CatalogPageProps } from "./CatalogPage.js";
export { CategoryPage } from "./CategoryPage.js";
export type {
  CategoryHeading,
  CategoryHeadingContext,
  CategoryPageProps,
  SubcategoryForm,
} from "./CategoryPage.js";
export { CategoryTreePane } from "./CategoryTreePane.js";
export type { CategoryTreePaneProps } from "./CategoryTreePane.js";
export { CategoryBreadcrumbsBar } from "./CategoryBreadcrumbsBar.js";
export type { CategoryBreadcrumbsBarProps } from "./CategoryBreadcrumbsBar.js";
export { CategoryCarouselStrip } from "./CategoryCarouselStrip.js";
export type { CategoryCarouselStripProps } from "./CategoryCarouselStrip.js";
export { CategoryMegaMenu } from "./CategoryMegaMenu.js";
export type { CategoryMegaMenuProps } from "./CategoryMegaMenu.js";
export { CategoryTileGrid } from "./CategoryTileGrid.js";
export type {
  CategoryIconResolver,
  CategoryTileGridProps,
  TileDensity,
  TileLayout,
} from "./CategoryTileGrid.js";
/** Re-exported here because `<CategoryTileGrid>`'s `entries` and `renderIcon`
 * both make it part of a skin caller's vocabulary — a host composing tiles
 * should not have to reach into the headless entry for the row type it is
 * handed and asked to hand back. Same type, one door closer. */
export type { CarouselEntry } from "../headless/CategoryCarousel.js";
export { CategorySearchHits } from "./CategorySearchHits.js";
export type { CategorySearchHitsProps } from "./CategorySearchHits.js";
/** Re-exported for the same reason as `CarouselEntry`: a host that mounts
 * `<CategorySearchHits>` is handed these rows by `useCategorySearch` and has
 * to name their type. Same type, one door closer. */
export type { CategorySearchHit } from "../catalog/search.js";
export { CategoryQuickSearchPanel } from "./CategoryQuickSearchPanel.js";
export type {
  CategoryQuickSearchPanelProps,
  QuickSearchCount,
  QuickSearchCountKind,
} from "./CategoryQuickSearchPanel.js";
export { CategoryPickerField } from "./CategoryPickerField.js";
export type { CategoryPickerFieldProps } from "./CategoryPickerField.js";
export { CategoryCascadeField } from "./CategoryCascadeField.js";
export type { CategoryCascadeFieldProps } from "./CategoryCascadeField.js";
export { CategoryFeatureList } from "./CategoryFeatureList.js";
export type { CategoryFeatureListProps } from "./CategoryFeatureList.js";
export { CategoryLink } from "./CategoryLink.js";
export type { CategoryLinkProps, LinkComponentProp } from "./CategoryLink.js";
export type { ThemeModeProp } from "./types.js";
