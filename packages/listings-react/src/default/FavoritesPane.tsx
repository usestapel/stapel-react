/**
 * `<FavoritesPane>` — what the person saved.
 *
 * The simplest screen in the pair, and the one that shows the load-state
 * discipline at its plainest: four arms, four different things on screen.
 * "You have not saved anything yet" and "we could not load your favourites"
 * are the pair a `data ?? []` would have merged, and merging them is exactly
 * the substitution that cost the fleet an incident (spec §7.4).
 *
 * ── A visitor is told ONE thing ────────────────────────────────────────────
 *
 * `useFavorites` disables the query without a mandate, so a visitor's `rows`
 * sit in `loading` forever — and the pane rendered the blocked notice AND the
 * spinner underneath it, saying "you cannot see this" and "we are fetching it"
 * at the same time, with no sign-in link anywhere on the screen. The gate is
 * now the WHOLE body: one designed state, with the door the container supplies
 * (`signIn`) inside it, and nothing else drawn.
 *
 * The pager obeys the same rule. `Previous`/`Next` were rendered disabled in
 * every state including empty, failed and blocked — two controls that meant
 * nothing, three times over. They render when there is a page to go to.
 *
 * And each one renders only when ITS page exists. The keyset gates name the
 * missing page with the button's own label key, so a blocked `Previous` drew
 * the word twice — once as a dead button, once as its own "reason". A pager
 * does not explain itself: the page indicator says where you are, and a
 * direction with nowhere to go is simply not drawn.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { SkinButton as Button } from "@stapel/tokens-antd/skin";
import {
  EmptyState,
  ErrorAlert,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { matchList, useT } from "@stapel/core";
import type { LinkComponent, SignInCtaProp } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { useFavorites } from "../headless/Favorites.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { ListingCard } from "./ListingCard.js";
import type { ListingCardOpenProps } from "./ListingCard.js";
import { SignInLink } from "./SignInLink.js";
import type { ThemeModeProp } from "./types.js";
import type { ListingCard as ListingCardRow } from "../api/types.js";

/**
 * The row `hrefFor` is called with as its second argument — the same
 * {@link ListingCardRow} the grid renders each card from. `title` is
 * guaranteed present here: a favourite is always a PUBLISHED listing (a
 * draft has nothing to favourite), so the public card's `title` is never the
 * blank the wire allows for an unpublished one.
 */
export type FavoritesHrefRow = ListingCardRow & { title: string };

/** The narrowest a card may get before the grid drops a column — the same
 * element-relative rule the detail gallery uses. It was `width: 240`, which
 * left two cards floating in a 2560px pane and overflowed a 390px one. */
export const FAVORITES_CARD_MIN = "15rem";

/** How wide the saved grid may get before it stops being a grid and becomes
 * three cards adrift in a 1280px window. A measure, not a breakpoint: the
 * cards keep filling it, and past it the page centres. */
export const FAVORITES_MEASURE = "72rem";

/** How a card in this grid opens — the same one-contract union `<ListingCard>`
 * takes, one level up, so a pane cannot re-introduce the double navigation the
 * card no longer allows. */
export type FavoritesPaneOpenProps =
  | {
      /**
       * Where a card leads. The container owns routing. Called with the
       * row's id and the row itself ({@link FavoritesHrefRow}, `title`
       * guaranteed present) — a container that only needs the id keeps
       * working unchanged.
       */
      readonly hrefFor: (id: number, row: FavoritesHrefRow) => string;
      /** The host's `<Link>`, so a click stays inside the SPA. */
      readonly linkComponent?: LinkComponent;
      readonly onOpen?: undefined;
    }
  | {
      readonly onOpen: (id: number) => void;
      readonly hrefFor?: undefined;
      readonly linkComponent?: undefined;
    }
  | {
      readonly hrefFor?: undefined;
      readonly onOpen?: undefined;
      readonly linkComponent?: undefined;
    };

/** The way OUT of an empty favourites list. */
export interface FavoritesBrowseCtaProp {
  /**
   * What a person with nothing saved can do next — a "Browse listings"
   * button, supplied by the container because only it knows where the
   * catalogue lives. An empty state without one is a dead end, and this
   * screen was one of four sharing a single stock illustration and no exit.
   */
  readonly browseCta?: ReactNode;
}

export type FavoritesPaneProps = ThemeModeProp &
  SignInCtaProp &
  FavoritesBrowseCtaProp &
  FavoritesPaneOpenProps;

/** The card's own open props for one row. One arm, never two. */
function cardOpenProps(
  props: FavoritesPaneOpenProps,
  row: FavoritesHrefRow
): ListingCardOpenProps {
  if (props.hrefFor !== undefined) {
    const href = props.hrefFor(row.id, row);
    return props.linkComponent !== undefined
      ? { href, linkComponent: props.linkComponent }
      : { href };
  }
  if (props.onOpen !== undefined) return { onOpen: props.onOpen };
  return {};
}

export function FavoritesPane(props: FavoritesPaneProps): ReactElement {
  const t = useT();
  const bag = useFavorites();
  const paged = bag.prevPage.available || bag.nextPage.available;

  return (
    <SkinTheme
      surface="base"
      style={{ padding: spacing[4], maxWidth: FAVORITES_MEASURE }}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={spacing[4]} data-testid="listings-favorites">
        <Typography.Title level={3}>
          {t(LISTINGS_I18N_KEYS.favoritesTitle)}
        </Typography.Title>

        {!bag.gate.available ? (
          // The whole body, not a banner over a spinner. A blocked screen has
          // one state and it carries its own way out.
          <EmptyState
            testId="listings-favorites-blocked"
            title={t(bag.gate.block.code, bag.gate.block.params)}
            hint={t(LISTINGS_I18N_KEYS.favoritesSignInHint)}
            action={
              <SignInLink cta={props.signIn} testId="listings-favorites-sign-in" />
            }
          />
        ) : (
          <>
            {matchList(bag.rows, {
              loading: () => (
                <div
                  role="status"
                  aria-busy="true"
                  aria-label={t(LISTINGS_I18N_KEYS.favoritesLoading)}
                  data-testid="listings-favorites-loading"
                  data-stapel-load-state="loading"
                />
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="listings-favorites-error"
                  thrown={error}
                  message={t(LISTINGS_I18N_KEYS.favoritesLoadFailed)}
                  onRetry={bag.refetch}
                  retryLabel={t(LISTINGS_I18N_KEYS.mineRetry)}
                />
              ),
              empty: () => (
                <EmptyState
                  testId="listings-favorites-empty"
                  title={t(LISTINGS_I18N_KEYS.favoritesEmpty)}
                  hint={t(LISTINGS_I18N_KEYS.favoritesEmptyHint)}
                  {...(props.browseCta !== undefined
                    ? { action: props.browseCta }
                    : {})}
                />
              ),
              ready: (rows) => (
                <div
                  data-testid="listings-favorites-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(auto-fill, minmax(${FAVORITES_CARD_MIN}, 1fr))`,
                    gap: spacing[4],
                  }}
                >
                  {rows.map((row) => (
                    <ListingCard
                      key={row.id}
                      listing={row}
                      blockedReason="line"
                      {...(props.signIn !== undefined ? { signIn: props.signIn } : {})}
                      {...cardOpenProps(props, row as FavoritesHrefRow)}
                    />
                  ))}
                </div>
              ),
            })}

            {paged ? (
              <Flex gap={spacing[3]} wrap align="center">
                {bag.prevPage.available ? (
                  <Button
                    size="small"
                    data-testid="listings-favorites-prev"
                    data-analytics="none"
                    data-analytics-reason="paging a list the person is already reading; not a business action"
                    onClick={bag.goPrev}
                  >
                    {t(LISTINGS_I18N_KEYS.pagePrev)}
                  </Button>
                ) : null}
                <Typography.Text
                  type="secondary"
                  data-testid="listings-favorites-page"
                >
                  {t(LISTINGS_I18N_KEYS.pageIndicator, { page: bag.pageNumber })}
                </Typography.Text>
                {bag.nextPage.available ? (
                  <Button
                    size="small"
                    data-testid="listings-favorites-next"
                    data-analytics="none"
                    data-analytics-reason="paging a list the person is already reading; not a business action"
                    onClick={bag.goNext}
                  >
                    {t(LISTINGS_I18N_KEYS.pageNext)}
                  </Button>
                ) : null}
              </Flex>
            ) : null}
          </>
        )}
      </Flex>
    </SkinTheme>
  );
}
