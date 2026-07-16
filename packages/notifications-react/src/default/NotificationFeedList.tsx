/**
 * `<NotificationFeedList/>` — default skin for the "recent notifications"
 * settings surface (a read-only history list — the closest this module's
 * REAL contract gets to a "notifications" settings tab; the category×channel
 * PREFERENCE toggles a user usually expects on this tab live on
 * `Profile`/`ProfileUpdate` instead — see `@stapel/profiles-react/default`'s
 * `<NotificationPreferences/>`). Built entirely on this pair's EXISTING
 * `NotificationFeed` headless wrapper (`useInfiniteNotificationFeed`) — no new
 * backend surface.
 */
import type { ReactElement } from "react";
import { Alert, Button, Card, Empty, List, Spin, Typography } from "antd";
import { useT } from "@stapel/core";
import { NotificationFeed } from "../headless/NotificationFeed.js";
import type { FeedItem } from "../api/types.js";
import { NOTIFICATIONS_I18N_KEYS } from "../i18n/keys.js";

export interface NotificationFeedListProps {
  /** Page size passed straight to `useInfiniteNotificationFeed`. */
  limit?: number;
}

export function NotificationFeedList(props: NotificationFeedListProps = {}): ReactElement {
  const t = useT();

  return (
    <NotificationFeed {...(props.limit !== undefined ? { limit: props.limit } : {})}>
      {({ items, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage }) => (
        <Card data-testid="notification-feed-list">
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            {t(NOTIFICATIONS_I18N_KEYS.feedSettingsTitle)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(NOTIFICATIONS_I18N_KEYS.feedSettingsSubtitle)}
          </Typography.Text>

          {isError && error && (
            <Alert style={{ marginTop: 12 }} type="error" showIcon message={error.message} />
          )}

          {isLoading ? (
            <Spin style={{ marginTop: 16 }} />
          ) : items.length === 0 ? (
            <Empty style={{ marginTop: 16 }} description={t(NOTIFICATIONS_I18N_KEYS.feedEmpty)} />
          ) : (
            <List<FeedItem>
              style={{ marginTop: 16 }}
              dataSource={items as FeedItem[]}
              rowKey={(item) => item.id}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta title={item.title} description={item.body} />
                </List.Item>
              )}
            />
          )}

          {hasNextPage && (
            <Button
              style={{ marginTop: 12 }}
              loading={isFetchingNextPage}
              onClick={() => fetchNextPage()}
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            >
              {t(NOTIFICATIONS_I18N_KEYS.feedLoadMore)}
            </Button>
          )}
          {!hasNextPage && items.length > 0 && (
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
              {t(NOTIFICATIONS_I18N_KEYS.feedEnd)}
            </Typography.Text>
          )}
        </Card>
      )}
    </NotificationFeed>
  );
}
