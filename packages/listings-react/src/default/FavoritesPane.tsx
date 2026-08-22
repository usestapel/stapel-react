/**
 * `<FavoritesPane>` — what the person saved.
 *
 * The simplest screen in the pair, and the one that shows the load-state
 * discipline at its plainest: four arms, four different things on screen.
 * "You have not saved anything yet" and "we could not load your favourites"
 * are the pair a `data ?? []` would have merged, and merging them is exactly
 * the substitution that cost the fleet an incident (spec §7.4).
 */
import type { ReactElement } from "react";
import { Alert, Button, Empty, Flex, Space, Spin, Typography } from "antd";
import { matchList, useDescribeFlowError, useT } from "@stapel/core";
import { useFavorites } from "../headless/Favorites.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { ListingCard } from "./ListingCard.js";
import { ListingsSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface FavoritesPaneProps extends ThemeModeProp {
  /** Where a card leads. The container owns routing. */
  readonly hrefFor?: (id: number) => string;
  readonly onOpen?: (id: number) => void;
}

export function FavoritesPane(props: FavoritesPaneProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const bag = useFavorites();

  return (
    <ListingsSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Flex vertical gap={16} data-testid="listings-favorites">
        <Typography.Title level={3}>
          {t(LISTINGS_I18N_KEYS.favoritesTitle)}
        </Typography.Title>

        {!bag.gate.available ? (
          <Alert
            type="info"
            showIcon
            data-testid="listings-favorites-blocked"
            message={t(bag.gate.block.code, bag.gate.block.params)}
          />
        ) : null}

        {matchList(bag.rows, {
          loading: () => (
            <Flex justify="center" data-testid="listings-favorites-loading">
              <Spin aria-label={t(LISTINGS_I18N_KEYS.favoritesLoading)} />
            </Flex>
          ),
          failed: () => (
            <ErrorAlert
              testId="listings-favorites-error"
              error={describe({
                code: LISTINGS_I18N_KEYS.favoritesLoadFailed,
                params: {},
                status: 0,
                message: undefined,
                language: undefined,
              })}
              action={
                <Button
                  size="small"
                  data-analytics="none"
                  data-analytics-reason="retrying a read the person already asked for; not a business action"
                  onClick={bag.refetch}
                >
                  {t(LISTINGS_I18N_KEYS.mineRetry)}
                </Button>
              }
            />
          ),
          empty: () => (
            <Empty
              data-testid="listings-favorites-empty"
              description={t(LISTINGS_I18N_KEYS.favoritesEmpty)}
            />
          ),
          ready: (rows) => (
            <Flex wrap gap={16} data-testid="listings-favorites-grid">
              {rows.map((row) => (
                <div key={row.id} style={{ width: 240 }}>
                  <ListingCard
                    listing={row}
                    {...(props.hrefFor !== undefined
                      ? { href: props.hrefFor(row.id) }
                      : {})}
                    {...(props.onOpen !== undefined ? { onOpen: props.onOpen } : {})}
                  />
                </div>
              ))}
            </Flex>
          ),
        })}

        <Space>
          <Button
            size="small"
            disabled={!bag.prevPage.available}
            data-testid="listings-favorites-prev"
            data-analytics="none"
            data-analytics-reason="paging a list the person is already reading; not a business action"
            onClick={bag.goPrev}
          >
            {t(LISTINGS_I18N_KEYS.pagePrev)}
          </Button>
          <Button
            size="small"
            disabled={!bag.nextPage.available}
            data-testid="listings-favorites-next"
            data-analytics="none"
            data-analytics-reason="paging a list the person is already reading; not a business action"
            onClick={bag.goNext}
          >
            {t(LISTINGS_I18N_KEYS.pageNext)}
          </Button>
        </Space>
      </Flex>
    </ListingsSkinTheme>
  );
}
