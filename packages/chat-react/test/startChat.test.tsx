/**
 * "Message the seller": the get-or-create the module guarantees, and the two
 * refusals that must be readable rather than grey.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useActionGate } from "@stapel/core";
import { StartDirectChat } from "../src/index.js";
import type { Conversation, StartDirectChatBag } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { BUYER, SELLER, conversation } from "./fixtures.js";

function Screen(props: {
  bag: StartDirectChatBag;
  onBag: (bag: StartDirectChatBag) => void;
}): React.ReactElement {
  const gate = useActionGate(props.bag.availability);
  props.onBag(props.bag);
  return (
    <div>
      <span data-testid="reason">{gate.reason ?? ""}</span>
      <span data-testid="disabled">{String(gate.disabled)}</span>
      <span data-testid="opened">{props.bag.conversation?.id ?? ""}</span>
    </div>
  );
}

function renderStart(options: {
  sellerId: string | null;
  viewerId?: string;
  routes?: Parameters<typeof mockServer>[0];
  onOpened?: (conversation: Conversation) => void;
}): { server: MockServer; bag: () => StartDirectChatBag } {
  const server = mockServer(options.routes ?? {});
  let latest: StartDirectChatBag | undefined;
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <StartDirectChat
        sellerId={options.sellerId}
        {...(options.viewerId !== undefined ? { viewerId: options.viewerId } : {})}
        {...(options.onOpened !== undefined ? { onOpened: options.onOpened } : {})}
      >
        {(bag) => (
          <Screen
            bag={bag}
            onBag={(b) => {
              latest = b;
            }}
          />
        )}
      </StartDirectChat>
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

describe("the refusals are readable", () => {
  it("a listing with no seller says so", () => {
    renderStart({ sellerId: null });
    expect(screen.getByTestId("disabled").textContent).toBe("true");
    expect(screen.getByTestId("reason").textContent).toBe(
      "This listing has no seller to write to."
    );
  });

  it("your own listing says so", () => {
    renderStart({ sellerId: BUYER, viewerId: BUYER });
    expect(screen.getByTestId("reason").textContent).toBe("This is your own listing.");
  });

  it("a blocked press sends nothing", async () => {
    const { server, bag } = renderStart({ sellerId: null });
    act(() => bag().start());
    await waitFor(() => expect(bag().isStarting).toBe(false));
    expect(server.calls).toHaveLength(0);
  });
});

describe("get-or-create", () => {
  it("posts a direct thread with exactly one other participant", async () => {
    const { server, bag } = renderStart({
      sellerId: SELLER,
      viewerId: BUYER,
      routes: { "POST /conversations": { status: 201, body: conversation() } },
    });
    act(() => bag().start());
    await waitFor(() => expect(screen.getByTestId("opened").textContent).not.toBe(""));
    const post = server.calls.find((c) => c.method === "POST");
    expect(post?.body).toEqual({ kind: "direct", participant_ids: [SELLER] });
    // `scope_key` is deliberately absent: the server ignores it and resolves
    // the scope itself, so sending a listing id there would be a lie.
    expect(post?.body).not.toHaveProperty("scope_key");
  });

  it("pressing twice lands in the SAME thread — the constraint decides, not us", async () => {
    // stapel-chat keys a direct thread by the participant pair under a unique
    // constraint and resolves the create race by returning the winner's row.
    const opened: string[] = [];
    const { bag } = renderStart({
      sellerId: SELLER,
      viewerId: BUYER,
      routes: { "POST /conversations": { status: 201, body: conversation() } },
      onOpened: (c) => opened.push(c.id),
    });
    act(() => bag().start());
    await waitFor(() => expect(opened).toHaveLength(1));
    act(() => bag().start());
    await waitFor(() => expect(opened).toHaveLength(2));
    expect(new Set(opened).size).toBe(1);
  });

  it("a refusal is surfaced, not swallowed", async () => {
    const { bag } = renderStart({
      sellerId: SELLER,
      viewerId: BUYER,
      routes: {
        "POST /conversations": {
          status: 400,
          body: { localizable_error: "error.400.chat_invalid_direct" },
        },
      },
    });
    act(() => bag().start());
    await waitFor(() => expect(bag().error).toBeTruthy());
    expect(screen.getByTestId("opened").textContent).toBe("");
  });
});
