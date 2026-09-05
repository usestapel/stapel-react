/**
 * The antd skin: that it renders each arm, that a switched-off control shows
 * its reason as READABLE TEXT (not a tooltip on a control that takes no
 * pointer events), and that it never prints a raw i18n key.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  message,
  messagePage,
} from "./fixtures.js";

/** Nothing on screen may look like `namespace.key.path`. */
function expectNoRawKeys(): void {
  const text = document.body.textContent ?? "";
  expect(text).not.toMatch(/\b(chat|error)\.[a-z_]+\.[a-z_.]+\b/);
}

describe("<ConversationListPanel/>", () => {
  it("titles a row with the PERSON, links it, and keeps the unread badge", async () => {
    const server = mockServer({
      "GET /conversations": {
        body: conversationPage([conversation({ unread_count: 4 })]),
      },
    });
    render(
      <TestHarness
        server={server}
        realtime={{ socketUrl: null }}
        slots={{
          people: ({ userIds, children }) =>
            children({
              pending: false,
              lookup: (userId) =>
                userIds.includes(userId)
                  ? { userId, displayName: "Marta Kovács" }
                  : null,
            }),
        }}
      >
        <ConversationListPanel
          viewerId={BUYER}
          openHref={(id) => `/account/chat/${id}`}
        />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(1)
    );
    // The row is addressed to somebody. It used to be titled "Direct
    // message" — the conversation's KIND — which is the same sentence on
    // every row of every inbox.
    expect(screen.getByText("Marta Kovács").closest("a")).toHaveProperty(
      "href",
      expect.stringContaining(`/account/chat/${CONVERSATION_ID}`)
    );
    expect(screen.queryByText("Direct message")).toBeNull();
    expect(screen.getByText("4")).toBeTruthy();
    expectNoRawKeys();
  });

  it("the open conversation's row is marked selected — and only that row", async () => {
    const server = mockServer({
      "GET /conversations": {
        body: conversationPage([
          conversation({ id: "conv-a" }),
          conversation({ id: "conv-b" }),
        ]),
      },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationListPanel
          viewerId={BUYER}
          selectedId="conv-b"
          openHref={(id) => `/account/chat/${id}`}
        />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(2)
    );
    // The ATTRIBUTE, not the colour: the background is the theme's business
    // and asserting a resolved hex would pin a token value, not a behaviour.
    const rows = screen.getAllByTestId("chat-conversation-row");
    const selected = rows[1]?.closest('[aria-current="page"]');
    expect(selected).not.toBeNull();
    expect(selected?.hasAttribute("data-chat-row-selected")).toBe(true);
    expect(rows[0]?.closest('[aria-current="page"]')).toBeNull();
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("without a selectedId no row claims to be current", async () => {
    const server = mockServer({
      "GET /conversations": {
        body: conversationPage([conversation({ id: "conv-a" })]),
      },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationListPanel viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(1)
    );
    expect(document.querySelector("[aria-current]")).toBeNull();
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
    // But a DEGRADED transport says which degradation it is, in words: this
    // harness runs `socketUrl: null`, so the tag reads "no socket here",
    // not the bare "Refreshing every few seconds" that a person spent months
    // reading as a product decision.
    const tag = screen.getByTestId("chat-transport");
    expect(tag.getAttribute("data-degraded")).toBe("no_socket");
    expect(tag.textContent).toBe(
      "Live messages are off here — refreshing every few seconds instead."
    );

    // The send button is off because there is nothing to send — and that is
    // not an error state: an untouched box shows no refusal caption at all.
    expect(screen.getByTestId("chat-composer-send")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("chat-composer-input").getAttribute("data-pristine")).toBe(
      "true"
    );
    expect(screen.queryByTestId("chat-composer-blocked")).toBeNull();
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

describe("Enter sends (D35)", () => {
  // A hardware keyboard's Enter in a message box is "send" in every messenger
  // a person has ever used; the walker typed, hit Enter, and watched the text
  // sit in the field with a newline in it. Shift+Enter stays the newline —
  // the same split antd's own chat controls and every desktop messenger draw.
  async function threadWithMessage(): Promise<ReturnType<typeof mockServer>> {
    const server = mockServer({
      "GET /messages": { body: messagePage([1]) },
      "POST /read": { body: {} },
      "POST /messages": { status: 201, body: message(4, { body: "hello" }) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getAllByTestId("chat-message")).toHaveLength(1));
    return server;
  }

  it("plain Enter sends the trimmed draft", async () => {
    const server = await threadWithMessage();
    const input = screen.getByTestId("chat-composer-input");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(
        server.calls.filter(
          (c) => c.method === "POST" && c.url.includes("/messages")
        )
      ).toHaveLength(1)
    );
  });

  it("Shift+Enter is a newline, not a send", async () => {
    const server = await threadWithMessage();
    const input = screen.getByTestId("chat-composer-input");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    // Nothing to wait for: the assertion is that nothing happened.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      server.calls.filter(
        (c) => c.method === "POST" && c.url.includes("/messages")
      )
    ).toHaveLength(0);
  });

  it("Enter over an empty draft sends nothing — and says why", async () => {
    const server = await threadWithMessage();
    const input = screen.getByTestId("chat-composer-input");
    fireEvent.keyDown(input, { key: "Enter" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      server.calls.filter(
        (c) => c.method === "POST" && c.url.includes("/messages")
      )
    ).toHaveLength(0);
    // Asking and being refused is what puts the reason on screen; drawing the
    // field never was.
    expect(screen.getByTestId("chat-composer-blocked").textContent).toBe(
      "Write something first."
    );
  });
});

describe("the composer is pristine after a send, not empty-and-invalid", () => {
  it("drops the refusal caption again once the message has gone", async () => {
    const server = mockServer({
      "GET /messages": { body: messagePage([1]) },
      "POST /read": { body: {} },
      "POST /messages": { status: 201, body: message(4, { body: "hello" }) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getAllByTestId("chat-message")).toHaveLength(1));
    const input = screen.getByTestId("chat-composer-input");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(
        server.calls.filter((c) => c.method === "POST" && c.url.includes("/messages"))
      ).toHaveLength(1)
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("chat-composer-input").getAttribute("data-pristine")
      ).toBe("true")
    );
    expect(screen.queryByTestId("chat-composer-blocked")).toBeNull();
  });
});

describe("<ConversationThreadPanel renderSystemMessage> — whose vocabulary is it", () => {
  /**
   * A system line's body is written by whichever module wrote it, for a
   * reader that does not exist yet: the call surface posts
   * `video.call.ended:188` and this panel printed exactly that at a person,
   * in every language, under a "system message" label. The chat pair cannot
   * do better on its own — the vocabulary is another module's, and a table of
   * other modules' event names kept here would go stale the day it was
   * written — so the host, which knows what it installed, draws the sentence.
   */
  const SYSTEM_PAGE = {
    "GET /messages": {
      body: messagePage([1]),
    },
    "POST /read": { body: {} },
  };

  function systemRoutes(): Parameters<typeof mockServer>[0] {
    const page = messagePage([1]);
    return {
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
    };
  }

  it("prints the raw line when no host slot is passed — what it always did", async () => {
    render(
      <TestHarness server={mockServer(systemRoutes())} realtime={{ socketUrl: null }}>
        <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("chat-system-body")).toBeTruthy()
    );
    expect(screen.getByTestId("chat-system-body").textContent).toBe(
      "video.call.ended:188"
    );
  });

  it("draws the host's sentence in place of the line", async () => {
    const seen: string[] = [];
    render(
      <TestHarness server={mockServer(systemRoutes())} realtime={{ socketUrl: null }}>
        <ConversationThreadPanel
          conversationId={CONVERSATION_ID}
          viewerId={BUYER}
          renderSystemMessage={(message) => {
            seen.push(message.body);
            const [code, seconds] = message.body.split(":");
            if (code !== "video.call.ended") return undefined;
            const total = Number(seconds ?? 0);
            return `Call · ${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, "0")}`;
          }}
        />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("chat-system-body").textContent).toBe("Call · 3:08")
    );
    // Called with the ROW, not with a pre-chewed string: the seconds are in
    // the line and only the host knows what to do with them. (Asked once per
    // render of the row, which is a render concern; what matters is that it
    // is asked about THIS line and about nothing else.)
    expect(new Set(seen)).toEqual(new Set(["video.call.ended:188"]));
  });

  it("falls back to the body for a line the host does not recognise", async () => {
    render(
      <TestHarness server={mockServer(systemRoutes())} realtime={{ socketUrl: null }}>
        <ConversationThreadPanel
          conversationId={CONVERSATION_ID}
          viewerId={BUYER}
          renderSystemMessage={() => undefined}
        />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("chat-system-body").textContent).toBe(
        "video.call.ended:188"
      )
    );
  });

  it("is never asked about an ordinary message", async () => {
    const seen: string[] = [];
    render(
      <TestHarness server={mockServer(SYSTEM_PAGE)} realtime={{ socketUrl: null }}>
        <ConversationThreadPanel
          conversationId={CONVERSATION_ID}
          viewerId={BUYER}
          renderSystemMessage={(message) => {
            seen.push(message.body);
            return "should not appear";
          }}
        />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getAllByTestId("chat-message")).toHaveLength(1));
    expect(seen).toEqual([]);
    expect(screen.queryByText("should not appear")).toBeNull();
    expect(screen.queryByTestId("chat-system-body")).toBeNull();
  });
});
