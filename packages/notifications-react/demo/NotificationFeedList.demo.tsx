/** The feed list on its own — droppable into a host's page. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FeedDeliveryProvider } from "../src/index.js";
import type { FeedDelivery, NotificationFeedPage } from "../src/index.js";
import { NotificationFeedList } from "../src/default/index.js";
import { NotificationsDemoHarness } from "./_harness.js";
import { DEMO_FEED_LONG, DEMO_FEED_SHORT, DEMO_NOW } from "./fixtures.js";

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
    "The feed as a self-contained skin: type glyph, title, one-line body, relative time in a <time> carrying the exact instant, and the whole row as a link when data carries a deep link.",
  component: NotificationFeedList,
  tokens: ["surface-raised", "text", "text-muted", "border-subtle"],
  variants: {
    default: {
      description: "Two rows, both with somewhere to go, fully paged.",
      viewport: "phone",
      step: "ready",
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
      description: "More pages behind the first: Load more, and no end footnote.",
      viewport: "desktop",
      step: "ready/has-next",
      render: () => <ListDemo feed={DEMO_FEED_LONG} />,
    },
  },
});
