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
 */
export { CatalogPage } from "./CatalogPage.js";
export type { CatalogPageProps } from "./CatalogPage.js";
export { CategoryPage } from "./CategoryPage.js";
export type { CategoryPageProps } from "./CategoryPage.js";
export { CategoryTreePane } from "./CategoryTreePane.js";
export type { CategoryTreePaneProps } from "./CategoryTreePane.js";
export { CategoryBreadcrumbsBar } from "./CategoryBreadcrumbsBar.js";
export type { CategoryBreadcrumbsBarProps } from "./CategoryBreadcrumbsBar.js";
export { CategoryCarouselStrip } from "./CategoryCarouselStrip.js";
export type { CategoryCarouselStripProps } from "./CategoryCarouselStrip.js";
export { CategoryPickerField } from "./CategoryPickerField.js";
export type { CategoryPickerFieldProps } from "./CategoryPickerField.js";
export { CategoryFeatureList } from "./CategoryFeatureList.js";
export type { CategoryFeatureListProps } from "./CategoryFeatureList.js";
export { CategoriesSkinTheme } from "./theme.js";
export type { CategoriesSkinThemeProps } from "./theme.js";
export { ErrorAlert } from "./ErrorAlert.js";
export { CategoryLink } from "./CategoryLink.js";
export type { CategoryLinkProps, LinkComponentProp } from "./CategoryLink.js";
export type { ThemeModeProp } from "./types.js";
