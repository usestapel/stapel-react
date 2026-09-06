/**
 * LEAVING A CONVERSATION — the verb is `DELETE` and the act is not a delete.
 *
 * stapel-chat 0.8.5 gave `DELETE /conversations/{id}` a meaning (it answered
 * 405 before): the caller leaves. Their participant row is stamped `left_at`,
 * the thread drops off THEIR list, counts and search, their live subscription
 * is revoked, and a `system` line records it as
 * `chat.participant.left:<user_id>` — while every message, the other party's
 * copy of the thread and the leaver's own access by id stay exactly as they
 * were. An AUTHORED reply brings the thread back for everyone.
 *
 * What this file pins is everything a client could get wrong about that:
 *
 *  - the control asks BEFORE it acts, and the question says both halves —
 *    your list, and their copy — because the two people pressing it mean two
 *    different things and only one of them is what happens;
 *  - the row leaves the cache on the `204`, from every narrowing of the list,
 *    and the screen showing that thread closes;
 *  - a second press is another `204` and not an error (the contract is
 *    idempotent), and the ONE refusal it has — `chat_not_participant` — is
 *    rendered as this module's own sentence and asked exactly once;
 *  - the marker becomes a sentence with a NAME in it, and another module's
 *    marker is left alone;
 *  - `participants[].left_at` replaces presence in the header, so nobody is
 *    drawn as present in a room they are not in;
 *  - and NOTHING remembers "I left": the row comes back on the next inbox
 *    frame all by itself, because a client that suppressed it would need to
 *    be told to forget, by an event nobody sends.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConversationListPanel,
  ConversationSplitPanel,
  ConversationThreadPanel,
} from "../src/default/index.js";
import { chatInboxStream } from "../src/index.js";
import type { ChatPeopleSlot, Conversation, MessagePage } from "../src/index.js";
import {
  ChatServer,
  TestHarness,
  installBrowserWebSocket,
  mockServer,
} from "./harness.js";
import type { BrowserWebSocketEnvironment, MockServer } from "./harness.js";
import {
  BUYER,
  CONVERSATION_ID,
  SELLER,
  conversation,
  conversationPage,
  errorEnvelope,
  lastMessage,
  message,
  messagePage,
} from "./fixtures.js";

const SELLER_NAME = "Marta Kovács";

/** The host seam, wired the way a storefront wires `useProfilesBatch`. */
const namedPeople: ChatPeopleSlot = (props) =>
  props.children({
    pending: false,
    lookup: (userId) =>
      userId === SELLER ? { userId, displayName: SELLER_NAME } : null,
  });

/** A row that draws a line, so the inbox under test looks like an inbox. */
function inboxRow(): Conversation {
  return conversation({ last_message: lastMessage() });
}

/**
 * A server that really implements leaving: the `DELETE` flips a flag and the
 * LIST answers accordingly, so "the row is gone" is the server's answer and
 * not a fixture handed to the assertion. Anything else would let a client
 * that never removed the row pass by accident — and would make the
 * re-surface case untestable, because the row would never have left.
 */
function leavingServer(options: { readonly leaveStatus?: number } = {}): {
  readonly server: MockServer;
  /** The counterpart wrote: the marker is cleared and the row is back. */
  resurface(): void;
  deletes(): number;
} {
  let left = false;
  const server = mockServer({
    "DELETE /conversations/": () => {
      const status = options.leaveStatus ?? 204;
      if (status !== 204) {
        return { status, body: errorEnvelope("error.403.chat_not_participant") };
      }
      // Idempotent by contract: a second call is another 204 and writes no
      // second line, so the flag is set rather than toggled.
      left = true;
      return { status: 204 };
    },
    "GET /conversations?": () => ({
      body: conversationPage(left ? [] : [inboxRow()]),
    }),
    "GET /conversations": () => ({ body: conversationPage(left ? [] : [inboxRow()]) }),
  });
  return {
    server,
    resurface: () => {
      left = false;
    },
    deletes: () =>
      server.calls.filter((call) => call.method === "DELETE").length,
  };
}

function renderInbox(server: MockServer): void {
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }} slots={{ people: namedPeople }}>
      <ConversationListPanel viewerId={BUYER} onOpen={() => undefined} />
    </TestHarness>
  );
}

/** Open the row's menu and press its one entry, landing on the confirmation. */
async function askToLeaveFromRow(): Promise<void> {
  await waitFor(() => expect(screen.getByTestId("chat-row-menu-open")).toBeTruthy());
  screen.getByTestId("chat-row-menu-open").click();
  await waitFor(() => expect(screen.getByTestId("chat-leave-open")).toBeTruthy());
  screen.getByTestId("chat-leave-open").click();
  await waitFor(() => expect(screen.getByTestId("chat-leave-submit")).toBeTruthy());
}

describe("the control asks before it acts", () => {
  it("says what leaving is — your list, their copy — and sends nothing yet", async () => {
    const { server, deletes } = leavingServer();
    renderInbox(server);
    await askToLeaveFromRow();

    expect(screen.getByTestId("chat-leave-confirm").textContent).toContain(
      "This conversation will disappear from your list. The other person keeps the messages."
    );
    // The question is asked BEFORE the request, which is the whole point of
    // asking it: nothing has happened yet.
    expect(deletes()).toBe(0);
    expect(screen.getByTestId("chat-conversation-row")).toBeTruthy();
  });

  it("the way out costs nothing — cancelling leaves the row where it was", async () => {
    const { server, deletes } = leavingServer();
    renderInbox(server);
    await askToLeaveFromRow();
    screen.getByTestId("chat-leave-cancel").click();

    await waitFor(() =>
      expect(screen.queryByTestId("chat-leave-submit")).toBeNull()
    );
    expect(deletes()).toBe(0);
    expect(screen.getByTestId("chat-conversation-row")).toBeTruthy();
  });
});

describe("leaving from an inbox row", () => {
  it("sends the DELETE and takes the row off the list", async () => {
    const { server, deletes } = leavingServer();
    renderInbox(server);
    await askToLeaveFromRow();
    screen.getByTestId("chat-leave-submit").click();

    await waitFor(() => expect(deletes()).toBe(1));
    const call = server.calls.find((c) => c.method === "DELETE");
    expect(call?.url).toContain(`/conversations/${CONVERSATION_ID}`);
    // No body: leaving is the URL and the verb, not a payload.
    expect(call?.body).toBeUndefined();

    // The row is gone from the SCREEN, and it did not have to wait for a
    // refetch to be — the cache was written on the 204.
    await waitFor(() =>
      expect(screen.queryByTestId("chat-conversation-row")).toBeNull()
    );
    expect(screen.getByTestId("chat-conversation-list-empty")).toBeTruthy();
  });
});

describe("leaving from inside the thread", () => {
  function renderThread(server: MockServer, onLeft: (id: string) => void): void {
    render(
      <TestHarness
        server={server}
        realtime={{ socketUrl: null }}
        slots={{ people: namedPeople }}
      >
        <ConversationThreadPanel
          conversationId={CONVERSATION_ID}
          viewerId={BUYER}
          onLeft={onLeft}
        />
      </TestHarness>
    );
  }

  function threadServer(leaveStatus = 204): {
    server: MockServer;
    deletes: () => number;
  } {
    const server = mockServer({
      "GET /messages": { body: messagePage([1, 2]) },
      "POST /read": { body: {} },
      "DELETE /conversations/": () =>
        leaveStatus === 204
          ? { status: 204 }
          : {
              status: leaveStatus,
              body: errorEnvelope("error.403.chat_not_participant"),
            },
      "GET /conversations/": { body: conversation() },
    });
    return {
      server,
      deletes: () => server.calls.filter((c) => c.method === "DELETE").length,
    };
  }

  async function leaveFromThreadMenu(): Promise<void> {
    await waitFor(() =>
      expect(screen.getByTestId("chat-thread-menu-open")).toBeTruthy()
    );
    screen.getByTestId("chat-thread-menu-open").click();
    await waitFor(() => expect(screen.getByTestId("chat-leave-open")).toBeTruthy());
    screen.getByTestId("chat-leave-open").click();
    await waitFor(() =>
      expect(screen.getByTestId("chat-leave-submit")).toBeTruthy()
    );
    screen.getByTestId("chat-leave-submit").click();
  }

  it("tells the screen it left, so a thread view can close", async () => {
    const { server, deletes } = threadServer();
    const onLeft = vi.fn();
    renderThread(server, onLeft);
    await leaveFromThreadMenu();

    await waitFor(() => expect(deletes()).toBe(1));
    await waitFor(() => expect(onLeft).toHaveBeenCalledWith(CONVERSATION_ID));
    // The confirmation closed itself on the 204 — a dialog left standing over
    // a thread the person just left is a screen that did not answer.
    await waitFor(() =>
      expect(screen.queryByTestId("chat-leave-submit")).toBeNull()
    );
  });

  it("a SECOND leave is another 204 and not an error", async () => {
    // The contract is idempotent on purpose — a client that lost the response
    // and retried, and a client leaving a thread it already left, are the same
    // request. A pair that treated the second one as a failure would put a red
    // alert on a screen where nothing went wrong.
    const { server, deletes } = threadServer();
    renderThread(server, () => undefined);
    await leaveFromThreadMenu();
    await waitFor(() => expect(deletes()).toBe(1));
    await waitFor(() =>
      expect(screen.queryByTestId("chat-leave-submit")).toBeNull()
    );

    await leaveFromThreadMenu();
    await waitFor(() => expect(deletes()).toBe(2));
    expect(screen.queryByTestId("chat-leave-error")).toBeNull();
  });

  it("a 403 is the module's own sentence, asked exactly once", async () => {
    const { server, deletes } = threadServer(403);
    renderThread(server, () => undefined);
    await leaveFromThreadMenu();

    await waitFor(() =>
      expect(screen.getByTestId("chat-leave-error")).toBeTruthy()
    );
    expect(screen.getByTestId("chat-leave-error").textContent).toContain(
      "You are not a participant of this conversation"
    );
    // NOT RETRIED. `chat_not_participant` is a settled answer, not a blip —
    // the same one a GET on this URL gives — so three round trips would buy
    // three identical refusals.
    expect(deletes()).toBe(1);
    // And the confirmation stays open around it: a dialog that closed on the
    // refusal would leave a person looking at an unchanged inbox with nothing
    // on screen saying why.
    expect(screen.getByTestId("chat-leave-submit")).toBeTruthy();
  });
});

describe("the departure line in the transcript", () => {
  function renderThreadWith(options: {
    readonly body: string;
    readonly people?: ChatPeopleSlot;
  }): void {
    const page: MessagePage = {
      ...messagePage([1]),
      items: [
        message(1),
        message(2, { kind: "system", sender_id: null, body: options.body }),
      ],
    };
    const server = mockServer({
      "GET /messages": { body: page },
      "POST /read": { body: {} },
      "GET /conversations/": { body: conversation() },
    });
    render(
      <TestHarness
        server={server}
        realtime={{ socketUrl: null }}
        {...(options.people !== undefined ? { slots: { people: options.people } } : {})}
      >
        <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
      </TestHarness>
    );
  }

  it("names the person, from the people seam", async () => {
    renderThreadWith({
      body: `chat.participant.left:${SELLER}`,
      people: namedPeople,
    });
    await waitFor(() =>
      expect(screen.getByTestId("chat-system-body").textContent).toBe(
        `${SELLER_NAME} left the conversation`
      )
    );
  });

  it("still reads as a sentence when nothing can name them", async () => {
    // The alternative is a uuid printed at a reader, which is the machine
    // vocabulary this whole contour exists to keep off the screen.
    renderThreadWith({ body: `chat.participant.left:${SELLER}` });
    await waitFor(() =>
      expect(screen.getByTestId("chat-system-body").textContent).toBe(
        "The other person left the conversation"
      )
    );
  });

  it("leaves another module's marker alone", async () => {
    // `video.call.ended:188` is @stapel/video-react's vocabulary. A chat
    // renderer that grew a table of other modules' event names would be a copy
    // going stale from the day it was written — so it falls through to the
    // host's `renderSystemMessage`, and failing that to the body.
    renderThreadWith({ body: "video.call.ended:188" });
    await waitFor(() =>
      expect(screen.getByTestId("chat-system-body").textContent).toBe(
        "video.call.ended:188"
      )
    );
  });
});

describe("the header, once the other side has left", () => {
  function renderHeaderFor(participants: Conversation["participants"]): void {
    const server = mockServer({
      "GET /messages": { body: messagePage([1]) },
      "POST /read": { body: {} },
      "GET /conversations/": { body: conversation({ participants }) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }} slots={{ people: namedPeople }}>
        <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
      </TestHarness>
    );
  }

  it("says they left, and stops saying they are present", async () => {
    // The wire says BOTH `online: true` and `left_at` — which is exactly the
    // body a client can be handed while a presence lease has not expired yet.
    // "Online" about somebody who is not in the room is the same lie the old
    // transport tag told, one layer down.
    renderHeaderFor([
      { user_id: BUYER, role: "member", last_read_seq: 1 },
      {
        user_id: SELLER,
        role: "member",
        last_read_seq: 3,
        online: true,
        last_seen_at: "2026-09-06T10:00:00Z",
        left_at: "2026-09-06T10:05:00Z",
      },
    ]);
    await waitFor(() => expect(screen.getByTestId("chat-presence")).toBeTruthy());
    const line = screen.getByTestId("chat-presence");
    expect(line.textContent).toBe("Left the conversation");
    // Nothing keyed off this attribute — a dot, a ring, a typing affordance —
    // may paint them as present.
    expect(line.getAttribute("data-online")).toBe("false");
    expect(line.getAttribute("data-left")).toBe("true");
  });

  it("a body with no left_at at all is still just presence (a 0.8.4 server)", async () => {
    renderHeaderFor([
      { user_id: BUYER, role: "member", last_read_seq: 1 },
      { user_id: SELLER, role: "member", last_read_seq: 3, online: true },
    ]);
    await waitFor(() => expect(screen.getByTestId("chat-presence")).toBeTruthy());
    expect(screen.getByTestId("chat-presence").textContent).toBe("Online");
    expect(screen.getByTestId("chat-presence").getAttribute("data-left")).toBeNull();
  });
});

describe("the screen showing the thread closes with it", () => {
  it("the desktop split empties its right pane", async () => {
    const server = mockServer({
      "GET /messages": { body: messagePage([1, 2]) },
      "POST /read": { body: {} },
      "DELETE /conversations/": { status: 204 },
      "GET /conversations/": { body: conversation() },
      "GET /conversations": { body: conversationPage([inboxRow()]) },
    });
    const onLeft = vi.fn();
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }} slots={{ people: namedPeople }}>
        <ConversationSplitPanel
          viewerId={BUYER}
          selectedId={CONVERSATION_ID}
          onOpen={() => undefined}
          onLeft={onLeft}
        />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getByTestId("chat-thread")).toBeTruthy());
    screen.getByTestId("chat-thread-menu-open").click();
    await waitFor(() => expect(screen.getByTestId("chat-leave-open")).toBeTruthy());
    screen.getByTestId("chat-leave-open").click();
    await waitFor(() =>
      expect(screen.getByTestId("chat-leave-submit")).toBeTruthy()
    );
    screen.getByTestId("chat-leave-submit").click();

    // The pane closes ITSELF: `selectedId` is the host's (usually the route)
    // and this arrangement cannot clear it, so a right pane still showing a
    // thread that just left the list beside it would be one screen's two
    // halves disagreeing.
    await waitFor(() => expect(screen.queryByTestId("chat-thread")).toBeNull());
    expect(screen.getByTestId("chat-split-empty")).toBeTruthy();
    // …and the host is told, because the URL is still naming that thread.
    expect(onLeft).toHaveBeenCalledWith(CONVERSATION_ID);
  });
});

describe("a thread that comes back", () => {
  let env: BrowserWebSocketEnvironment;

  beforeEach(() => {
    env = installBrowserWebSocket();
  });
  afterEach(() => {
    env.restore();
  });

  it("simply appears on the next inbox frame — nothing suppresses it", async () => {
    // An AUTHORED message from the other side clears the marker for everyone:
    // nobody can be talked to in a room they cannot see. So the row is back on
    // the next list read, and the ONLY way that can work is if this client
    // remembers nothing about having left.
    const { server, resurface, deletes } = leavingServer();
    render(
      <TestHarness
        server={server}
        realtime={{ socketUrl: "wss://chat.test" }}
        slots={{ people: namedPeople }}
      >
        <ConversationListPanel viewerId={BUYER} onOpen={() => undefined} />
      </TestHarness>
    );
    await waitFor(() => expect(env.sockets.length).toBe(1));
    const consumer = new ChatServer(env.last(), {
      stream: chatInboxStream(BUYER).key,
      ephemeral: true,
    });
    act(() => {
      consumer.accept();
    });

    await askToLeaveFromRow();
    screen.getByTestId("chat-leave-submit").click();
    await waitFor(() => expect(deletes()).toBe(1));
    await waitFor(() =>
      expect(screen.queryByTestId("chat-conversation-row")).toBeNull()
    );

    // The counterpart writes.
    resurface();
    act(() => {
      consumer.signal("chat.inbox", {
        conversation_id: CONVERSATION_ID,
        conversation_kind: "direct",
        last_seq: 9,
        message: {
          id: "m-9",
          conversation_id: CONVERSATION_ID,
          seq: 9,
          rev_seq: 9,
          kind: "text",
          body: "still interested?",
          created_at: "2026-09-06T11:00:00Z",
          sender_id: SELLER,
          reply_to: null,
          attachments: [],
        },
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId("chat-conversation-row")).toBeTruthy()
    );
  });
});
