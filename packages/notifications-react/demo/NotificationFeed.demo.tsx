/** Notification feed — headless load-more list over the anchor-paginated feed. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { NotificationFeed } from "../src/index.js";
import type { FeedItem } from "../src/index.js";
import {
  NotificationsDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
} from "./_harness.js";

/** A canned feed page (two items, no further pages). */
const FEED_PAGE = {
  items: [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      notification_type: "listing_blocked",
      title: "Your listing has been blocked",
      body: "Your listing was blocked for guideline violations.",
      data: {},
      created_at: "2026-03-17T10:30:00Z",
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      notification_type: "message_received",
      title: "New message",
      body: "You have a new message from a buyer.",
      data: {},
      created_at: "2026-03-16T09:00:00Z",
    },
  ],
  next_anchor: null,
  prev_anchor: null,
  has_next: false,
  has_prev: false,
  count: 2,
};

function FeedRow(props: { item: FeedItem }): ReactElement {
  return (
    <li
      style={{
        listStyle: "none",
        padding: `${spacing["2"]}px 0`,
        borderTop: `1px solid ${cssVar("border-subtle")}`,
      }}
    >
      <strong style={{ fontSize: fontSize.md.fontSize }}>
        {props.item.title}
      </strong>
      <div style={{ color: cssVar("text-muted") }}>
        {props.item.body}
      </div>
    </li>
  );
}

/** The feed body — mounted INSIDE the harness, so `useT`/hooks have providers. */
function FeedBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="NotificationFeed">
      <NotificationFeed>
        {({ items, isLoading, hasNextPage, fetchNextPage }) => {
          if (isLoading) {
            return (
              <span style={{ color: cssVar("text-muted") }}>
                {t("notifications.feed.loading")}
              </span>
            );
          }
          if (items.length === 0) {
            return (
              <span style={{ color: cssVar("text-muted") }}>
                {t("notifications.feed.empty")}
              </span>
            );
          }
          return (
            <>
              <ul style={{ margin: 0, padding: 0, borderRadius: radii.sm }}>
                {items.map((item) => (
                  <FeedRow key={item.id} item={item} />
                ))}
              </ul>
              <DemoActions>
                {hasNextPage ? (
                  <DemoButton
                    run={fetchNextPage}
                    labelKey="notifications.feed.load_more"
                  />
                ) : (
                  <span style={{ color: cssVar("text-muted") }}>
                    {t("notifications.feed.end")}
                  </span>
                )}
              </DemoActions>
            </>
          );
        }}
      </NotificationFeed>
    </DemoCard>
  );
}

function NotificationFeedDemo(): ReactElement {
  return (
    <NotificationsDemoHarness handlers={{ "/feed/": FEED_PAGE }}>
      <FeedBody />
    </NotificationsDemoHarness>
  );
}

/**
 * Demonstrates the headless feed: the canned handler returns one page of two
 * items with `has_next: false`, so the list renders and the "load more" control
 * resolves to the caught-up end state. Swap the handler for a `has_next: true`
 * page to exercise pagination.
 */
export default defineDemo({
  id: "notifications.feed",
  title: "Notification feed",
  description:
    "The headless NotificationFeed renders an anchor-paginated, load-more list from the user's push-notification log. Bring your own row/skeleton/empty UI — the component is renderless.",
  component: NotificationFeed,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <NotificationFeedDemo /> },
  },
});
