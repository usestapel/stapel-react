/** The notifications PAGE — what the bell in the nav actually opens. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FeedDeliveryProvider } from "../src/index.js";
import type { FeedDelivery, NotificationFeedPage } from "../src/index.js";
import { NotificationsPage } from "../src/default/index.js";
import { NotificationsDemoHarness } from "./_harness.js";
import { DEMO_FEED_EMPTY, DEMO_FEED_LONG, DEMO_FEED_SHORT, DEMO_NOW } from "./fixtures.js";

function PageDemo(props: {
  feed: readonly NotificationFeedPage[];
  delivery?: FeedDelivery;
}): ReactElement {
  const page = <NotificationsPage now={DEMO_NOW} />;
  return (
    <NotificationsDemoHarness seed={{ feed: props.feed }}>
      {props.delivery !== undefined ? (
        <FeedDeliveryProvider value={props.delivery}>{page}</FeedDeliveryProvider>
      ) : (
        page
      )}
    </NotificationsDemoHarness>
  );
}

/**
 * Four states of one page, and the two that matter most are the ones the old
 * skin could not show: how the page says it is LIVE, and how it says it is
 * polling instead. A feed that has quietly stopped updating looks exactly like
 * a feed with nothing new in it, so the mode is always drawn.
 */
export default defineDemo({
  id: "notifications.page",
  title: "Notifications page",
  description:
    "The page the nav routes to: a heading, the delivery mode (live socket or the documented 60s poll), and the feed with a real row anatomy — type glyph, title, body, relative time, deep link.",
  component: NotificationsPage,
  covers: ["NotificationFeedList"],
  tokens: ["surface", "text", "text-muted", "border-subtle"],
  variants: {
    polling: {
      description:
        "No realtime extra on this deployment: the newest page is refetched every 60s while the tab is visible, and the indicator says so.",
      viewport: "phone",
      step: "ready/polling",
      render: () => <PageDemo feed={DEMO_FEED_SHORT} />,
    },
    live: {
      description: "A socket is carrying the feed — new rows arrive as frames.",
      viewport: "phone",
      step: "ready/live",
      render: () => <PageDemo feed={DEMO_FEED_SHORT} delivery={{ mode: "live" }} />,
    },
    desktop: {
      description:
        "The same page at desktop width: the list fills its container up to a reading measure instead of staying a 340px card.",
      viewport: "desktop",
      step: "ready/paged",
      render: () => <PageDemo feed={DEMO_FEED_LONG} />,
    },
    empty: {
      description:
        "Read, and there was nothing. The only state allowed to say so — and it says it alone, not as a footer under rows.",
      viewport: "phone",
      step: "empty",
      render: () => <PageDemo feed={DEMO_FEED_EMPTY} />,
    },
  },
});
