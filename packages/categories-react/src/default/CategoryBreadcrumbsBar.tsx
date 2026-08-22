/**
 * `<CategoryBreadcrumbsBar>` — root → current, as antd breadcrumbs.
 *
 * Every caption goes through `renderCategoryLabel`, which is the one place
 * this skin decides between "translate this" and "print this": a category's
 * `name` is a translation KEY unless the row says `translatable: false`
 * (`catalog/labels.ts`). A skin that called `t()` unconditionally would print
 * the stored string for an untranslatable category twice-wrapped, and one that
 * never called it would show `category.electronics` at a visitor.
 */
import type { ReactElement } from "react";
import { Breadcrumb, Skeleton, Typography } from "antd";
import { matchLoad, toFlowError, useDescribeFlowError, useT } from "@stapel/core";
import { renderCategoryLabel } from "../catalog/labels.js";
import { CategoryBreadcrumbs } from "../headless/CategoryBreadcrumbs.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { CategoriesSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface CategoryBreadcrumbsBarProps extends ThemeModeProp {
  readonly slug?: string;
  readonly categoryId?: number | null;
  /** Path prefix for a crumb's link. Default `/c`. */
  readonly basePath?: string;
}

export function CategoryBreadcrumbsBar(
  props: CategoryBreadcrumbsBarProps
): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const base = props.basePath ?? "/c";

  return (
    <CategoriesSkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryBreadcrumbs
        {...(props.slug !== undefined ? { slug: props.slug } : {})}
        {...(props.categoryId !== undefined
          ? { categoryId: props.categoryId }
          : {})}
      >
        {(bag) =>
          matchLoad(bag.state, {
            loading: () => (
              <Skeleton.Input
                active
                size="small"
                data-testid="categories-breadcrumbs-loading"
              />
            ),
            failed: (error) => (
              <ErrorAlert
                testId="categories-breadcrumbs-failed"
                error={{
                  ...describe(toFlowError(error)),
                  message: t(CATEGORIES_I18N_KEYS.catalogLoadFailed),
                }}
              />
            ),
            ready: (crumbs) =>
              bag.unknownSlug ? (
                <Typography.Text
                  type="secondary"
                  data-testid="categories-breadcrumbs-unknown"
                >
                  {t(CATEGORIES_I18N_KEYS.categoryUnknownSlug)}
                </Typography.Text>
              ) : (
                <Breadcrumb
                  data-testid="categories-breadcrumbs"
                  items={[
                    {
                      title: t(CATEGORIES_I18N_KEYS.breadcrumbsRoot),
                      href: base,
                    },
                    ...crumbs.map((crumb) => ({
                      title: renderCategoryLabel(crumb.label, t),
                      ...(crumb.isCurrent
                        ? {}
                        : { href: `${base}/${crumb.node.category.slug}` }),
                    })),
                  ]}
                />
              ),
          })
        }
      </CategoryBreadcrumbs>
    </CategoriesSkinTheme>
  );
}
