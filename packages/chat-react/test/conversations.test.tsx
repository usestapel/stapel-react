/**
 * The inbox: three outcomes, the unread badge that must not read "0" during
 * an outage, and paging.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { matchList, matchLoad } from "@stapel/core";
import { ConversationList, chatInboxStream } from "../src/index.js";
import type { ConversationListBag, ChatRealtimeOptions } from "../src/index.js";
import {
  ChatServer,
  TestHarness,
  chatMessagePayload,
  installBrowserWebSocket,
  mockServer,
} from "./harness.js";
import type { BrowserWebSocketEnvironment, MockServer } from "./harness.js";
import {
  CONVERSATION_ID,
  conversation,
  conversationPage,
  errorEnvelope,
} from "./fixtures.js";

function renderList(routes: Parameters<typeof mockServer>[0]): {
  server: MockServer;
  bag: () => ConversationListBag;
} {
  const server = mockServer(routes);
  let latest: ConversationListBag | undefined;
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <ConversationList refreshIntervalMs={0}>
        {(bag) => {
          latest = bag;
          return (
            <div>
              {matchList(bag.state, {
                loading: () => <span data-testid="status">loading</span>,
                failed: () => <span data-testid="status">failed</span>,
                empty: () => <span data-testid="status">empty</span>,
                ready: (rows) => (
                  <span data-testid="status">{rows.map((r) => r.id).join(",")}</span>
                ),
              })}
              <span data-testid="unread">
                {matchLoad(bag.unreadTotal, {
                  loading: () => "…",
                  failed: () => "?",
                  ready: (total) => String(total),
                })}
              </span>
            </div>
          );
        }}
      </ConversationList>
    </TestHarness>
  );
  return {
    server,
    bag: () => {
      if (!latest) throw new Error("bag not rendered");
      return latest;
    },
  };
}

const status = (): string => screen.getByTestId("status").textContent ?? "";
const unread = (): string => screen.getByTestId("unread").textContent ?? "";

describe("the three outcomes of a read", () => {
  it("loading, then the rows, with the server's unread counts summed", async () => {
    renderList({
      "GET /conversations": {
        body: conversationPage([
          conversation({ id: "a", unread_count: 2 }),
          conversation({ id: "b", unread_count: 3 }),
        ]),
      },
    });
    expect(status()).toBe("loading");
    await waitFor(() => expect(status()).toBe("a,b"));
    expect(unread()).toBe("5");
  });

  it("an empty inbox is EMPTY", async () => {
    renderList({ "GET /conversations": { body: conversationPage([]) } });
    await waitFor(() => expect(status()).toBe("empty"));
    expect(unread()).toBe("0");
  });

  it("a failed read never renders a badge of 0", async () => {
    // The exact defect this pair's LoadState discipline exists for: a count
    // over a failed load is not zero, it is unknown.
    renderList({
      "GET /conversations": {
        status: 500,
        body: errorEnvelope("error.500.internal"),
      },
    });
    await waitFor(() => expect(status()).toBe("failed"));
    expect(unread()).toBe("?");
  });
});

describe("paging", () => {
  it("follows the anchor the server gave, and stops when it says so", async () => {
    const { server, bag } = renderList({
      "GET /conversations": (call) =>
        call.url.includes("anchor=")
          ? { body: conversationPage([conversation({ id: "b" })]) }
          : {
              body: conversationPage([conversation({ id: "a" })], {
                has_next: true,
                next_anchor: "2026-08-20T09:00:00Z",
              }),
            },
    });
    await waitFor(() => expect(status()).toBe("a"));
    expect(bag().hasNextPage).toBe(true);

    act(() => bag().fetchNextPage());
    await waitFor(() => expect(status()).toBe("a,b"));
    expect(bag().hasNextPage).toBe(false);
    expect(server.calls.some((c) => c.url.includes("anchor=2026-08-20"))).toBe(true);
  });
});

// ── the inbox socket ─────────────────────────────────────────────────────────
//
// `realtime/streams.ts` used to state, as a fact about the backend, that chat
// mounts no socket for the conversation list. `stapel_chat.routing` has
// mounted `ws/chat/inbox` since 0.4.0, and the list has polled ever since —
// "a chat which polls its inbox is a polling chat however live the open
// thread is" (the module's own words).

let env: BrowserWebSocketEnvironment;

beforeEach(() => {
  env = installBrowserWebSocket();
});

afterEach(() => {
  env.restore();
});

function renderInbox(options: {
  viewerId?: string | null;
  realtime?: ChatRealtimeOptions;
}): MockServer {
  const server = mockServer({
    "GET /conversations": { body: conversationPage([conversation({ id: "a" })]) },
  });
  render(
    <TestHarness server={server} realtime={options.realtime ?? { socketUrl: "wss://chat.test" }}>
      <ConversationList
        refreshIntervalMs={0}
        {...(options.viewerId !== undefined ? { viewerId: options.viewerId } : {})}
      >
        {(bag) => (
          <div>
            <span data-testid="transport">{bag.transport}</span>
            <span data-testid="degraded">{bag.degraded?.reason ?? "none"}</span>
          </div>
        )}
      </ConversationList>
    </TestHarness>
  );
  return server;
}

describe("the conversation list has a socket now", () => {
  it("subscribes to chat:user:<id> at ws/chat/inbox and goes live", async () => {
    renderInbox({ viewerId: "u-buyer" });
    await waitFor(() => expect(env.sockets.length).toBe(1));
    expect(env.last().url).toBe("wss://chat.test/ws/chat/inbox");
    const consumer = new ChatServer(env.last(), {
      stream: chatInboxStream("u-buyer").key,
      ephemeral: true,
    });
    act(() => {
      consumer.accept();
    });
    // An ephemeral welcome goes straight to live: no journal, no replay.
    await waitFor(() =>
      expect(screen.getByTestId("transport").textContent).toBe("socket")
    );
    expect(screen.getByTestId("degraded").textContent).toBe("none");
  });

  it("a chat.inbox signal refetches the list", async () => {
    const server = renderInbox({ viewerId: "u-buyer" });
    await waitFor(() => expect(env.sockets.length).toBe(1));
    const consumer = new ChatServer(env.last(), {
      stream: chatInboxStream("u-buyer").key,
      ephemeral: true,
    });
    act(() => {
      consumer.accept();
    });
    await waitFor(() =>
      expect(screen.getByTestId("transport").textContent).toBe("socket")
    );
    const before = server.calls.length;

    act(() => {
      consumer.signal("chat.inbox", {
        conversation_id: CONVERSATION_ID,
        conversation_kind: "direct",
        last_seq: 9,
        message: chatMessagePayload({ seq: 9, conversationId: CONVERSATION_ID }),
      });
    });

    await waitFor(() => expect(server.calls.length).toBeGreaterThan(before));
  });

  it("without a viewer id there is no key to subscribe under, and it SAYS so", async () => {
    // The stream key is `chat:user:<id>` and the server derives it from the
    // authenticated scope. A guessed id opens a socket that delivers nothing,
    // silently — so the pair asks, and names the gap when it is not told.
    renderInbox({ viewerId: null });
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("no_socket")
    );
    expect(env.sockets).toHaveLength(0);
  });
});
