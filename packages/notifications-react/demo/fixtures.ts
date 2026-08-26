/**
 * Canned server state the skin demos are SEEDED with.
 *
 * Kept out of the demo files because three of them need the same rows, and
 * because a fixture that is shared is a fixture that can be told apart: the
 * variant-distinctness guard fails a demo whose variants render identical
 * markup, so "phone" and "desktop" here deliberately carry different rows
 * rather than the same list at two widths.
 */
import type { DeviceListItem, FeedItem, NotificationFeedPage } from "../src/index.js";

/** The instant every relative time in the demos is measured against, so a
 * screenshot taken next month still says "2 days ago". */
export const DEMO_NOW: Date = new Date("2026-03-19T10:30:00Z");

/** The push token the demo device "holds" — its SHA-256 is the fingerprint on
 * {@link DEMO_THIS_DEVICE}, which is how the toggle finds its own row. */
export const DEMO_TOKEN = "demo-web-push-token";

/**
 * The rows, NEWEST FIRST — the order `GET /feed/` documents ("ordered by
 * created_at desc") and therefore the only order a fixture standing in for it
 * may use. The previous order put a two-day-old row above a ninety-minute-old
 * one, which the visual pass read as a sort bug in the skin: a fixture that
 * contradicts its own endpoint makes the screen lie about the component.
 */
const FEED_ITEMS: readonly FeedItem[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    notification_type: "new_message",
    title: "New message from Ada",
    body: "Is the bike still available?",
    data: { chat_url: "https://example.test/chat/17" },
    created_at: "2026-03-19T08:55:00Z",
    read_at: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    notification_type: "listing_blocked",
    title: "Your listing has been blocked",
    body: "“Vintage road bike” was blocked for guideline violations.",
    data: { listing_url: "https://example.test/listings/9" },
    created_at: "2026-03-17T10:30:00Z",
    read_at: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    notification_type: "new_device_login",
    title: "New sign-in from a Mac",
    body: "If this wasn't you, review your sessions.",
    data: {},
    created_at: "2026-03-12T21:04:00Z",
    read_at: "2026-03-13T07:15:00Z",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    notification_type: "workspace.invitation",
    title: "You've been invited to Studio",
    body: "Grace invited you as an editor.",
    data: {},
    created_at: "2026-02-25T09:00:00Z",
    read_at: "2026-02-25T09:41:00Z",
  },
];

/** Every row read, at a plausible instant — the "all caught up" fixture. */
function allRead(items: readonly FeedItem[]): readonly FeedItem[] {
  return items.map((item) => ({ ...item, read_at: item.read_at ?? "2026-03-19T09:10:00Z" }));
}

/**
 * A page envelope. `unread_count` is counted over the WHOLE feed on the wire,
 * and every fixture here is one page, so counting the rows is the honest
 * value — a fixture whose badge disagreed with its own rows would document a
 * bug the component does not have.
 */
function page(items: readonly FeedItem[], more = false): NotificationFeedPage {
  return {
    items: [...items],
    next_anchor: more ? "anchor-2" : null,
    prev_anchor: null,
    has_next: more,
    has_prev: false,
    count: items.length,
    unread_count: items.filter((item) => item.read_at == null).length,
  };
}

/** Two rows, both unread and both with a deep link — the phone story. */
export const DEMO_FEED_SHORT: readonly NotificationFeedPage[] = [
  page(FEED_ITEMS.slice(0, 2)),
];

/** Four rows and another page behind them — the desktop story. Two unread at
 * the top, two already read below: the row anatomy's whole point is that the
 * difference is visible without reading either. */
export const DEMO_FEED_LONG: readonly NotificationFeedPage[] = [
  page(FEED_ITEMS, true),
];

/** The same four rows with nothing left unread: the badge is gone, and "Mark
 * all as read" is off with the sentence that says why. */
export const DEMO_FEED_ALL_READ: readonly NotificationFeedPage[] = [
  page(allRead(FEED_ITEMS)),
];

/** A feed that was read and had nothing. */
export const DEMO_FEED_EMPTY: readonly NotificationFeedPage[] = [page([])];

/**
 * A one-page feed carrying a chosen badge value — for the bell, whose whole
 * subject is the number.
 *
 * `unread_count` is deliberately allowed to exceed the rows on the page: on
 * the wire it counts the WHOLE feed, so "128 unread, four of them on this
 * page" is exactly what a real first page of a busy account looks like, and a
 * fixture that capped it at the page size could not photograph the `99+`
 * overflow at all.
 */
export function demoFeedWithUnread(unread: number): readonly NotificationFeedPage[] {
  const items = unread === 0 ? allRead(FEED_ITEMS) : FEED_ITEMS;
  return [{ ...page(items), unread_count: unread }];
}

/** The device this browser is; its fingerprint is SHA-256 of {@link DEMO_TOKEN}. */
export const DEMO_THIS_DEVICE: DeviceListItem = {
  id: 42,
  token_fingerprint:
    "ec1219f14b70736feaf02baa9f264040b5077f61d6112dd90bed488df681f838",
  platform: "web",
  is_active: true,
  created_at: "2026-03-17T10:30:00Z",
  last_seen: "2026-03-18T08:02:11Z",
};

/** An old phone whose token the push provider has since rejected — listed and
 * flagged, because hiding it would render the toggle as if it were delivering. */
export const DEMO_OLD_PHONE: DeviceListItem = {
  id: 7,
  token_fingerprint: "f".repeat(64),
  platform: "android",
  is_active: false,
  created_at: "2026-01-02T10:30:00Z",
  last_seen: "2026-01-09T08:02:11Z",
};

/** A second, healthy device — the reason the registry is worth drawing at all. */
export const DEMO_TABLET: DeviceListItem = {
  id: 11,
  token_fingerprint: "a".repeat(64),
  platform: "ios",
  is_active: true,
  created_at: "2026-02-11T10:30:00Z",
  last_seen: "2026-03-18T19:40:00Z",
};

/** The token this device already holds, without prompting. */
export function demoHeldToken(): Promise<string | null> {
  return Promise.resolve(DEMO_TOKEN);
}

/** Mint a token (the real one prompts; this one does not). */
export function demoMintToken(): Promise<string> {
  return Promise.resolve(DEMO_TOKEN);
}
