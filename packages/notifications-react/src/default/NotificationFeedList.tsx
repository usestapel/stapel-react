/**
 * `<NotificationFeedList/>` — the notification history, drawn.
 *
 * Built on this pair's existing `NotificationFeed` headless wrapper
 * (`useInfiniteNotificationFeed`). It renders a list with a real row anatomy
 * (see `FeedItemRow`), the delivery mode above it (`DeliveryIndicator`), and
 * the three non-happy states through the shared substrate rather than three
 * more local opinions: `LoadList` owns loading / failed / empty, so "no
 * notifications yet" is reachable ONLY from a read that succeeded.
 *
 * ── "You're all caught up" is a footnote, not a terminator ────────────────
 *
 * The visual pass caught it rendering BELOW two unread items, where the same
 * sentence that means "there is nothing" was being used to mean "there is no
 * more". Those are different claims. The empty state now owns the first
 * (`EmptyState`, with a hint and nothing else on the screen), and the end
 * footnote only appears under rows that exist and only when the feed is fully
 * paged.
 *
 * ── Geometry is the element's, not the viewport's ─────────────────────────
 *
 * The old card was 340px wide at 1280 and 340px wide at 390 — a phone layout
 * photographed on a desktop. There is no breakpoint here: the list fills its
 * container up to a reading measure, so the same component is right inside a
 * 360px settings column and inside a full-width page.
 */
import type { ReactElement } from "react";
import { Button, Flex, Typography, theme as antdTheme } from "antd";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { NotificationFeed } from "../headless/NotificationFeed.js";
import type { FeedItem } from "../api/types.js";
import { NOTIFICATIONS_I18N_KEYS } from "../i18n/keys.js";
import { DeliveryIndicator } from "./DeliveryIndicator.js";
import { FeedItemRow } from "./FeedItemRow.js";

/** The reading measure a list of one-line rows stops growing at. A string, so
 * it is a MEASURE and not a pixel decision the spacing scale should own. */
const LIST_MEASURE = "48rem";

export interface NotificationFeedListProps {
  /** Page size passed straight to `useInfiniteNotificationFeed`. */
  readonly limit?: number;
  /** Route a row internally instead of following its `data` deep link. */
  readonly onSelect?: ((item: FeedItem, url: string) => void) | undefined;
  /** Draw the heading above the list. `false` when a page frame already
   * carries it (see `NotificationsPage`), so the title is never said twice. */
  readonly heading?: boolean;
  /** What the skin paints under itself. `"bare"` when it is already inside a
   * host-painted surface. */
  readonly surface?: SkinSurface;
  /** Pin the theme side (a demo that shows both). Defaults to the document's
   * live mode. */
  readonly mode?: "light" | "dark";
  /** Injected in demos and tests so relative times are deterministic. */
  readonly now?: Date | undefined;
}

export function NotificationFeedList(
  props: NotificationFeedListProps = {}
): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const heading = props.heading ?? true;

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface={props.surface ?? "raised"}
      data-testid="notification-feed-list"
      style={{ width: "100%", maxWidth: LIST_MEASURE, padding: spacing[4] }}
    >
      <NotificationFeed {...(props.limit !== undefined ? { limit: props.limit } : {})}>
        {({
          state,
          hasNextPage,
          isFetchingNextPage,
          fetchNextPage,
          refetch,
          delivery,
          unreadCount,
          markAll,
          markAllRead,
          markRead,
          isMarkingRead,
          markReadError,
        }) => (
          <Flex vertical gap={spacing[3]}>
            {heading && (
              <Flex vertical gap={spacing[1]}>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {t(NOTIFICATIONS_I18N_KEYS.feedTitle)}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {t(NOTIFICATIONS_I18N_KEYS.feedSubtitle)}
                </Typography.Text>
              </Flex>
            )}

            {/* The count and the control that clears it, on one line: the
                number is what the button acts on, and when the number is 0 the
                button is off with the sentence that says why sitting beside
                it — never a live button whose only outcome is `marked: 0`.

                The count is drawn ONLY when there is one. "You're all caught
                up." on the left beside "Nothing to mark — everything here is
                read." on the right is the same claim twice, and the gate's
                sentence is the one that has to be there (it explains a
                switched-off control). A cleared feed goes quiet instead. */}
            <Flex
              gap={spacing[3]}
              justify={unreadCount > 0 ? "space-between" : "flex-end"}
              align="baseline"
              wrap
              data-testid="notification-feed-readbar"
            >
              {unreadCount > 0 && (
                <Typography.Text strong data-testid="notification-feed-unread-count">
                  {t(NOTIFICATIONS_I18N_KEYS.feedUnreadCount, { count: unreadCount })}
                </Typography.Text>
              )}
              <GatedButton
                gate={markAll}
                layout="inline"
                size="small"
                loading={isMarkingRead}
                onClick={markAllRead}
                testId="notification-feed-mark-all"
                data-analytics="none"
                data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
              >
                {t(NOTIFICATIONS_I18N_KEYS.feedMarkAllRead)}
              </GatedButton>
            </Flex>

            {/* The optimistic stamp has already been rolled back by the time
                this renders, so the rows a person is looking at are true again
                and this says what happened to them. `inline` — a boxed alert
                between the heading and the list would push the feed down for
                a failure that costs nothing to retry. No `onRetry`: the same
                failure can come from "mark all" or from one row, and a retry
                button that could only re-run one of them would re-run the
                wrong one — the controls that made the request are both still
                on screen. */}
            <ErrorAlert
              thrown={markReadError}
              variant="inline"
              testId="notification-feed-mark-error"
            />

            <DeliveryIndicator delivery={delivery} />

            <LoadList
              state={state}
              onRetry={refetch}
              testId="notification-feed"
              empty={
                <EmptyState
                  testId="notification-feed-empty"
                  title={t(NOTIFICATIONS_I18N_KEYS.feedEmpty)}
                  hint={t(NOTIFICATIONS_I18N_KEYS.feedEmptyHint)}
                />
              }
            >
              {(items) => (
                <Flex vertical gap={spacing[3]}>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      borderTop: `1px solid ${token.colorSplit}`,
                    }}
                  >
                    {items.map((item) => (
                      <FeedItemRow
                        key={item.id}
                        item={item}
                        onMarkRead={markRead}
                        {...(props.onSelect !== undefined ? { onSelect: props.onSelect } : {})}
                        {...(props.now !== undefined ? { now: props.now } : {})}
                      />
                    ))}
                  </ul>
                  {hasNextPage ? (
                    <Button
                      loading={isFetchingNextPage}
                      onClick={fetchNextPage}
                      data-testid="notification-feed-more"
                      data-analytics="none"
                      data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                    >
                      {t(NOTIFICATIONS_I18N_KEYS.feedLoadMore)}
                    </Button>
                  ) : (
                    // A footnote UNDER rows that exist: "there is no more"
                    // is a different claim from "there is nothing", and the
                    // empty state above owns the second one.
                    <Typography.Text
                      type="secondary"
                      data-testid="notification-feed-end"
                      style={{ textAlign: "center" }}
                    >
                      {t(NOTIFICATIONS_I18N_KEYS.feedEnd)}
                    </Typography.Text>
                  )}
                </Flex>
              )}
            </LoadList>
          </Flex>
        )}
      </NotificationFeed>
    </SkinTheme>
  );
}
