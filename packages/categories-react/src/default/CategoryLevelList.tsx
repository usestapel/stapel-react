/**
 * One LEVEL of the catalogue as the pane's rows — the presentational half of
 * "Subcategories", shared so the two surfaces that draw it cannot drift apart.
 *
 * Two arms render exactly this list: `<CategoryTreePane>`, whose rows come out
 * of the synced catalogue, and `<CategoryPage>`'s id path, whose rows are the
 * `GET {id}/children/` answer the page already holds. While the markup lived
 * only inside the pane, the second surface had no way to draw it without
 * mounting the first — and the pane resolves a slug through the FULL catalogue
 * sync, which is how a live classified deployment's category landing held its
 * "Subcategories" widget behind 13.2 seconds of skeletons for a level the id
 * path answers in a fraction of one. Extracting the rows is what makes "same
 * list, different source" a property of the code rather than a screenshot
 * comparison.
 *
 * NOT exported from `/default`: a host composes `<CategoryTreePane>` or
 * `<CategoryPage>`, and a public bare list would be a third way to draw the
 * same rows — the exact drift this file exists to prevent.
 *
 * `childCount` is nullable ON PURPOSE. `null` is "not known (yet, or at
 * all)", and it draws NOTHING — no Tag, no chevron, no skeleton, and no zero
 * standing in for an unknown. The count is a decoration on a link that
 * already works; gating the row on it would rebuild the very wait the id path
 * removes, and guessing `0` would tell a person a branch is a leaf.
 */
import { spacing } from "@stapel/tokens";
import type { ReactElement } from "react";
import { Flex, List, Tag } from "antd";
import { useT, useTPlural } from "@stapel/core";
import { PHONE_CONTROL_HEIGHT } from "@stapel/tokens-antd/skin";
import type { Category } from "../api/types.js";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";

export interface CategoryLevelListProps extends LinkComponentProp {
  readonly rows: readonly Category[];
  /** How many browsable children sit under a row — the "N subcategories" Tag
   * and the chevron. `null` = unknown: the row draws neither, quietly. */
  readonly childCount: (row: Category) => number | null;
  /** Path prefix for a row's link. */
  readonly basePath: string;
}

export function CategoryLevelList(
  props: CategoryLevelListProps
): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  return (
    <List<Category>
      data-testid="categories-tree-list"
      size="small"
      dataSource={[...props.rows]}
      renderItem={(row) => {
        const count = props.childCount(row);
        return (
          <List.Item
            key={row.id}
            data-category-id={row.id}
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
              href={`${props.basePath}/${row.slug}`}
              slug={row.slug}
              categoryId={row.id}
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
              <span>{renderCategoryLabel(categoryLabel(row), t)}</span>
              <Flex align="center" gap={spacing[2]}>
                {count !== null && count > 0 ? (
                  // The count SAYS what it counts. It used to be a
                  // bare number with a `title=` — meaning available
                  // to a mouse pointer and to nothing else.
                  <Tag variant="filled" data-category-children={count}>
                    {tPlural(
                      CATEGORIES_I18N_KEYS.categorySubcategoriesCount,
                      { count }
                    )}
                  </Tag>
                ) : null}
                <span aria-hidden="true">
                  {count !== null && count > 0 ? "\u203a" : ""}
                </span>
              </Flex>
            </CategoryLink>
          </List.Item>
        );
      }}
    />
  );
}
