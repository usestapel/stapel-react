/** The feed list on its own — droppable into a host's page. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FeedDeliveryProvider } from "../src/index.js";
import type { FeedDelivery, NotificationFeedPage } from "../src/index.js";
import { NotificationFeedList } from "../src/default/index.js";
import { NotificationsDemoHarness } from "./_harness.js";
import {
  DEMO_FEED_ALL_READ,
  DEMO_FEED_LONG,
  DEMO_FEED_SHORT,
  DEMO_NOW,
} from "./fixtures.js";

function ListDemo(props: {
  feed: readonly NotificationFeedPage[];
  delivery?: FeedDelivery;
}): ReactElement {
  const list = <NotificationFeedList now={DEMO_NOW} />;
  return (
    <NotificationsDemoHarness seed={{ feed: props.feed }}>
      {props.delivery !== undefined ? (
        <FeedDeliveryProvider value={props.delivery}>{list}</FeedDeliveryProvider>
      ) : (
        list
      )}
    </NotificationsDemoHarness>
  );
}

/**
 * The list without the page frame, plus the state a socket client must never
 * enter silently: refused. The refusal is NAMED (a dead session reads
 * differently from a deployment whose origin allowlist is empty) and the way
 * back is beside it.
 */
export default defineDemo({
  id: "notifications.feed_list",
  title: "Notification feed list",
  description:
    "The feed as a self-contained skin: unread dot and count, mark-all, type glyph, title, one-line body, relative time in a <time> carrying the exact instant, and the whole row as a link when data carries a deep link.",
  component: NotificationFeedList,
  tokens: [
    "surface-raised",
    "text",
    "text-muted",
    "border-subtle",
    "accent",
  ],
  variants: {
    default: {
      description:
        "Two unread rows, both with somewhere to go: the dot on each, the count above, and mark-all live.",
      viewport: "phone",
      step: "ready/unread",
      render: () => <ListDemo feed={DEMO_FEED_SHORT} />,
    },
    refused: {
      description:
        "The socket will not come back on its own. The reason is stated and Reconnect is right there — never a silent fall back to polling.",
      viewport: "phone",
      step: "refused/session",
      render: () => (
        <ListDemo
          feed={DEMO_FEED_SHORT}
          delivery={{
            mode: "refused",
            refusal: "session",
            reconnect: () => undefined,
          }}
        />
      ),
    },
    paged: {
      description:
        "Two unread over two already read, with more pages behind them. The difference between a read row and an unread one is the thing to look at here — it has to survive being scanned, not read.",
      viewport: "desktop",
      step: "ready/mixed-read",
      render: () => <ListDemo feed={DEMO_FEED_LONG} />,
    },
    allRead: {
      description:
        "Nothing left unread: no dots, no badge, and mark-all switched OFF with the sentence saying why beside it — never a live button whose only outcome is marked: 0.",
      viewport: "desktop",
      step: "ready/all-read",
      render: () => <ListDemo feed={DEMO_FEED_ALL_READ} />,
    },
  },
});
