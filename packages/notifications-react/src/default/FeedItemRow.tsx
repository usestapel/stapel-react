/**
 * One feed row, with an anatomy.
 *
 * The audit counted what the old row rendered: two of `FeedItemResponse`'s six
 * fields. No time, so the list had no chronology beyond its order; no type, so
 * a security alert and an expiring listing looked identical; and no `data`, so
 * a notification whose entire purpose is to take somebody to a listing took
 * them nowhere. A notification feed that cannot navigate is a log.
 *
 * The row now renders all six:
 *
 *   notification_type → the family glyph on the left
 *   title            → the line that is read first
 *   body             → one muted line under it
 *   created_at       → relative time on the right, in a `<time>` carrying the
 *                      exact instant for anything that wants it
 *   data             → the deep link: the whole row becomes the link when one
 *                      of the three declared keys is present
 *   id               → the React key, and the id the socket merge upserts on
 *
 * ── Why the whole row is the link, and why it is an `<a>` ─────────────────
 *
 * A tap target on a phone is the row, not a chevron at the end of it, and the
 * 44px floor comes from `SkinTheme` only for antd *controls* — a hand-rolled
 * clickable div inherits nothing and is not focusable, not announced as a
 * link, and not openable in a new tab. `data.listing_url` is a URL, so the
 * honest element is an anchor: the host routes it (an SPA intercepts the
 * click) without this pair owning routing.
 *
 * A row with no link is NOT a dead control: it renders as plain text with no
 * chevron and no hover affordance, so nothing invites a tap that does nothing.
 */
import type { MouseEvent, ReactElement } from "react";
import { Flex, Typography, theme as antdTheme } from "antd";
import { spacing } from "@stapel/tokens";
import { useI18n } from "@stapel/core";
import type { FeedItem } from "../api/types.js";
import { feedItemLink } from "../api/types.js";
import { formatFeedTime } from "../model/format.js";
import { NotificationTypeIcon, OpenChevronIcon } from "./icons.js";

export interface FeedItemRowProps {
  readonly item: FeedItem;
  /**
   * Called instead of following the link, for a host that routes internally.
   * The pair hands over the item and the resolved URL and owns nothing else —
   * routing is the host's.
   */
  readonly onSelect?: ((item: FeedItem, url: string) => void) | undefined;
  /** Injected in demos and tests so a rendered "3 days ago" is a fact about
   * the fixture rather than about the day the suite ran. */
  readonly now?: Date | undefined;
}

export function FeedItemRow(props: FeedItemRowProps): ReactElement {
  const { item, onSelect } = props;
  const { locale } = useI18n();
  const { token } = antdTheme.useToken();
  const href = feedItemLink(item);
  const when = formatFeedTime(item.created_at, locale, props.now);

  const body = (
    <Flex
      gap={spacing[3]}
      align="flex-start"
      style={{
        paddingBlock: spacing[3],
        paddingInline: spacing[1],
        width: "100%",
      }}
    >
      <span
        style={{ color: token.colorTextSecondary, lineHeight: 1, paddingTop: spacing[1] }}
      >
        <NotificationTypeIcon type={item.notification_type} />
      </span>
      <Flex vertical gap={spacing[1]} style={{ minWidth: 0, flex: 1 }}>
        {/* ONE anatomy, at every width. This line used to `wrap`, so a title
            long enough to crowd the time pushed it onto a second line — and a
            list of mixed-length titles rendered two different rows, some with
            the time inline at the right and some with it underneath. The title
            now truncates and the time keeps its own column, so every row in
            the list has the same shape. */}
        <Flex gap={spacing[3]} justify="space-between" align="baseline">
          <Typography.Text
            strong
            ellipsis
            style={{ color: token.colorText, minWidth: 0, flex: 1 }}
          >
            {item.title}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            style={{
              fontSize: token.fontSizeSM,
              whiteSpace: "nowrap",
              flex: "0 0 auto",
            }}
          >
            <time dateTime={item.created_at}>{when}</time>
          </Typography.Text>
        </Flex>
        <Typography.Text type="secondary">{item.body}</Typography.Text>
      </Flex>
      {href !== undefined && (
        <span style={{ color: token.colorTextTertiary, lineHeight: 1, paddingTop: spacing[1] }}>
          <OpenChevronIcon />
        </span>
      )}
    </Flex>
  );

  if (href === undefined) {
    return (
      <li
        data-testid="notification-feed-item"
        data-notification-type={item.notification_type}
        style={{
          listStyle: "none",
          borderBottom: `1px solid ${token.colorSplit}`,
        }}
      >
        {body}
      </li>
    );
  }

  return (
    <li
      data-testid="notification-feed-item"
      data-notification-type={item.notification_type}
      style={{ listStyle: "none", borderBottom: `1px solid ${token.colorSplit}` }}
    >
      <a
        href={href}
        data-testid="notification-feed-link"
        style={{ display: "block", color: "inherit" }}
        data-analytics="none"
        data-analytics-reason="navigation to the notification's own target — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        {...(onSelect !== undefined
          ? {
              onClick: (event: MouseEvent<HTMLAnchorElement>) => {
                // Leave the modified clicks alone: ctrl/cmd/middle-click open a
                // new tab, and a router that swallowed those would break the
                // one browser affordance a link is expected to keep.
                if (
                  event.defaultPrevented ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                event.preventDefault();
                onSelect(item, href);
              },
            }
          : {})}
      >
        {body}
      </a>
    </li>
  );
}
