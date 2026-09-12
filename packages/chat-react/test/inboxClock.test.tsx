/**
 * THE CLOCK ON AN INBOX ROW IS A FIXED CELL, SO WHAT IT SAYS HAS A PRICE.
 *
 * The defect these tests pin: the cell rendered `dateStyle: "short",
 * timeStyle: "short"` — "11.09.2026, 22:52" in Russian — and `ListRow`'s
 * trailing cell is `flex: none`, so all seventeen characters came off the
 * name beside it. A 360px row for a workshop's three-word trading name read
 * its first two letters and an ellipsis, and the year it spent the name on is
 * the one fact a person reading an inbox already knows.
 *
 * Three arms, one per thing that can distinguish a row: the TIME when the row
 * is today's, the DAY when it is this year's, the DATE when it is older. Each
 * is asserted against a HELD `now`, because a suite that cannot move the clock
 * cannot tell the first arm from the second — the whole of what this decides.
 *
 * The fourth test is the seam: a deployment whose inbox wants "2 hours ago"
 * passes `formatTime` and the pair asks it instead, with the stamp, the locale
 * and the moment — so a host never has to re-derive the first two.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationListPanel, inboxClock } from "../src/default/index.js";
import type { Conversation } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, conversation, conversationPage } from "./fixtures.js";

/** The moment every test below is read at: a Friday evening in 2026. */
const NOW = new Date("2026-09-11T20:00:00Z");

function rowAt(updatedAt: string): readonly Conversation[] {
  return [conversation({ id: "c-1", unread_count: 0, updated_at: updatedAt })];
}

async function clockText(
  updatedAt: string,
  panelProps: Partial<Parameters<typeof ConversationListPanel>[0]> = {}
): Promise<string> {
  const server = mockServer({
    "GET /conversations": { body: conversationPage(rowAt(updatedAt)) },
  });
  const { container } = render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <ConversationListPanel viewerId={BUYER} {...panelProps} />
    </TestHarness>
  );
  await waitFor(() => expect(screen.getByTestId("chat-conversation-row")).toBeTruthy());
  const cell = container.querySelector("[data-chat-row-clock]");
  expect(cell).toBeTruthy();
  return cell?.textContent ?? "";
}

describe("inboxClock — what the cell says, and when", () => {
  it("today: the time alone, no date at all", () => {
    // 18:30 local on the same calendar day as `NOW`.
    const today = new Date(NOW);
    today.setHours(18, 30, 0, 0);
    const said = inboxClock(today.toISOString(), "en-GB", NOW);
    expect(said).toBe("18:30");
    // The claim, stated as the property rather than the string: nothing in
    // this arm names a day, a month or a year.
    expect(said).not.toMatch(/2026|09|Sep/);
  });

  it("this year: a day and a short month, no year and no time", () => {
    const earlier = new Date(NOW);
    earlier.setMonth(2, 4);
    earlier.setHours(9, 5, 0, 0);
    const said = inboxClock(earlier.toISOString(), "en-GB", NOW);
    expect(said).toBe("4 Mar");
    expect(said).not.toMatch(/2026/);
    expect(said).not.toMatch(/09:05|9:05/);
  });

  it("older: the short date, where the year is the fact", () => {
    const said = inboxClock("2024-03-04T09:05:00Z", "en-GB", NOW);
    // `dateStyle: "short"` — the locale's own order and separators.
    expect(said).toBe(
      new Intl.DateTimeFormat("en-GB", { dateStyle: "short" }).format(
        Date.parse("2024-03-04T09:05:00Z")
      )
    );
    expect(said).toMatch(/24/);
  });

  it("is the reader's locale, not a format this pair wrote", () => {
    const earlier = new Date(NOW);
    earlier.setMonth(2, 4);
    // Russian names its months in the genitive and abbreviates them its own
    // way: a hand-rolled `"4 Mar"` would be wrong here, `Intl` is not.
    expect(inboxClock(earlier.toISOString(), "ru", NOW)).toBe(
      new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" }).format(earlier)
    );
  });

  it("an unparseable stamp draws nothing rather than 'Invalid Date'", () => {
    expect(inboxClock("not-a-date", "en-GB", NOW)).toBe("");
  });
});

describe("the row draws the clock the default decides", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a row from today shows a time and NOT a full timestamp", async () => {
    const today = new Date(NOW);
    today.setHours(18, 30, 0, 0);
    const said = await clockText(today.toISOString());
    expect(said).toBe(inboxClock(today.toISOString(), "en", NOW));
    // The defect, stated: the cell no longer carries a four-digit year.
    expect(said).not.toMatch(/2026/);
  });

  it("a row from an earlier year shows a short date, not a stamp with a time", async () => {
    const said = await clockText("2024-03-04T09:05:00Z");
    expect(said).toBe(inboxClock("2024-03-04T09:05:00Z", "en", NOW));
    expect(said).not.toMatch(/:/);
  });

  it("the cell does not grow: it is the row's fixed trailing column", async () => {
    const server = mockServer({
      "GET /conversations": {
        body: conversationPage(rowAt("2026-09-11T18:30:00Z")),
      },
    });
    const { container } = render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationListPanel viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getByTestId("chat-conversation-row")).toBeTruthy());
    // Why the format is the fix and a width is not: the clock's column takes
    // exactly what it asks for and every pixel of it comes off the name.
    const cell = container
      .querySelector("[data-chat-row-clock]")
      ?.closest<HTMLElement>("[data-stapel-list-row-trailing]");
    expect(cell).toBeTruthy();
    // `flex: none` as written, which is `0 0 auto` once a UA expands it.
    expect(cell?.style.flex).toBe("0 0 auto");
  });

  it("a host's own formatter wins, and is handed the stamp, the locale and now", async () => {
    const seen: { iso?: string; locale?: string; now?: number } = {};
    const said = await clockText("2026-09-11T18:30:00Z", {
      formatTime: (iso, locale, now) => {
        seen.iso = iso;
        seen.locale = locale;
        seen.now = now.getTime();
        return "2 hours ago";
      },
    });
    expect(said).toBe("2 hours ago");
    expect(seen.iso).toBe("2026-09-11T18:30:00Z");
    expect(seen.locale).toBe("en");
    // The moment the row was DRAWN, not a constant the pair captured on mount
    // — a held clock that never moves is how "today" survives midnight.
    expect(Math.abs((seen.now ?? 0) - NOW.getTime())).toBeLessThan(5000);
  });
});
