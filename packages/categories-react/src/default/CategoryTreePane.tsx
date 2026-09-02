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
 *
 * The rows themselves are `<CategoryLevelList>`, shared with the id path of
 * `<CategoryPage>` — this pane owns the CATALOGUE resolution (a slug has no
 * server-side lookup, so it costs the sync) and the four load sentences
 * around it, not the row markup. See that file's header for why the split
 * exists.
 */
import { spacing } from "@stapel/tokens";
import type { ReactElement } from "react";
import { Alert, Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { CategoryTree } from "../headless/CategoryTree.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryLevelList } from "./CategoryLevelList.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
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
                <CategoryLevelList
                  {...(props.linkComponent !== undefined
                    ? { linkComponent: props.linkComponent }
                    : {})}
                  rows={nodes.map((node) => node.category)}
                  // The built tree already knows every level, so a count
                  // here is never unknown — `0` is a true leaf, not a guess.
                  childCount={(row) =>
                    nodes.find((node) => node.id === row.id)?.children
                      .length ?? 0
                  }
                  basePath={base}
                />
              )}
            </LoadList>
          </Flex>
        )}
      </CategoryTree>
    </SkinTheme>
  );
}
