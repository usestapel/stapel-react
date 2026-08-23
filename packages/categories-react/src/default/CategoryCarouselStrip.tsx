/**
 * `<CategoryCarouselStrip>` — the landing page's row of category tiles.
 *
 * The icon references (`carousel_icon` / `catalog_icon`) are OPAQUE STRINGS
 * that the backend deliberately does not resolve ("Decoupled from stapel-cdn:
 * an opaque string, resolved by the host if at all"). This skin therefore
 * renders no `<img>` and builds no URL: it hands the reference to the host
 * through `renderIcon`, and draws nothing when the host does not supply one. A
 * guessed CDN path would be a broken image on every deployment that guessed
 * differently, and a broken image is worse than no image.
 */
import type { ReactElement, ReactNode } from "react";
import { Card, Empty, Flex, Skeleton, Typography } from "antd";
import { matchList, toFlowError, useDescribeFlowError, useT } from "@stapel/core";
import { renderCategoryLabel } from "../catalog/labels.js";
import { CategoryCarousel } from "../headless/CategoryCarousel.js";
import type { CarouselEntry } from "../headless/CategoryCarousel.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { CategoriesSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface CategoryCarouselStripProps
  extends ThemeModeProp,
    LinkComponentProp {
  readonly basePath?: string;
  /** Turn an opaque icon reference into something renderable. Absent means no
   * icon is drawn — see this file's header. */
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
}

export function CategoryCarouselStrip(
  props: CategoryCarouselStripProps
): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();

  return (
    <CategoriesSkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryCarousel
        {...(props.basePath !== undefined ? { basePath: props.basePath } : {})}
      >
        {(bag) => (
          <Flex vertical gap={8} data-testid="categories-carousel">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t(CATEGORIES_I18N_KEYS.carouselTitle)}
            </Typography.Title>

            {matchList(bag.state, {
              loading: () => (
                <Flex gap={8}>
                  <Skeleton.Button
                    active
                    data-testid="categories-carousel-loading"
                  />
                  <Skeleton.Button active />
                  <Skeleton.Button active />
                </Flex>
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="categories-carousel-failed"
                  error={{
                    ...describe(toFlowError(error)),
                    message: t(CATEGORIES_I18N_KEYS.carouselLoadFailed),
                  }}
                />
              ),
              empty: () => (
                <Empty
                  data-testid="categories-carousel-empty"
                  description={t(CATEGORIES_I18N_KEYS.carouselEmpty)}
                />
              ),
              ready: (entries) => (
                <Flex gap={8} wrap data-testid="categories-carousel-list">
                  {entries.map((entry) => (
                    <Card
                      key={entry.category.id}
                      size="small"
                      hoverable
                      data-category-slug={entry.category.slug}
                    >
                      <CategoryLink
                        {...(props.linkComponent !== undefined
                          ? { linkComponent: props.linkComponent }
                          : {})}
                        href={entry.href}
                      >
                        <Flex align="center" gap={8}>
                          {entry.icon !== null && props.renderIcon !== undefined
                            ? props.renderIcon(entry.icon, entry)
                            : null}
                          <span>{renderCategoryLabel(entry.label, t)}</span>
                        </Flex>
                      </CategoryLink>
                    </Card>
                  ))}
                </Flex>
              ),
            })}
          </Flex>
        )}
      </CategoryCarousel>
    </CategoriesSkinTheme>
  );
}
