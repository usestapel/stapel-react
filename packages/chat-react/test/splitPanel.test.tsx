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
import { render, screen, waitFor } from "@testing-library/react";
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
