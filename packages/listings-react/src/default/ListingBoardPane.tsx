/**
 * `<ListingBoardPane>` — the default listing grid for a category page.
 *
 * `CategoryPage` leaves `renderListings` to its container, and a container
 * with no search module had nothing to put there: the page said "Slot
 * renderListings is not filled" (Tier-0 e2e D5). This is that grid, over the
 * public board narrowed to the category and its subtree:
 *
 * ```tsx
 * <CategoryPage
 *   slug={slug}
 *   renderListings={(category) => (
 *     <ListingBoardPane categoryIds={[String(category.id)]} hrefFor={(id) => `/l/${id}`} />
 *   )}
 * />
 * ```
 *
 * A marketplace with `@stapel/search-react` uses its results page instead:
 * search carries `promoted` (DSA Art. 26) and facets, the board does neither.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { EmptyState, ErrorAlert, SkinButton as Button, SkinTheme } from "@stapel/tokens-antd/skin";
import { matchList, useT } from "@stapel/core";
import type { SignInCtaProp } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { useListingBoard } from "../headless/ListingBoard.js";
import type { UseListingBoardOptions } from "../headless/ListingBoard.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { ListingCard } from "./ListingCard.js";
import type { ListingCardOpenProps } from "./ListingCard.js";
import { FAVORITES_CARD_MIN } from "./FavoritesPane.js";
import type { FavoritesHrefRow, FavoritesPaneOpenProps } from "./FavoritesPane.js";
import type { ThemeModeProp } from "./types.js";

export type ListingBoardPaneProps = ThemeModeProp &
  SignInCtaProp &
  UseListingBoardOptions &
  FavoritesPaneOpenProps & {
    /** What a visitor on an empty category can do next (a "post one" link). */
    readonly emptyAction?: ReactNode;
    readonly "data-testid"?: string;
  };

function openProps(props: FavoritesPaneOpenProps, row: FavoritesHrefRow): ListingCardOpenProps {
  if (props.hrefFor !== undefined) {
    const href = props.hrefFor(row.id, row);
    return props.linkComponent !== undefined
      ? { href, linkComponent: props.linkComponent }
      : { href };
  }
  if (props.onOpen !== undefined) return { onOpen: props.onOpen };
  return {};
}

export function ListingBoardPane(props: ListingBoardPaneProps): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "listings-board";
  const bag = useListingBoard({
    ...(props.categoryIds !== undefined ? { categoryIds: props.categoryIds } : {}),
    ...(props.limit !== undefined ? { limit: props.limit } : {}),
  });
  const paged = bag.prevPage.available || bag.nextPage.available;

  return (
    <SkinTheme surface="bare" {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Flex vertical gap={spacing[4]} data-testid={testId}>
        {matchList(bag.rows, {
          loading: () => (
            <div
              role="status"
              aria-busy="true"
              aria-label={t(LISTINGS_I18N_KEYS.boardLoading)}
              data-testid={`${testId}-loading`}
              data-stapel-load-state="loading"
            />
          ),
          failed: (error) => (
            <ErrorAlert
              testId={`${testId}-error`}
              thrown={error}
              message={t(LISTINGS_I18N_KEYS.boardLoadFailed)}
              onRetry={bag.refetch}
              retryLabel={t(LISTINGS_I18N_KEYS.mineRetry)}
            />
          ),
          empty: () => (
            <EmptyState
              testId={`${testId}-empty`}
              title={t(LISTINGS_I18N_KEYS.boardEmpty)}
              {...(props.emptyAction !== undefined ? { action: props.emptyAction } : {})}
            />
          ),
          ready: (rows) => (
            <div
              data-testid={`${testId}-grid`}
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
                  {...openProps(props, row as FavoritesHrefRow)}
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
                data-testid={`${testId}-prev`}
                data-analytics="none"
                data-analytics-reason="paging a list the person is already reading; not a business action"
                onClick={bag.goPrev}
              >
                {t(LISTINGS_I18N_KEYS.pagePrev)}
              </Button>
            ) : null}
            <Typography.Text type="secondary" data-testid={`${testId}-page`}>
              {t(LISTINGS_I18N_KEYS.pageIndicator, { page: bag.pageNumber })}
            </Typography.Text>
            {bag.nextPage.available ? (
              <Button
                size="small"
                data-testid={`${testId}-next`}
                data-analytics="none"
                data-analytics-reason="paging a list the person is already reading; not a business action"
                onClick={bag.goNext}
              >
                {t(LISTINGS_I18N_KEYS.pageNext)}
              </Button>
            ) : null}
          </Flex>
        ) : null}
      </Flex>
    </SkinTheme>
  );
}
