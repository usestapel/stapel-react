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
 */
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
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

/** The narrowest a card may get before the grid drops a column — the same
 * element-relative rule the detail gallery uses. It was `width: 240`, which
 * left two cards floating in a 2560px pane and overflowed a 390px one. */
export const FAVORITES_CARD_MIN = "15rem";

/** How a card in this grid opens — the same one-contract union `<ListingCard>`
 * takes, one level up, so a pane cannot re-introduce the double navigation the
 * card no longer allows. */
export type FavoritesPaneOpenProps =
  | {
      /** Where a card leads. The container owns routing. */
      readonly hrefFor: (id: number) => string;
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

export type FavoritesPaneProps = ThemeModeProp &
  SignInCtaProp &
  FavoritesPaneOpenProps;

/** The card's own open props for one row. One arm, never two. */
function cardOpenProps(
  props: FavoritesPaneOpenProps,
  id: number
): ListingCardOpenProps {
  if (props.hrefFor !== undefined) {
    const href = props.hrefFor(id);
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
      style={{ padding: spacing[4] }}
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
                      {...cardOpenProps(props, row.id)}
                    />
                  ))}
                </div>
              ),
            })}

            {paged ? (
              <Flex gap={spacing[2]} wrap>
                <GatedButton
                  gate={bag.prevPage}
                  size="small"
                  layout="inline"
                  testId="listings-favorites-prev"
                  data-analytics="none"
                  data-analytics-reason="paging a list the person is already reading; not a business action"
                  onClick={bag.goPrev}
                >
                  {t(LISTINGS_I18N_KEYS.pagePrev)}
                </GatedButton>
                <GatedButton
                  gate={bag.nextPage}
                  size="small"
                  layout="inline"
                  testId="listings-favorites-next"
                  data-analytics="none"
                  data-analytics-reason="paging a list the person is already reading; not a business action"
                  onClick={bag.goNext}
                >
                  {t(LISTINGS_I18N_KEYS.pageNext)}
                </GatedButton>
              </Flex>
            ) : null}
          </>
        )}
      </Flex>
    </SkinTheme>
  );
}
