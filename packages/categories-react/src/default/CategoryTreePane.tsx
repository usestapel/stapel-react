/**
 * `<CategoryTreePane>` — one level of the catalogue as a list of links.
 *
 * The four arms of `matchList` are the point of this file, not decoration:
 * "still syncing", "the sync failed", "this category has no sub-categories"
 * and "here they are" are four different sentences, and the third is the one a
 * leaf category legitimately gets. Collapsing any two is the incident
 * `@stapel/core`'s `loadState.ts` was written for.
 *
 * A fifth condition rides alongside them: `truncated`. The sync walk hit its
 * page budget, so what is on screen is a PARTIAL catalogue — which is neither
 * an empty one nor a failed one, and gets its own line rather than being
 * silently indistinguishable from a complete tree.
 */
import type { ReactElement } from "react";
import { Alert, Badge, Empty, Flex, List, Spin, Typography } from "antd";
import { matchList, toFlowError, useDescribeFlowError, useT } from "@stapel/core";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import type { CategoryNode } from "../catalog/tree.js";
import { CategoryTree } from "../headless/CategoryTree.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { CategoriesSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface CategoryTreePaneProps extends ThemeModeProp {
  /** Render this category's children. Omitted renders the roots. */
  readonly parentId?: number | null;
  /** Render the children of the category at this slug (the `/c/:slug` page). */
  readonly slug?: string;
  /** Path prefix for a row's link. Default `/c`. */
  readonly basePath?: string;
  /** Heading above the list. Omitted renders no heading. */
  readonly titleKey?: string;
}

export function CategoryTreePane(props: CategoryTreePaneProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const base = props.basePath ?? "/c";

  return (
    <CategoriesSkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryTree
        {...(props.parentId !== undefined ? { parentId: props.parentId } : {})}
        {...(props.slug !== undefined ? { slug: props.slug } : {})}
      >
        {(bag) => (
          <Flex vertical gap={8} data-testid="categories-tree">
            {props.titleKey !== undefined ? (
              <Typography.Title level={5} style={{ margin: 0 }}>
                {t(props.titleKey)}
              </Typography.Title>
            ) : null}

            {bag.truncated ? (
              <Alert
                type="warning"
                showIcon
                data-testid="categories-tree-truncated"
                message={t(CATEGORIES_I18N_KEYS.catalogTruncated)}
              />
            ) : null}

            {matchList(bag.state, {
              loading: () => (
                <Flex justify="center" style={{ padding: 16 }}>
                  <Spin data-testid="categories-tree-loading" />
                </Flex>
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="categories-tree-failed"
                  error={{
                    ...describe(toFlowError(error)),
                    message: t(CATEGORIES_I18N_KEYS.catalogLoadFailed),
                  }}
                />
              ),
              empty: () => (
                <Empty
                  data-testid="categories-tree-empty"
                  description={t(
                    bag.current === null
                      ? CATEGORIES_I18N_KEYS.catalogEmpty
                      : CATEGORIES_I18N_KEYS.categoryNoSubcategories
                  )}
                />
              ),
              ready: (nodes) => (
                <List<CategoryNode>
                  data-testid="categories-tree-list"
                  size="small"
                  dataSource={[...nodes]}
                  renderItem={(node) => (
                    <List.Item key={node.id} data-category-id={node.id}>
                      <Flex
                        justify="space-between"
                        align="center"
                        gap={8}
                        style={{ width: "100%" }}
                      >
                        <Typography.Link
                          href={`${base}/${node.category.slug}`}
                          data-category-slug={node.category.slug}
                        >
                          {renderCategoryLabel(
                            categoryLabel(node.category),
                            t
                          )}
                        </Typography.Link>
                        {node.children.length > 0 ? (
                          <Badge
                            count={node.children.length}
                            color="blue"
                            title={t(
                              CATEGORIES_I18N_KEYS.categorySubcategories
                            )}
                          />
                        ) : null}
                      </Flex>
                    </List.Item>
                  )}
                />
              ),
            })}
          </Flex>
        )}
      </CategoryTree>
    </CategoriesSkinTheme>
  );
}
