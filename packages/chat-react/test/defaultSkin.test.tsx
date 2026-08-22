/**
 * The antd skin: that it renders each arm, that a switched-off control shows
 * its reason as READABLE TEXT (not a tooltip on a control that takes no
 * pointer events), and that it never prints a raw i18n key.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ConversationListPanel,
  ConversationThreadPanel,
  StartChatButton,
} from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import {
  BUYER,
  CONVERSATION_ID,
  conversation,
  conversationPage,
  errorEnvelope,
  messagePage,
} from "./fixtures.js";

/** Nothing on screen may look like `namespace.key.path`. */
function expectNoRawKeys(): void {
  const text = document.body.textContent ?? "";
  expect(text).not.toMatch(/\b(chat|error)\.[a-z_]+\.[a-z_.]+\b/);
}

describe("<ConversationListPanel/>", () => {
  it("renders rows with the server's unread badge", async () => {
    const server = mockServer({
      "GET /conversations": {
        body: conversationPage([conversation({ unread_count: 4 })]),
      },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationListPanel openHref={(id) => `/account/chat/${id}`} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(1)
    );
    expect(screen.getByText("Direct message").closest("a")).toHaveProperty(
      "href",
      expect.stringContaining(`/account/chat/${CONVERSATION_ID}`)
    );
    expect(screen.getByText("4")).toBeTruthy();
    expectNoRawKeys();
  });

  it("an outage renders the failure arm, not 'no conversations yet'", async () => {
    const server = mockServer({
      "GET /conversations": {
        status: 500,
        body: errorEnvelope("error.500.internal"),
      },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationListPanel />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("chat-conversation-list-error")).toBeTruthy()
    );
    expect(screen.queryByTestId("chat-conversation-list-empty")).toBeNull();
    // The sentence comes from the code the server sent (`error.500.internal`
    // in the generated registry), not from the transport's own
    // "Request failed with status 500".
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expectNoRawKeys();
  });

  it("an empty inbox renders the empty arm", async () => {
    const server = mockServer({
      "GET /conversations": { body: conversationPage([]) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationListPanel />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("chat-conversation-list-empty")).toBeTruthy()
    );
  });
});

describe("<ConversationThreadPanel/>", () => {
  it("renders the window, the transport label and the blocked composer reason", async () => {
    const server = mockServer({
      "GET /messages": { body: messagePage([2, 1]) },
      "POST /read": { body: {} },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getAllByTestId("chat-message")).toHaveLength(2));
    // Ascending by seq — the total order, not the timestamp.
    expect(
      screen.getAllByTestId("chat-message").map((n) => n.getAttribute("data-seq"))
    ).toEqual(["1", "2"]);

    // The transport is a LABEL; the screen above it did not branch on it.
    expect(screen.getByTestId("chat-transport").textContent).toBeTruthy();

    // The send button is off, and the reason is on screen as text.
    expect(screen.getByTestId("chat-composer-send")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("chat-composer-blocked").textContent).toBe(
      "Write something first."
    );
    expectNoRawKeys();
  });

  it("a failed read renders the failure arm and a retry", async () => {
    const server = mockServer({
      "GET /messages": {
        status: 403,
        body: errorEnvelope("error.403.chat_not_participant"),
      },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationThreadPanel conversationId={CONVERSATION_ID} />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getByTestId("chat-thread-error")).toBeTruthy());
    expect(screen.queryByTestId("chat-thread-empty")).toBeNull();
    expect(
      screen.getByText("You are not a participant of this conversation")
    ).toBeTruthy();
  });
});

describe("<StartChatButton/>", () => {
  it("states why it is off instead of going grey in silence", () => {
    const server = mockServer({});
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <StartChatButton sellerId={null} />
      </TestHarness>
    );
    expect(screen.getByTestId("chat-start-button")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("chat-start-blocked").textContent).toBe(
      "This listing has no seller to write to."
    );
    expectNoRawKeys();
  });

  it("is pressable when there is someone to write to", () => {
    const server = mockServer({});
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <StartChatButton sellerId="u-seller" viewerId={BUYER} />
      </TestHarness>
    );
    expect(screen.getByTestId("chat-start-button")).toHaveProperty("disabled", false);
    expect(screen.queryByTestId("chat-start-blocked")).toBeNull();
  });
});
