/**
 * `<NotificationsPage/>` — the page the nav routes to.
 *
 * The nav entry `notifications.feed` sits at `placement.level: "top"` with a
 * bell, so what it opens has to be a PAGE. It used to open a `<Card>` titled
 * "Recent notifications" — a settings card nested inside a page frame, 340px
 * wide at 1280px (the audit's GAP-N13 and the visual pass's VC-A3). This is
 * the page frame: the layout surface, the title, and the feed inside it at a
 * reading measure.
 *
 * The heading lives here and is switched OFF on the list, so the same words
 * are never said twice — and `<NotificationFeedList/>` stays droppable into a
 * host's own page, which is what a `/default` export is for.
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { FeedItem } from "../api/types.js";
import { NotificationFeedList } from "./NotificationFeedList.js";

export interface NotificationsPageProps {
  /** Page size passed through to the feed. */
  limit?: number;
  /** Route a row internally instead of following its deep link. */
  onSelect?: ((item: FeedItem, url: string) => void) | undefined;
  /** Pin the theme side (a demo showing both). Defaults to the live mode. */
  mode?: "light" | "dark";
  /** Injected in demos and tests so relative times are deterministic. */
  now?: Date | undefined;
}

export function NotificationsPage(props: NotificationsPageProps = {}): ReactElement {
  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="base"
      data-testid="notifications-page"
      style={{
        minHeight: "100%",
        width: "100%",
        paddingBlock: spacing[5],
        paddingInline: spacing[4],
      }}
    >
      <Flex vertical align="stretch">
        <NotificationFeedList
          heading
          surface="bare"
          {...(props.limit !== undefined ? { limit: props.limit } : {})}
          {...(props.onSelect !== undefined ? { onSelect: props.onSelect } : {})}
          {...(props.now !== undefined ? { now: props.now } : {})}
        />
      </Flex>
    </SkinTheme>
  );
}
