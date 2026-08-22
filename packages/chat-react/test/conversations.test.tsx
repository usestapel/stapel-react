/**
 * The inbox: three outcomes, the unread badge that must not read "0" during
 * an outage, and paging.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { matchList, matchLoad } from "@stapel/core";
import { ConversationList } from "../src/index.js";
import type { ConversationListBag } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { conversation, conversationPage, errorEnvelope } from "./fixtures.js";

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
