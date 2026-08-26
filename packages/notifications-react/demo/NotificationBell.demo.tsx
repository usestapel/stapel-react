/** The bell a shell puts in its top bar — and the number on it. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { NotificationBell } from "../src/default/index.js";
import { NotificationsDemoHarness } from "./_harness.js";
import { demoFeedWithUnread } from "./fixtures.js";

function BellDemo(props: { unread: number }): ReactElement {
  return (
    <NotificationsDemoHarness seed={{ feed: demoFeedWithUnread(props.unread) }}>
      <NotificationBell onOpen={() => undefined} />
    </NotificationsDemoHarness>
  );
}

/**
 * Three counts, because the badge's whole job is to be different at each of
 * them — and the third is the one a bell usually gets wrong: at zero it draws
 * NOTHING, not a grey "0". A badge that is always there stops being read.
 *
 * The number comes off the feed's own page envelope (`unread_count`), so this
 * bell and an open notifications page share one request and one cache entry:
 * marking something read moves both in the same frame instead of leaving the
 * badge a round trip behind the rows it counts.
 */
export default defineDemo({
  id: "notifications.bell",
  title: "Notification bell",
  description:
    "The nav entry with its unread badge: the count from the feed's own page envelope, the accessible name carrying it, and nothing at all drawn at zero.",
  component: NotificationBell,
  tokens: ["accent", "text", "surface"],
  variants: {
    unread: {
      description: "Three waiting — the count is in the badge and in the button's accessible name.",
      viewport: "phone",
      step: "unread/3",
      render: () => <BellDemo unread={3} />,
    },
    overflow: {
      description:
        "A busy account: past 99 the badge reads 99+ rather than resizing the nav for a number nobody acts on.",
      viewport: "phone",
      step: "unread/overflow",
      render: () => <BellDemo unread={128} />,
    },
    caughtUp: {
      description:
        "Nothing unread: the bell alone, no badge. The same picture a failed read gets — the bell never invents a number it does not have.",
      viewport: "phone",
      step: "unread/zero",
      render: () => <BellDemo unread={0} />,
    },
  },
});
