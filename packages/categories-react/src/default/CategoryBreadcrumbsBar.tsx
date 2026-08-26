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
import type { ReactElement, ReactNode } from "react";
import { Breadcrumb, Skeleton, Typography } from "antd";
import { useT } from "@stapel/core";
import { renderCategoryLabel } from "../catalog/labels.js";
import { CategoryBreadcrumbs } from "../headless/CategoryBreadcrumbs.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import { ErrorAlert, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeModeProp } from "./types.js";

export interface CategoryBreadcrumbsBarProps
  extends ThemeModeProp,
    LinkComponentProp {
  readonly slug?: string;
  readonly categoryId?: number | null;
  /** Path prefix for a crumb's link. Default `/c`. */
  readonly basePath?: string;
  /**
   * What the bar does when the catalogue could not be read, or when the slug
   * resolves to nothing.
   *
   * `"state"` (default): say so — this bar is sometimes mounted alone, in a
   * header, and a silent header is a silent failure. `"quiet"`: render
   * nothing, for a PAGE that states the same fact under it. `<CategoryPage>`
   * passes `"quiet"`, which is why one outage no longer produces a bare red
   * sentence with a blue link on top of a designed error panel, and why an
   * unknown slug is not announced twice.
   */
  readonly onAbsent?: "state" | "quiet";
}

export function CategoryBreadcrumbsBar(
  props: CategoryBreadcrumbsBarProps
): ReactElement {
  const t = useT();
  const base = props.basePath ?? "/c";
  const quiet = props.onAbsent === "quiet";

  /** A crumb's title: `href` on the ITEM would make antd render its own
   * anchor, which is exactly the full page load this seam removes. So the
   * link is the title. */
  const crumbLink = (
    href: string,
    label: ReactNode,
    slug?: string
  ): ReactElement => (
    <CategoryLink
      {...(props.linkComponent !== undefined
        ? { linkComponent: props.linkComponent }
        : {})}
      href={href}
      {...(slug !== undefined ? { slug } : {})}
    >
      {label}
    </CategoryLink>
  );

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryBreadcrumbs
        {...(props.slug !== undefined ? { slug: props.slug } : {})}
        {...(props.categoryId !== undefined
          ? { categoryId: props.categoryId }
          : {})}
      >
        {(bag) => (
          <LoadBoundary
            state={bag.state}
            testId="categories-breadcrumbs"
            onRetry={bag.refetch}
            loading={
              <Skeleton.Input
                active
                size="small"
                data-testid="categories-breadcrumbs-loading"
              />
            }
            failed={(error) =>
              quiet ? null : (
                <ErrorAlert
                  testId="categories-breadcrumbs-failed"
                  variant="inline"
                  thrown={error}
                  message={t(CATEGORIES_I18N_KEYS.catalogLoadFailed)}
                  onRetry={bag.refetch}
                />
              )
            }
          >
            {(crumbs) =>
              bag.unknownSlug ? (
                quiet ? null : (
                  <Typography.Text
                    type="secondary"
                    data-testid="categories-breadcrumbs-unknown"
                  >
                    {t(CATEGORIES_I18N_KEYS.categoryUnknownSlug)}
                  </Typography.Text>
                )
              ) : (
                <Breadcrumb
                  data-testid="categories-breadcrumbs"
                  items={[
                    { title: crumbLink(base, t(CATEGORIES_I18N_KEYS.breadcrumbsRoot)) },
                    ...crumbs.map((crumb) => ({
                      // The CURRENT crumb is where you already are: a label,
                      // never a link — the one item antd would happily render
                      // as a link to the page under your feet.
                      title: crumb.isCurrent
                        ? renderCategoryLabel(crumb.label, t)
                        : crumbLink(
                            `${base}/${crumb.node.category.slug}`,
                            renderCategoryLabel(crumb.label, t),
                            crumb.node.category.slug
                          ),
                    })),
                  ]}
                />
              )
            }
          </LoadBoundary>
        )}
      </CategoryBreadcrumbs>
    </SkinTheme>
  );
}
