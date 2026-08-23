/**
 * `<CategoryPage>` — the `/c/:slug` screen: breadcrumbs, sub-categories, and a
 * SLOT where the listings go.
 *
 * The slot is the whole design. Spec §5.1 makes this route "categories +
 * search": the sub-category menu comes from here, the results with facets come
 * from `@stapel/search-react`. A pair may not import another L2 pair
 * (dependency direction is strictly downward), and a screen that rendered only
 * half of itself would be useless — so the half this pair does not own is a
 * render prop, handed the resolved category. The container writes one line:
 *
 * ```tsx
 * <CategoryPage
 *   slug={slug}
 *   renderListings={(category) => (
 *     <SearchPage adapter={useRouterSearchParams()} defaultType="listing"
 *                 fixedCategory={category.id} />
 *   )}
 * />
 * ```
 *
 * `slug` resolution happens against the synced tree because the SERVER cannot
 * do it (`nav/manifest.ts`, `catalog/tree.ts`). Until the catalogue has
 * loaded, an unknown slug is not yet unknown — the "no category here" line is
 * shown only once the sync succeeded, so a slow network never renders a 404
 * for a page that exists.
 */
import type { ReactElement, ReactNode } from "react";
import { Empty, Flex, Spin, Typography } from "antd";
import { toFlowError, useDescribeFlowError, useT } from "@stapel/core";
import type { Category } from "../api/types.js";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import { CategoryTree } from "../headless/CategoryTree.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryBreadcrumbsBar } from "./CategoryBreadcrumbsBar.js";
import { CategoryFeatureList } from "./CategoryFeatureList.js";
import { CategoryTreePane } from "./CategoryTreePane.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { CategoriesSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface CategoryPageProps extends ThemeModeProp, LinkComponentProp {
  /** The `:slug` segment of `/c/:slug`. */
  readonly slug: string;
  readonly basePath?: string;
  /** The listings half of the screen — supplied by the container, because it
   * belongs to another pair. */
  readonly renderListings?: (category: Category) => ReactNode;
  /** Show the category's feature schema. Off by default: on a storefront the
   * schema is the facet panel's input, not a visitor-facing table. */
  readonly showFeatures?: boolean;
}

export function CategoryPage(props: CategoryPageProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const base = props.basePath ?? "/c";
  const link =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};

  return (
    <CategoriesSkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryTree slug={props.slug}>
        {(bag) => (
          <Flex vertical gap={16} data-testid="categories-category-page">
            <CategoryBreadcrumbsBar slug={props.slug} basePath={base} {...link} />

            {bag.catalog.status === "loading" ? (
              <Flex justify="center" style={{ padding: 16 }}>
                <Spin data-testid="categories-category-loading" />
              </Flex>
            ) : bag.catalog.status === "failed" ? (
              <ErrorAlert
                testId="categories-category-failed"
                error={{
                  ...describe(toFlowError(bag.catalog.error)),
                  message: t(CATEGORIES_I18N_KEYS.catalogLoadFailed),
                }}
              />
            ) : bag.current === null ? (
              <Empty
                data-testid="categories-category-unknown"
                description={t(CATEGORIES_I18N_KEYS.categoryUnknownSlug)}
              />
            ) : (
              <>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {renderCategoryLabel(
                    categoryLabel(bag.current.category),
                    t
                  )}
                </Typography.Title>

                {bag.current.children.length > 0 ? (
                  <CategoryTreePane
                    slug={props.slug}
                    basePath={base}
                    titleKey={CATEGORIES_I18N_KEYS.categorySubcategories}
                    {...link}
                  />
                ) : null}

                {props.showFeatures === true ? (
                  <CategoryFeatureList categoryId={bag.current.id} />
                ) : null}

                {props.renderListings?.(bag.current.category)}
              </>
            )}
          </Flex>
        )}
      </CategoryTree>
    </CategoriesSkinTheme>
  );
}
