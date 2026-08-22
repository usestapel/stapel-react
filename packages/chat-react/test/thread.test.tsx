/**
 * The thread's three load outcomes, its backfill, and its read marker.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { matchList } from "@stapel/core";
import { ConversationThread } from "../src/index.js";
import type { ConversationThreadBag } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { CONVERSATION_ID, errorEnvelope, messagePage } from "./fixtures.js";

function renderThread(
  routes: Parameters<typeof mockServer>[0],
  props: { autoMarkRead?: boolean } = {}
): { server: MockServer; bag: () => ConversationThreadBag } {
  const server = mockServer(routes);
  let latest: ConversationThreadBag | undefined;
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <ConversationThread
        conversationId={CONVERSATION_ID}
        refreshIntervalMs={0}
        autoMarkRead={props.autoMarkRead ?? false}
      >
        {(bag) => {
          latest = bag;
          return (
            <div>
              {matchList(bag.state, {
                loading: () => <span data-testid="status">loading</span>,
                failed: () => <span data-testid="status">failed</span>,
                empty: () => <span data-testid="status">empty</span>,
                ready: (messages) => (
                  <span data-testid="status">{messages.map((m) => m.seq).join(",")}</span>
                ),
              })}
            </div>
          );
        }}
      </ConversationThread>
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

describe("the three outcomes of a read", () => {
  it("loading, then the window", async () => {
    renderThread({ "GET /messages": { body: messagePage([3, 2, 1]) } });
    expect(status()).toBe("loading");
    await waitFor(() => expect(status()).toBe("1,2,3"));
  });

  it("a thread with no messages is EMPTY, not missing", async () => {
    renderThread({ "GET /messages": { body: messagePage([]) } });
    await waitFor(() => expect(status()).toBe("empty"));
  });

  it("a refusal is FAILED — never an empty thread", async () => {
    renderThread({
      "GET /messages": {
        status: 403,
        body: errorEnvelope("error.403.chat_not_participant"),
      },
    });
    await waitFor(() => expect(status()).toBe("failed"));
    // The distinction the whole LoadState discipline exists for: this is not
    // "say hello, there are no messages yet".
    expect(screen.queryByText("empty")).toBeNull();
  });
});

describe("backfill", () => {
  it("pages older history onto the front, by the anchor the server gave", async () => {
    const { server, bag } = renderThread({
      "GET /messages": (call) =>
        call.url.includes("anchor=3")
          ? { body: messagePage([2, 1], { has_next: false, next_anchor: null }) }
          : {
              body: messagePage([5, 4, 3], { has_next: true, next_anchor: "3" }),
            },
    });
    await waitFor(() => expect(status()).toBe("3,4,5"));
    expect(bag().hasOlder).toBe(true);

    act(() => bag().loadOlder());
    await waitFor(() => expect(status()).toBe("1,2,3,4,5"));
    expect(bag().hasOlder).toBe(false);

    const backfill = server.calls.filter((c) => c.url.includes("direction=next"));
    expect(backfill[0]?.url).toContain("anchor=3");
  });

  it("does nothing when there is nothing older", async () => {
    const { server, bag } = renderThread({
      "GET /messages": { body: messagePage([2, 1]) },
    });
    await waitFor(() => expect(status()).toBe("1,2"));
    const before = server.calls.length;
    act(() => bag().loadOlder());
    await waitFor(() => expect(bag().isLoadingOlder).toBe(false));
    expect(server.calls.length).toBe(before);
  });
});

describe("the read marker", () => {
  it("advances to the tip once, and never sends a lower value again", async () => {
    const { server, bag } = renderThread(
      {
        "POST /read": { body: {} },
        "GET /messages": (call) =>
          call.url.includes("direction=prev")
            ? { body: messagePage([], { direction: "prev" }) }
            : { body: messagePage([3, 2, 1]) },
      },
      { autoMarkRead: true }
    );
    await waitFor(() => expect(status()).toBe("1,2,3"));
    await waitFor(() =>
      expect(server.calls.filter((c) => c.url.includes("/read"))).toHaveLength(1)
    );
    expect(server.calls.find((c) => c.url.includes("/read"))?.body).toEqual({
      upto_seq: 3,
    });

    // A refetch that finds nothing new must not re-report the same marker.
    act(() => bag().refetch());
    await waitFor(() => expect(status()).toBe("1,2,3"));
    expect(server.calls.filter((c) => c.url.includes("/read"))).toHaveLength(1);
  });

  it("is not sent at all for an empty thread — there is no seq 0", async () => {
    const { server } = renderThread(
      { "GET /messages": { body: messagePage([]) }, "POST /read": { body: {} } },
      { autoMarkRead: true }
    );
    await waitFor(() => expect(status()).toBe("empty"));
    expect(server.calls.filter((c) => c.url.includes("/read"))).toHaveLength(0);
  });
});
