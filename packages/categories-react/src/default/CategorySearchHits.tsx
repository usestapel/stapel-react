/**
 * `<CategorySearchHits>` — the categories a search query reached, as links.
 *
 * Deliberately the plainest surface in this pair: a heading and a list of
 * links. It is NOT a picker and NOT a typeahead dropdown — the catalogue has
 * thousands of rows and the navigation model rules both of those out
 * (`catalog/tiles.ts`). What it closes is narrower and was genuinely missing:
 * a person types a category's name into the search field and, until now, could
 * only ever land in results.
 *
 * Two mounts the storefront makes, from the same hook:
 *
 *  - above the search results, as "did you mean this category";
 *  - on the catalogue page, as an inline filter over the visible tiles.
 *
 * WITH NO HITS IT RENDERS NOTHING — not an empty state. An empty state here
 * would be a second, louder "no results" beside the one the search itself
 * already shows, on a surface that is only ever a hint. The hits are handed in
 * rather than fetched (`useCategorySearch` is the headless half), so the same
 * list can sit in two places on one screen without two reads of the catalogue.
 */
import { spacing } from "@stapel/tokens";
import type { ReactElement } from "react";
import { List, Typography } from "antd";
import { useT } from "@stapel/core";
import { renderCategoryLabel } from "../catalog/labels.js";
import type { CategorySearchHit } from "../catalog/search.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import { PHONE_CONTROL_HEIGHT, SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeModeProp } from "./types.js";

export interface CategorySearchHitsProps
  extends ThemeModeProp,
    LinkComponentProp {
  /** What the person typed — printed in the heading so the list says WHY
   * these categories are here, not merely that they are. */
  readonly query: string;
  /** The ranked hits, from `useCategorySearch`. Empty renders nothing. */
  readonly hits: readonly CategorySearchHit[];
}

export function CategorySearchHits(
  props: CategorySearchHitsProps
): ReactElement | null {
  const t = useT();
  if (props.hits.length === 0) return null;

  const heading = t(CATEGORIES_I18N_KEYS.searchHitsTitle, {
    query: props.query,
  });

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <nav aria-label={heading} data-testid="categories-search-hits">
        <Typography.Title
          level={5}
          style={{ margin: 0, marginBottom: spacing[2] }}
        >
          {heading}
        </Typography.Title>
        <List<CategorySearchHit>
          size="small"
          data-testid="categories-search-hits-list"
          dataSource={[...props.hits]}
          renderItem={(hit) => (
            <List.Item
              key={hit.node.id}
              data-category-id={hit.node.id}
              data-category-match={hit.match}
              style={{ paddingInline: 0 }}
            >
              {/* The whole row is the target, on the touch floor — the same
                  shape `<CategoryTreePane>` uses, so a category link behaves
                  identically wherever it appears. */}
              <CategoryLink
                {...(props.linkComponent !== undefined
                  ? { linkComponent: props.linkComponent }
                  : {})}
                href={hit.href}
                slug={hit.node.category.slug}
                categoryId={hit.node.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  minHeight: PHONE_CONTROL_HEIGHT,
                  paddingInline: spacing[2],
                }}
              >
                {renderCategoryLabel(hit.label, t)}
              </CategoryLink>
            </List.Item>
          )}
        />
      </nav>
    </SkinTheme>
  );
}
