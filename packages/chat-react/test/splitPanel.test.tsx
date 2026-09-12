/**
 * The desktop split inbox: list beside thread, one screen.
 *
 * The defect this arrangement exists for was measured on a wide desktop
 * viewport of a live classified deployment: the thread page was ONE
 * full-width lane — a composer stretched to 1230px, a reader's own bubbles a
 * screen away from their avatar — and no conversation list beside it, where
 * the reference design for a desktop inbox is two panes. These tests assert
 * the composition, not the geometry: which pane renders in which state, and
 * that the pass-throughs actually reach the thread.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversationSplitPanel } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import {
  BUYER,
  CONVERSATION_ID,
  conversation,
  conversationPage,
  messagePage,
} from "./fixtures.js";

describe("<ConversationSplitPanel/>", () => {
  it("with nothing selected: the list, and a quiet empty state instead of a thread", async () => {
    const server = mockServer({
      "GET /conversations": { body: conversationPage([conversation()]) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationSplitPanel viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(1)
    );
    expect(screen.getByTestId("chat-split-empty")).toBeTruthy();
    expect(screen.getByText("Pick a conversation")).toBeTruthy();
    expect(screen.queryByTestId("chat-thread")).toBeNull();
  });

  it("with a selection: the list stays, the thread mounts, the empty state goes", async () => {
    const server = mockServer({
      // Declaration order is match order, and the messages URL CONTAINS
      // `/conversations/<id>/` — so the more specific route goes first.
      "GET /messages": { body: messagePage([2, 1]) },
      "POST /read": { body: {} },
      "GET /conversations": { body: conversationPage([conversation()]) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationSplitPanel
          viewerId={BUYER}
          selectedId={CONVERSATION_ID}
          limit={5}
          maxLength={500}
        />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getAllByTestId("chat-message")).toHaveLength(2));
    expect(screen.getByTestId("chat-conversation-list")).toBeTruthy();
    expect(screen.getByTestId("chat-thread")).toBeTruthy();
    expect(screen.queryByTestId("chat-split-empty")).toBeNull();

    // The pass-throughs REACH the thread, on the wire and on the screen:
    // `limit` rides the messages query, `maxLength` is the composer's counter.
    expect(
      server.calls.some(
        (c) => c.url.includes("/messages") && c.url.includes("limit=5")
      )
    ).toBe(true);
    expect(screen.getByText("0/500")).toBeTruthy();
  });

  it("forwards the header-actions slot, so the desktop thread can host a call button", async () => {
    // The slot existed on `<ConversationThreadPanel>` and this arrangement
    // mounts that panel itself, so a host taking the desktop split had no way
    // to pass one: the same deployment grew a call button on the phone's
    // thread screen and had none beside the desktop thread.
    const server = mockServer({
      "GET /messages": { body: messagePage([2, 1]) },
      "POST /read": { body: {} },
      "GET /conversations": { body: conversationPage([conversation()]) },
    });
    const seen: { conversationId: string; counterpartyId: string | null }[] = [];
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationSplitPanel
          viewerId={BUYER}
          selectedId={CONVERSATION_ID}
          renderHeaderActions={(context) => {
            seen.push({
              conversationId: context.conversationId,
              counterpartyId: context.counterpartyId,
            });
            return <button type="button" data-testid="host-call">Call</button>;
          }}
        />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getByTestId("host-call")).toBeTruthy());
    // The slot is told the same context the phone's thread screen tells it —
    // the open thread, and the ONE other person in it.
    expect(seen[0]?.conversationId).toBe(CONVERSATION_ID);
    expect(seen.every((c) => c.conversationId === CONVERSATION_ID)).toBe(true);
  });

  it("mounts nothing extra in the header when no host slot is passed", async () => {
    const server = mockServer({
      "GET /messages": { body: messagePage([2, 1]) },
      "POST /read": { body: {} },
      "GET /conversations": { body: conversationPage([conversation()]) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationSplitPanel viewerId={BUYER} selectedId={CONVERSATION_ID} />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getByTestId("chat-thread")).toBeTruthy());
    expect(screen.queryByTestId("host-call")).toBeNull();
  });

  it("forwards the system-line slot too, so a desktop thread says «Call · 3:08»", async () => {
    const page = messagePage([1]);
    const server = mockServer({
      "GET /messages": {
        body: {
          ...page,
          items: page.items.map((row) => ({
            ...row,
            kind: "system",
            sender_id: null,
            body: "video.call.ended:188",
          })),
        },
      },
      "POST /read": { body: {} },
      "GET /conversations": { body: conversationPage([conversation()]) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationSplitPanel
          viewerId={BUYER}
          selectedId={CONVERSATION_ID}
          renderSystemMessage={(message) =>
            message.body.startsWith("video.call.ended") ? "Call · 3:08" : undefined
          }
        />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("chat-system-body").textContent).toBe("Call · 3:08")
    );
  });

  it("a host-supplied empty node replaces the default one", async () => {
    const server = mockServer({
      "GET /conversations": { body: conversationPage([conversation()]) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationSplitPanel
          viewerId={BUYER}
          empty={<div data-testid="host-empty">nothing open</div>}
        />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(1)
    );
    expect(screen.getByTestId("host-empty")).toBeTruthy();
    expect(screen.queryByTestId("chat-split-empty")).toBeNull();
  });
});

/**
 * THE LIST RAIL'S MEASURE.
 *
 * A six-width walk of a client storefront read the desktop inbox at 1440: a
 * 360px rail beside 1040px of empty thread pane, and inside the rail a 49px
 * avatar, a 130px clock and a row menu left ~70px for the name, so a
 * 22-character shop name arrived as its first five letters. The rail was a
 * constant; the window is not.
 *
 * jsdom resolves no `clamp()`, so what is asserted is the TRACK the grid
 * declares — which is the fact a host reads and the one a fixed rail got
 * wrong.
 */
describe("the split's list rail", () => {
  async function mountSplit(
    listWidth?: number | string
  ): Promise<HTMLElement> {
    const server = mockServer({
      "GET /conversations": { body: conversationPage([conversation()]) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationSplitPanel
          viewerId={BUYER}
          {...(listWidth !== undefined ? { listWidth } : {})}
        />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(1)
    );
    return screen.getByTestId("chat-split");
  }

  it("is a proportion with a floor and a ceiling, not a constant", async () => {
    const split = await mountSplit();
    const columns = split.style.gridTemplateColumns;
    // The floor is the rail the reference designed; the ceiling stops a 2560px
    // screen spending a third of itself on previews; between them the rail
    // grows with the window, which is where the clipped names were.
    expect(columns).toBe("clamp(360px, 32%, 480px) minmax(0, 1fr)");
  });

  it("takes a host's own width — pixels as a number, any CSS length as a string", async () => {
    const numeric = await mountSplit(420);
    expect(numeric.style.gridTemplateColumns).toBe("420px minmax(0, 1fr)");
    cleanup();

    const written = await mountSplit("28rem");
    expect(written.style.gridTemplateColumns).toBe("28rem minmax(0, 1fr)");
  });

  it("keeps the thread side elastic whatever the rail is", async () => {
    // `minmax(0, 1fr)` and not a bare `1fr`: the second is `minmax(auto, 1fr)`
    // and one long unbroken preview would widen the whole grid.
    for (const width of [undefined, 420, "28rem"] as const) {
      const split = await mountSplit(width);
      expect(split.style.gridTemplateColumns.endsWith("minmax(0, 1fr)")).toBe(
        true
      );
      cleanup();
    }
  });
});

/**
 * THE ROW INSIDE THE RAIL: which half of it gives way.
 *
 * The 360px reading (two glyphs of the name beside a clock at its full
 * measure) is the same arithmetic as the 1440 one, and the row's own rule is
 * what has to hold in both: the clock never grows, the name is the elastic
 * half and it TRUNCATES rather than taking the row wider than the rail.
 */
describe("a conversation row's name and its clock", () => {
  it("gives the clock its own cell and the name the elastic one", async () => {
    const server = mockServer({
      "GET /conversations": { body: conversationPage([conversation()]) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationSplitPanel viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(1)
    );
    const row = screen.getByTestId("chat-row-body");
    // The text column is the ONLY track that grows or shrinks: `minmax(0,
    // 1fr)` has no floor of its own, so a long name is absorbed there and
    // takes no width from the clock — and none of it from the row either.
    expect(row.style.gridTemplateColumns).toContain("minmax(0, 1fr)");
    const clockCell = row.querySelector<HTMLElement>(
      "[data-stapel-list-row-trailing]"
    );
    expect(clockCell).not.toBeNull();
    // The clock's cell is `auto` — it never grows into the name's width.
    expect((clockCell as HTMLElement).style.flex).toBe("0 0 auto");
    // And the clock itself is one line: a wrapped date in a rail this narrow
    // reads as two rows.
    const clock = row.querySelector<HTMLElement>("[data-chat-row-clock]");
    expect(clock).not.toBeNull();
    expect((clock as HTMLElement).style.whiteSpace).toBe("nowrap");
    // The name truncates rather than wrapping the row taller or wider.
    const title = row.querySelector<HTMLElement>(
      "[data-stapel-list-row-text] .ant-typography"
    );
    expect(title).not.toBeNull();
    expect((title as HTMLElement).style.textOverflow).toBe("ellipsis");
    expect((title as HTMLElement).style.minWidth).toBe("0");
  });
});
