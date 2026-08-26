/**
 * `<CategoryTreePane>` — one level of the catalogue as a list of links.
 *
 * The four arms of `LoadList` are the point of this file, not decoration:
 * "still syncing", "the sync failed", "this category has no sub-categories"
 * and "here they are" are four different sentences, and the third is the one a
 * leaf category legitimately gets. Collapsing any two is the incident
 * `@stapel/core`'s `loadState.ts` was written for; the substrate renders the
 * first three so every pair's version of them is the same shape.
 *
 * A fifth condition rides alongside them: `truncated`. The sync walk hit its
 * page budget, so what is on screen is a PARTIAL catalogue — which is neither
 * an empty one nor a failed one, and gets its own line rather than being
 * silently indistinguishable from a complete tree.
 */
import { spacing } from "@stapel/tokens";
import type { ReactElement } from "react";
import { Alert, Flex, List, Tag, Typography } from "antd";
import { useT, useTPlural } from "@stapel/core";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import type { CategoryNode } from "../catalog/tree.js";
import { CategoryTree } from "../headless/CategoryTree.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  PHONE_CONTROL_HEIGHT,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeModeProp } from "./types.js";

export interface CategoryTreePaneProps extends ThemeModeProp, LinkComponentProp {
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
  const tPlural = useTPlural();
  const base = props.basePath ?? "/c";

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryTree
        {...(props.parentId !== undefined ? { parentId: props.parentId } : {})}
        {...(props.slug !== undefined ? { slug: props.slug } : {})}
      >
        {(bag) => (
          <Flex vertical gap={spacing[2]} data-testid="categories-tree">
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
                title={t(CATEGORIES_I18N_KEYS.catalogTruncated)}
              />
            ) : null}

            <LoadList
              state={bag.state}
              testId="categories-tree"
              onRetry={bag.refetch}
              failed={(error) => (
                <ErrorAlert
                  testId="categories-tree-failed"
                  thrown={error}
                  message={t(CATEGORIES_I18N_KEYS.catalogLoadFailed)}
                  onRetry={bag.refetch}
                />
              )}
              empty={
                <EmptyState
                  testId="categories-tree-empty"
                  compact
                  title={t(
                    bag.current === null
                      ? CATEGORIES_I18N_KEYS.catalogEmpty
                      : CATEGORIES_I18N_KEYS.categoryNoSubcategories
                  )}
                />
              }
            >
              {(nodes) => (
                <List<CategoryNode>
                  data-testid="categories-tree-list"
                  size="small"
                  dataSource={[...nodes]}
                  renderItem={(node) => (
                    <List.Item
                      key={node.id}
                      data-category-id={node.id}
                      style={{ paddingInline: 0 }}
                    >
                      {/* The whole ROW is the link, on the touch floor, with
                          a chevron for a branch: a 24px word inside a 41px
                          row is a target a thumb misses and an affordance an
                          eye cannot see. */}
                      <CategoryLink
                        {...(props.linkComponent !== undefined
                          ? { linkComponent: props.linkComponent }
                          : {})}
                        href={`${base}/${node.category.slug}`}
                        slug={node.category.slug}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: spacing[2],
                          width: "100%",
                          minHeight: PHONE_CONTROL_HEIGHT,
                          paddingInline: spacing[2],
                        }}
                      >
                        <span>
                          {renderCategoryLabel(categoryLabel(node.category), t)}
                        </span>
                        <Flex align="center" gap={spacing[2]}>
                          {node.children.length > 0 ? (
                            // The count SAYS what it counts. It used to be a
                            // bare number with a `title=` — meaning available
                            // to a mouse pointer and to nothing else.
                            <Tag
                              variant="filled"
                              data-category-children={node.children.length}
                            >
                              {tPlural(
                                CATEGORIES_I18N_KEYS.categorySubcategoriesCount,
                                { count: node.children.length }
                              )}
                            </Tag>
                          ) : null}
                          <span aria-hidden="true">
                            {node.children.length > 0 ? "\u203a" : ""}
                          </span>
                        </Flex>
                      </CategoryLink>
                    </List.Item>
                  )}
                />
              )}
            </LoadList>
          </Flex>
        )}
      </CategoryTree>
    </SkinTheme>
  );
}
