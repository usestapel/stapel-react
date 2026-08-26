/**
 * `<NotificationBell/>` — the nav entry, with the number on it.
 *
 * ── Why the badge is a component and not a field on the nav manifest ──────
 *
 * `NavEntry` (`@stapel/core`'s nav contract) carries a label key, an icon name
 * and a placement — a declaration a shell renders without mounting anything of
 * this pair's. There is no way to say "and put a live number on it", and there
 * should not be a general one: a count is a subscription, and a nav contract
 * that could hold subscriptions would make every shell's menu a set of
 * queries. So the bell is a COMPONENT a shell drops into its top bar, next to
 * the menu the manifest builds, and the entry `notifications.feed` stays what
 * it is: the route the bell opens.
 *
 * ── The number is the feed's own, not a second read ───────────────────────
 *
 * `useUnreadCount()` subscribes to the same query key as the feed page
 * (`unread_count` rides the page envelope — stapel-notifications 0.18.0), so
 * the bell and an open feed share one cache entry and one request, and a mark-
 * read moves both in the same frame. A badge fed by an endpoint of its own
 * disagrees with the rows under it for a round trip, and the round trip it
 * disagrees on is the one right after somebody clears something.
 *
 * ── What it does while it does not know ───────────────────────────────────
 *
 * A failed read and a cleared inbox are both zero. The bell draws NOTHING
 * over the glyph in either case — it never invents a "0" badge and it never
 * shows a stale number — and its accessible name falls back to the plain
 * "Notifications" rather than claiming a count it does not have.
 */
import type { ReactElement } from "react";
import { Badge, Button, theme as antdTheme } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { matchLoad, useT } from "@stapel/core";
import { useUnreadCount } from "../model/queries.js";
import { NOTIFICATIONS_I18N_KEYS } from "../i18n/keys.js";
import { BellIcon } from "./icons.js";

/** Above this the badge reads "99+" — a four-digit count is not a number
 * anybody acts on, and it stops the badge from resizing the nav. */
const BADGE_OVERFLOW = 99;

export interface NotificationBellProps {
  /** Open the notifications page. A shell passes its own router push; without
   * it the bell is a display, not a control (see `href`). */
  readonly onOpen?: (() => void) | undefined;
  /**
   * Render as a link to this URL instead of a button — for a shell whose nav
   * is anchors. Ignored when `onOpen` is given.
   */
  readonly href?: string | undefined;
  /** Pin the theme side (a demo showing both). Defaults to the live mode. */
  readonly mode?: "light" | "dark";
}

export function NotificationBell(props: NotificationBellProps): ReactElement {
  return (
    // `surface="bare"`: a bell lives inside a bar the host already painted, so
    // this wrapper is here for the OTHER half of `SkinTheme` — the 44px phone
    // control floor. Un-wrapped, antd hands a nav bell a 32px hit box, which
    // is the size the fleet's visual pass measured and rejected.
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="bare"
      style={{ display: "inline-flex" }}
    >
      <BellControl {...props} />
    </SkinTheme>
  );
}

function BellControl(props: NotificationBellProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const unread = useUnreadCount();

  // Loading and failed both mean "no number to show" — see the header note.
  const count = matchLoad(unread, {
    loading: () => 0,
    failed: () => 0,
    ready: (n) => n,
  });

  const label =
    count > 0
      ? t(NOTIFICATIONS_I18N_KEYS.bellLabelUnread, { count })
      : t(NOTIFICATIONS_I18N_KEYS.bellLabel);

  return (
    <Badge
      count={count}
      overflowCount={BADGE_OVERFLOW}
      size="small"
      offset={[-6, 6]}
      color={token.colorError}
      data-testid="notification-bell-badge"
      data-unread={count > 0 ? "true" : "false"}
    >
      <Button
        type="text"
        shape="circle"
        // Icon-only: the count is IN the accessible name, so a screen reader
        // hears "Notifications, 3 unread" instead of a bell and a stray "3"
        // announced from the badge beside it.
        aria-label={label}
        data-testid="notification-bell"
        data-analytics="none"
        data-analytics-reason="navigation — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        {...(props.onOpen !== undefined
          ? { onClick: props.onOpen }
          : props.href !== undefined
            ? { href: props.href }
            : {})}
      >
        <BellIcon />
      </Button>
    </Badge>
  );
}
