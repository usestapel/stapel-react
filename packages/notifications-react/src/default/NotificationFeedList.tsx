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
import { Button, Card, Empty, List, Spin, Typography } from "antd";
import { matchList, useErrorDisplay, useT } from "@stapel/core";
import { NotificationFeed } from "../headless/NotificationFeed.js";
import type { FeedItem } from "../api/types.js";
import { NOTIFICATIONS_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface NotificationFeedListProps {
  /** Page size passed straight to `useInfiniteNotificationFeed`. */
  limit?: number;
}

export function NotificationFeedList(props: NotificationFeedListProps = {}): ReactElement {
  const t = useT();
  // Never the raw `.message` — for a response with no error envelope that
  // is the transport's own "Request failed with status 500" (owner report
  // 2026-08-09). `useErrorText` folds any thrown value into the one dialect.
  const errorDisplay = useErrorDisplay(NOTIFICATIONS_I18N_KEYS.unknownError);

  return (
    <NotificationFeed {...(props.limit !== undefined ? { limit: props.limit } : {})}>
      {({ state, hasNextPage, isFetchingNextPage, fetchNextPage, refetch }) => (
        <Card data-testid="notification-feed-list">
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            {t(NOTIFICATIONS_I18N_KEYS.feedSettingsTitle)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(NOTIFICATIONS_I18N_KEYS.feedSettingsSubtitle)}
          </Typography.Text>

          {matchList(state, {
            loading: () => <Spin style={{ marginTop: 16 }} />,
            // The alert used to render ABOVE an <Empty> that kept saying "no
            // notifications yet" on a read that never landed. One arm now
            // owns the failure; the empty copy is unreachable from here.
            failed: (error) => (
              <div style={{ marginTop: 16 }} data-testid="notification-feed-error">
                <ErrorAlert error={errorDisplay(error)} />
                <Button
                  style={{ marginTop: 12 }}
                  onClick={refetch}
                  data-analytics="none"
                  data-analytics-reason="recovery affordance for a failed read — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                >
                  {t(NOTIFICATIONS_I18N_KEYS.feedRetry)}
                </Button>
              </div>
            ),
            empty: () => (
              <Empty
                style={{ marginTop: 16 }}
                data-testid="notification-feed-empty"
                description={t(NOTIFICATIONS_I18N_KEYS.feedEmpty)}
              />
            ),
            ready: (items) => (
              <>
                <List<FeedItem>
                  style={{ marginTop: 16 }}
                  dataSource={[...items]}
                  rowKey={(item) => item.id}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta title={item.title} description={item.body} />
                    </List.Item>
                  )}
                />
                {hasNextPage ? (
                  <Button
                    style={{ marginTop: 12 }}
                    loading={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                    data-analytics="none"
                    data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                  >
                    {t(NOTIFICATIONS_I18N_KEYS.feedLoadMore)}
                  </Button>
                ) : (
                  // "You're all caught up." is a claim about the whole feed,
                  // so it belongs to the arm that actually read it.
                  <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                    {t(NOTIFICATIONS_I18N_KEYS.feedEnd)}
                  </Typography.Text>
                )}
              </>
            ),
          })}
        </Card>
      )}
    </NotificationFeed>
  );
}
