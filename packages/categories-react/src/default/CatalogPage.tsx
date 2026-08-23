/**
 * `<CatalogPage>` — the catalogue root at `/c`: the carousel over the top-level
 * tree.
 *
 * This is a single-pair screen, which is exactly why it has a nav entry while
 * `/` does not. The storefront's landing composes THIS pair's carousel with
 * search's newest-listings feed (spec §5.1), and a composed route belongs to
 * the container that composes it — see `nav/manifest.ts`.
 */
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import { CategoryCarouselStrip } from "./CategoryCarouselStrip.js";
import { CategoryTreePane } from "./CategoryTreePane.js";
import { CategoriesSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface CatalogPageProps extends ThemeModeProp, LinkComponentProp {
  readonly basePath?: string;
}

export function CatalogPage(props: CatalogPageProps): ReactElement {
  const t = useT();
  const base = props.basePath ?? "/c";
  // Spread once: every link on this screen belongs to the same host router.
  const link =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};

  return (
    <CategoriesSkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={16} data-testid="categories-catalog-page">
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t(CATEGORIES_I18N_KEYS.catalogTitle)}
        </Typography.Title>
        <CategoryCarouselStrip basePath={base} {...link} />
        <CategoryTreePane basePath={base} {...link} />
      </Flex>
    </CategoriesSkinTheme>
  );
}
