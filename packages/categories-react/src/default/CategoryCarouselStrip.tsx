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
import { cssVar, radii, spacing } from "@stapel/tokens-antd";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Card, Flex, Skeleton, Typography } from "antd";
import { useT } from "@stapel/core";
import { renderCategoryLabel } from "../catalog/labels.js";
import { CategoryCarousel } from "../headless/CategoryCarousel.js";
import type { CarouselEntry } from "../headless/CategoryCarousel.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import {
  CATEGORY_TILE_CLASS,
  CATEGORY_TILE_FLAT_CLASS,
  CATEGORY_TILE_STYLE_HREF,
  categoryTileCss,
} from "./CategoryTileGrid.js";
import type { TileSurface } from "./CategoryTileGrid.js";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeModeProp } from "./types.js";

export interface CategoryCarouselStripProps
  extends ThemeModeProp,
    LinkComponentProp {
  readonly basePath?: string;
  /** Turn an opaque icon reference into something renderable. Absent means no
   * icon is drawn — see this file's header. */
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
  /**
   * Whether this strip and its tiles draw a SURFACE of their own. Default
   * `"flat"` — the same word, the same default and the same rule
   * `<CategoryTileGrid tileSurface>` takes, because a landing that draws both
   * must not be flat in one row and panelled in the next.
   *
   *  - `"flat"` — no fill and no border, on the strip's own wrapper AND on
   *    every tile in it: the row sits on the page, and a tile takes the
   *    token fill only under the pointer or a keyboard focus, from the one
   *    rule set `<CategoryTileGrid>` publishes (`categoryTileCss`). Two
   *    components, one hover, no second definition to drift;
   *  - `"card"` — today's strip: an antd `Card` per entry inside a raised
   *    wrapper.
   *
   * The flat default is the owner's ruling for every tile in the catalogue
   * (0.27.0) and its container (0.29.0): the fills carry no information and a
   * row of them outweighs the art inside them.
   */
  readonly tileSurface?: TileSurface;
}

/**
 * The flat tile's own box — what the `Card` was giving it, minus the fill and
 * the border.
 *
 * `inline-flex` and the padding keep the row's rhythm and the pointer target
 * the card had, and the radius is the one `categoryTileCss`'s hover fill is
 * drawn at, so the highlight is the shape the tile already occupies.
 */
const FLAT_TILE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[2],
  paddingBlock: spacing[2],
  paddingInline: spacing[3],
  borderRadius: radii.lg,
  color: cssVar("text"),
};

export function CategoryCarouselStrip(
  props: CategoryCarouselStripProps
): ReactElement {
  const t = useT();
  const surface: TileSurface = props.tileSurface ?? "flat";
  const flat = surface === "flat";

  return (
    /* THE STRIP TAKES THE SAME SURFACE AS ITS TILES — and, flat, paints
     * nothing at all. `SkinTheme` defaults to `surface="raised"`, which puts
     * `colorBgContainer` behind the whole row: a panel under a row of tiles
     * that have just stopped being panels themselves. `bare` paints NOTHING,
     * including the text colour `raised` would have written, so the flat arm
     * states it from the token — `--stapel-text` resolves per theme at paint
     * time where `SkinTheme` freezes whichever side mounted first. Same gate,
     * same reasoning and the same two lines as `<CategoryTileGrid>`. */
    <SkinTheme
      surface={flat ? "bare" : "raised"}
      {...(flat ? { style: { color: cssVar("text") } } : {})}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      {/* The tiles' hover and focus fill — `<CategoryTileGrid>`'s own rule set,
          not a second copy of it. Hoisted and deduped by the same `href`, so a
          landing drawing both a strip and a grid ships it once. */}
      {flat && (
        <style href={CATEGORY_TILE_STYLE_HREF} precedence="default">
          {categoryTileCss()}
        </style>
      )}
      <CategoryCarousel
        {...(props.basePath !== undefined ? { basePath: props.basePath } : {})}
      >
        {(bag) => (
          <Flex vertical gap={spacing[2]} data-testid="categories-carousel">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t(CATEGORIES_I18N_KEYS.carouselTitle)}
            </Typography.Title>

            <LoadList
              state={bag.state}
              testId="categories-carousel"
              onRetry={bag.refetch}
              loading={
                <Flex gap={spacing[2]}>
                  <Skeleton.Button
                    active
                    data-testid="categories-carousel-loading"
                  />
                  <Skeleton.Button active />
                  <Skeleton.Button active />
                </Flex>
              }
              failed={(error) => (
                <ErrorAlert
                  testId="categories-carousel-failed"
                  thrown={error}
                  message={t(CATEGORIES_I18N_KEYS.carouselLoadFailed)}
                  onRetry={bag.refetch}
                />
              )}
              empty={
                <EmptyState
                  testId="categories-carousel-empty"
                  compact
                  title={t(CATEGORIES_I18N_KEYS.carouselEmpty)}
                />
              }
            >
              {(entries) => (
                <Flex gap={spacing[2]} wrap data-testid="categories-carousel-list">
                  {entries.map((entry) => {
                    const link = (
                      <CategoryLink
                        key={entry.category.id}
                        {...(props.linkComponent !== undefined
                          ? { linkComponent: props.linkComponent }
                          : {})}
                        href={entry.href}
                        slug={entry.category.slug}
                        categoryId={entry.category.id}
                        /* Flat, the LINK is the tile: it carries the box the
                           card was giving it and the class the shared hover
                           rule is hung on, so the whole tile is the target
                           rather than a word inside a panel. */
                        {...(flat
                          ? {
                              className: `${CATEGORY_TILE_CLASS} ${CATEGORY_TILE_FLAT_CLASS}`,
                              style: FLAT_TILE,
                            }
                          : {})}
                      >
                        <Flex align="center" gap={spacing[2]}>
                          {entry.icon !== null && props.renderIcon !== undefined
                            ? props.renderIcon(entry.icon, entry)
                            : null}
                          <span>{renderCategoryLabel(entry.label, t)}</span>
                        </Flex>
                      </CategoryLink>
                    );
                    return flat ? (
                      link
                    ) : (
                      <Card
                        key={entry.category.id}
                        size="small"
                        hoverable
                        data-category-slug={entry.category.slug}
                      >
                        {link}
                      </Card>
                    );
                  })}
                </Flex>
              )}
            </LoadList>
          </Flex>
        )}
      </CategoryCarousel>
    </SkinTheme>
  );
}
