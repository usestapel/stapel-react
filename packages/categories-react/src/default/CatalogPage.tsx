/**
 * `<CatalogPage>` — the catalogue root at `/c`: the carousel over the top-level
 * tree.
 *
 * This is a single-pair screen, which is exactly why it has a nav entry while
 * `/` does not. The storefront's landing composes THIS pair's carousel with
 * search's newest-listings feed (spec §5.1), and a composed route belongs to
 * the container that composes it — see `nav/manifest.ts`.
 *
 * Everything a host can decide about the chrome below it passes THROUGH this
 * screen, because the nav manifest mounts this component and nothing else: a
 * prop the parts take and this page does not forward is a capability the `/c`
 * route can never have. Two of them, both wired here:
 *
 *  - `linkComponent` — the host router's `<Link>`, so a category click is an
 *    SPA navigation instead of a full page load (`CategoryLink.tsx`);
 *  - `renderIcon` — the resolver for the carousel's OPAQUE icon references.
 *    Without it the landing hero is a row of text tiles by construction, and
 *    that is not a decision this page is allowed to take for the host.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { EmptyState, ErrorAlert, LoadList, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { CarouselEntry } from "../headless/CategoryCarousel.js";
import { CategoryTree } from "../headless/CategoryTree.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import { CategoryCarouselStrip } from "./CategoryCarouselStrip.js";
import { CategoryTreePane } from "./CategoryTreePane.js";
import { CATEGORY_MEASURE } from "./CategoryPage.js";
import type { ThemeModeProp } from "./types.js";

export interface CatalogPageProps extends ThemeModeProp, LinkComponentProp {
  readonly basePath?: string;
  /**
   * Turn a carousel tile's opaque icon reference into something renderable —
   * forwarded verbatim to {@link CategoryCarouselStrip}. Absent means the
   * tiles are text only, which is a legitimate configuration and not a
   * default this screen may impose by dropping the prop.
   */
  readonly renderIcon?: (reference: string, entry: CarouselEntry) => ReactNode;
}

export function CatalogPage(props: CatalogPageProps): ReactElement {
  const t = useT();
  const base = props.basePath ?? "/c";
  // Spread once: every link on this screen belongs to the same host router.
  const link =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};
  const icon =
    props.renderIcon !== undefined ? { renderIcon: props.renderIcon } : {};

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex
        vertical
        gap={spacing[4]}
        style={{ padding: spacing[4], maxWidth: CATEGORY_MEASURE }}
        data-testid="categories-catalog-page"
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t(CATEGORIES_I18N_KEYS.catalogTitle)}
        </Typography.Title>
        {/* The strip and the tree read the SAME catalogue, so an empty or a
            failed one used to be drawn twice — two stacked `Empty` blocks,
            two red alerts each with its own retry. One read, one state: the
            page answers for both parts and the parts render only when there
            is something to render. */}
        <CategoryTree>
          {(bag) => (
            <LoadList
              state={bag.state}
              testId="categories-catalog"
              onRetry={bag.refetch}
              failed={(error) => (
                <ErrorAlert
                  testId="categories-catalog-failed"
                  thrown={error}
                  message={t(CATEGORIES_I18N_KEYS.catalogLoadFailed)}
                  onRetry={bag.refetch}
                />
              )}
              empty={
                <EmptyState
                  testId="categories-catalog-empty"
                  title={t(CATEGORIES_I18N_KEYS.catalogEmpty)}
                />
              }
            >
              {() => (
                <>
                  <CategoryCarouselStrip basePath={base} {...link} {...icon} />
                  <CategoryTreePane basePath={base} {...link} />
                </>
              )}
            </LoadList>
          )}
        </CategoryTree>
      </Flex>
    </SkinTheme>
  );
}
