/**
 * THE WHOLE ROW OPENS THE THREAD (D65, desktop walker P2).
 *
 * The inbox row is ~300×80px of avatar, name, subject, preview and clock —
 * and only the small name button opened anything. Clicking the preview text,
 * the subject or the empty space did nothing at all: a target of 60×20 inside
 * a row that looks like one control. On a phone that is the difference
 * between an inbox and a puzzle.
 *
 * So the row itself is the control. Asserted through BEHAVIOUR — a click on
 * the preview line opens the thread — rather than through markup, because
 * "the row is a link" has more than one right implementation.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ConversationListPanel,
  ROW_OPEN_CLASS,
  conversationRowCss,
} from "../src/default/index.js";
import type { Conversation } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, conversation, conversationPage } from "./fixtures.js";

const SELLER_ID = "u-anna";

function oneConversation(): readonly Conversation[] {
  return [
    conversation({
      id: "c-anna",
      unread_count: 0,
      updated_at: "2026-08-21T10:00:00Z",
      participants: [
        { user_id: BUYER, role: "member", last_read_seq: 0 },
        { user_id: SELLER_ID, role: "member", last_read_seq: 0 },
      ],
    }),
  ];
}

function renderInbox(onOpen: (id: string) => void) {
  const server = mockServer({
    "GET /conversations": { body: conversationPage(oneConversation()) },
  });
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <ConversationListPanel viewerId={BUYER} onOpen={onOpen} />
    </TestHarness>
  );
}

describe("a conversation row is one control, not a small button inside a big box", () => {
  it("opens the thread when the row body — not the name — is clicked", async () => {
    const opened = vi.fn();
    renderInbox(opened);
    const row = await screen.findByTestId("chat-conversation-row");
    // The clock: as far from the name button as a click inside this row gets.
    const anywhere = row.querySelector("[data-chat-row-clock]") ?? row;
    fireEvent.click(anywhere);
    await waitFor(() => expect(opened).toHaveBeenCalledWith("c-anna"));
  });

  it("the row is reachable and operable from the keyboard as one control", async () => {
    const opened = vi.fn();
    renderInbox(opened);
    const row = await screen.findByTestId("chat-conversation-row");
    const control = row.closest("[data-chat-row-open]") ?? row;
    // A control the keyboard can land on: an anchor/button, or something
    // carrying an explicit tabindex and role.
    const tag = control.tagName.toLowerCase();
    const focusable =
      tag === "a" ||
      tag === "button" ||
      control.getAttribute("tabindex") !== null;
    expect(focusable).toBe(true);
    fireEvent.keyDown(control, { key: "Enter" });
    await waitFor(() => expect(opened).toHaveBeenCalledWith("c-anna"));
  });

  it("the control that IS the row shows a focus ring", async () => {
    // D181. D65 made the whole row the control by wrapping it in an element
    // styled `color: inherit; text-decoration: none` — a hit area with no
    // chrome. What went with the chrome was the ring: a keyboard walk of the
    // live inbox landed here and measured `outline-style: none`, no
    // box-shadow, so a person tabbing their conversations could not see which
    // one Enter would open. The largest focus target on the screen was the
    // one with nothing to show for it.
    const opened = vi.fn();
    renderInbox(opened);
    const row = await screen.findByTestId("chat-conversation-row");
    const control = row.closest("[data-chat-row-open]");
    expect(control).not.toBeNull();
    expect(control?.className).toContain(ROW_OPEN_CLASS);
    // The rule itself, since jsdom paints no :focus-visible.
    const css = conversationRowCss();
    expect(css).toContain(`.${ROW_OPEN_CLASS}:focus-visible{outline:`);
    expect(css).toContain("var(--stapel-focus-ring)");
  });

  it("an href row still renders a real anchor over the whole row — right-clickable", async () => {
    const server = mockServer({
      "GET /conversations": { body: conversationPage(oneConversation()) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationListPanel viewerId={BUYER} openHref={(id) => `/chat/${id}`} />
      </TestHarness>
    );
    const row = await screen.findByTestId("chat-conversation-row");
    const anchor = row.closest("a") ?? row.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("href")).toBe("/chat/c-anna");
    // And it covers the row, rather than wrapping the name alone.
    expect(anchor?.textContent ?? "").toContain("21");
  });
});
