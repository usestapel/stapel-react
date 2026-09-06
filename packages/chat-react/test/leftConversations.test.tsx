/**
 * THE THREADS YOU LEFT, AND THE WAY BACK — stapel-chat 0.8.6.
 *
 * 0.8.5 gave a person a way out of a conversation and no way back in: the
 * thread was off `inbox_of`, out of the unread counts and out of `?search=`,
 * and it was deliberately not destroyed — so it existed, in full, somewhere
 * nothing would ever list. `?left=true` is the listing (the EXACT complement
 * of the inbox: a thread is on one of the two and never on both) and
 * `POST /conversations/{id}/rejoin` is the way back.
 *
 * What this file pins is everything a client could get wrong about a SECOND
 * list over one endpoint:
 *
 *  - the tab asks for the left list, and the inbox's own read never carries
 *    that parameter — two lists, two questions;
 *  - and the two page on their OWN cursors. This is the defect the shape
 *    invites: the endpoint is one URL, so one cache entry is the obvious
 *    saving, and it is wrong — the inbox is ordered by `updated_at` and the
 *    left list by `left_at`, so a "load more" carrying the other list's
 *    anchor asks a real question and gets a plausible, wrong page rather than
 *    an error anyone would notice;
 *  - a left row draws WHEN it was left, off the row's own top-level `left_at`;
 *  - the way back does not ask first (it is the safe half of that choice) and
 *    on the `204` the row leaves the left list while the INBOX is re-read
 *    rather than re-sorted here — `rejoin` touches neither the read markers
 *    nor `updated_at`, so where the thread lands is the server's answer;
 *  - a `404` is not about the thread. It is a deployment that predates the
 *    verb, and it takes EVERY rejoin control off the screen at once, not just
 *    the one that was pressed;
 *  - the `403` is about the thread, is this module's own sentence, and is
 *    asked exactly once;
 *  - and no left row is ever drawn on the inbox, which is what a shared cache
 *    entry would have done the moment somebody visited the other tab.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ConversationListPanel } from "../src/default/index.js";
import type { ChatPeopleSlot, Conversation } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer, RecordedCall } from "./harness.js";
import {
  BUYER,
  CONVERSATION_ID,
  SELLER,
  conversation,
  conversationPage,
  errorEnvelope,
  lastMessage,
} from "./fixtures.js";

/** A second thread, so "every control" can be told from "the one pressed". */
const OTHER_ID = "1c8f8c92-4d6a-4f01-9d1c-77b8b2f5a301";

const SELLER_NAME = "Marta Kovács";

/** The host seam, wired the way a storefront wires `useProfilesBatch`. */
const namedPeople: ChatPeopleSlot = (props) =>
  props.children({
    pending: false,
    lookup: (userId) =>
      userId === SELLER ? { userId, displayName: SELLER_NAME } : null,
  });

/**
 * The two anchors, and they are values of DIFFERENT COLUMNS — which is the
 * whole reason the two lists cannot share a cursor. The inbox's is an
 * `updated_at`; the left list's is a `left_at`, and it is deliberately the
 * older of the two so a page fetched with the wrong one would come back
 * looking entirely reasonable.
 */
const INBOX_ANCHOR = "2026-08-21T18:12:00Z";
const LEFT_ANCHOR = "2026-08-19T07:30:00Z";
const LEFT_AT = "2026-08-20T15:45:00Z";

/** A row on the inbox: somebody this person is still talking to. */
function inboxRow(): Conversation {
  return conversation({ last_message: lastMessage() });
}

/** A row on the LEFT list: the same shape, plus the departure it is sorted by. */
function leftRow(id: string, leftAt: string = LEFT_AT): Conversation {
  return conversation({ id, left_at: leftAt, last_message: lastMessage() });
}

interface LeftServer {
  readonly server: MockServer;
  /** Every list read, split by which of the two lists it asked for. */
  lists(which: "inbox" | "left"): RecordedCall[];
  rejoins(): RecordedCall[];
}

/**
 * A server that really implements the two lists: `rejoin` moves a thread
 * across, and both listings answer accordingly. Anything less would let a
 * client that never moved the row pass by accident.
 */
function leftServer(
  options: {
    readonly rejoinStatus?: number;
    readonly left?: readonly Conversation[];
    readonly leftHasNext?: boolean;
    readonly inboxHasNext?: boolean;
  } = {}
): LeftServer {
  const leftRows = options.left ?? [leftRow(OTHER_ID)];
  let returned: string | null = null;

  const server = mockServer({
    "POST /rejoin": (call) => {
      const status = options.rejoinStatus ?? 204;
      if (status === 404) {
        // What a 0.8.5 server answers: the URL is not routed at all.
        return { status, body: errorEnvelope("error.404.not_found") };
      }
      if (status !== 204) {
        return { status, body: errorEnvelope("error.403.chat_not_participant") };
      }
      const match = /conversations\/([^/]+)\/rejoin/.exec(call.url);
      returned = match?.[1] ?? null;
      return { status: 204 };
    },
    "GET /conversations": (call) => {
      if (call.url.includes("left=true")) {
        return {
          body: conversationPage(
            leftRows.filter((row) => row.id !== returned),
            { has_next: options.leftHasNext ?? false, next_anchor: LEFT_ANCHOR }
          ),
        };
      }
      return {
        body: conversationPage(
          returned === null
            ? [inboxRow()]
            : [inboxRow(), ...leftRows.filter((row) => row.id === returned)],
          { has_next: options.inboxHasNext ?? false, next_anchor: INBOX_ANCHOR }
        ),
      };
    },
  });

  const listReads = (which: "inbox" | "left"): RecordedCall[] =>
    server.calls.filter(
      (call) =>
        call.method === "GET" &&
        call.url.includes("/conversations?") &&
        call.url.includes("left=true") === (which === "left")
    );

  return {
    server,
    lists: listReads,
    rejoins: () => server.calls.filter((call) => call.url.includes("/rejoin")),
  };
}

function renderInbox(server: MockServer, queryClient?: QueryClient): void {
  render(
    <TestHarness
      server={server}
      realtime={{ socketUrl: null }}
      slots={{ people: namedPeople }}
      {...(queryClient !== undefined ? { queryClient } : {})}
    >
      <ConversationListPanel viewerId={BUYER} onOpen={() => undefined} />
    </TestHarness>
  );
}

/**
 * A cache that never re-reads on its own, so "the inbox was read again" can
 * only mean it was INVALIDATED.
 *
 * With the default `staleTime: 0` every tab press refetches whatever it
 * mounts, and an assertion that a request happened would pass for a pair that
 * invalidates nothing at all — the shape of a gate that is blind to the thing
 * it is named after.
 */
function frozenCache(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** Press one of the two tabs. They are radios — one choice, never a union. */
function pressTab(which: "inbox" | "left"): void {
  const tabs = screen.getByTestId("chat-list-view-tabs");
  const radios = tabs.querySelectorAll<HTMLInputElement>("input[type='radio']");
  const radio = radios[which === "left" ? 1 : 0];
  if (radio === undefined) throw new Error("the pane drew no tab pair");
  radio.click();
}

/** Land on the left tab with its rows drawn. */
async function openLeftTab(): Promise<void> {
  await waitFor(() => expect(screen.getByTestId("chat-list-view-tabs")).toBeTruthy());
  pressTab("left");
  await waitFor(() => expect(screen.getByTestId("chat-rejoin")).toBeTruthy());
}

describe("the two lists are two questions", () => {
  it("asks for the left threads with ?left=true, and never asks the inbox that", async () => {
    const { server, lists } = leftServer();
    renderInbox(server);
    await openLeftTab();

    expect(lists("left").length).toBeGreaterThan(0);
    // The parameter is omitted rather than sent false: `left=false` is no
    // filter to the server, and sending it would cost a second URL and a
    // second cache entry for the same list.
    expect(lists("inbox").length).toBeGreaterThan(0);
    for (const call of lists("inbox")) expect(call.url).not.toContain("left=");
  });

  it("pages each list on ITS OWN cursor — an updated_at is not a left_at", async () => {
    const { server, lists } = leftServer({ leftHasNext: true, inboxHasNext: true });
    renderInbox(server);

    // The inbox, one page deeper.
    await waitFor(() => expect(screen.getByTestId("chat-conversation-row")).toBeTruthy());
    screen.getByText("Load more").click();
    await waitFor(() =>
      expect(
        lists("inbox").some((call) => call.url.includes(encodeURIComponent(INBOX_ANCHOR)))
      ).toBe(true)
    );

    // The left list, one page deeper — from its own anchor.
    await openLeftTab();
    screen.getByText("Load more").click();
    await waitFor(() =>
      expect(
        lists("left").some((call) => call.url.includes(encodeURIComponent(LEFT_ANCHOR)))
      ).toBe(true)
    );

    // Neither cursor ever crossed. A shared cache entry would have carried
    // one list's `next_anchor` into the other's query and been answered.
    for (const call of lists("inbox")) {
      expect(call.url).not.toContain(encodeURIComponent(LEFT_ANCHOR));
    }
    for (const call of lists("left")) {
      expect(call.url).not.toContain(encodeURIComponent(INBOX_ANCHOR));
    }
  });

  it("never draws a left row on the inbox, even after the other tab was open", async () => {
    const { server } = leftServer();
    renderInbox(server);
    await openLeftTab();
    expect(screen.getByTestId("chat-row-left-at")).toBeTruthy();

    pressTab("inbox");
    await waitFor(() => expect(screen.queryByTestId("chat-rejoin")).toBeNull());
    // The inbox holds its one row and none of the other list's.
    const rows = screen.getAllByTestId("chat-conversation-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.getAttribute("data-chat-conversation-id")).toBe(CONVERSATION_ID);
    expect(screen.queryByTestId("chat-row-left-at")).toBeNull();
  });
});

describe("a left row says when it was left", () => {
  it("draws the departure from the row's own left_at", async () => {
    const { server } = leftServer();
    renderInbox(server);
    await openLeftTab();

    const line = screen.getByTestId("chat-row-left-at");
    expect(line.textContent).toContain("Left");
    // The clock is `Intl`'s, from the locale — data, not copy — so the
    // assertion is on the instant and not on a formatting we would then be
    // pinning in three locales.
    expect(line.textContent).toContain(
      new Intl.DateTimeFormat("en", { dateStyle: "short", timeStyle: "short" }).format(
        Date.parse(LEFT_AT)
      )
    );
  });

  it("offers no way OUT of a thread already left — the row's menu is gone", async () => {
    const { server } = leftServer();
    renderInbox(server);
    await openLeftTab();
    expect(screen.queryByTestId("chat-row-menu-open")).toBeNull();
  });
});

describe("returning to a conversation", () => {
  it("acts on the press, and takes the row off the left list on the 204", async () => {
    const { server, rejoins, lists } = leftServer();
    renderInbox(server);
    await openLeftTab();

    screen.getByTestId("chat-rejoin").click();

    await waitFor(() => expect(rejoins()).toHaveLength(1));
    const call = rejoins()[0];
    expect(call?.method).toBe("POST");
    expect(call?.url).toContain(`/conversations/${OTHER_ID}/rejoin`);
    // No body: the only legal value of `left_at` on the way back is the one
    // the server writes, and a field like that is not a field.
    expect(call?.body).toBeUndefined();
    // Asked without a confirmation first: this is the safe half of the choice
    // leaving asks about, and a speed bump here is one aimed at the recovery
    // from the mistake rather than at the mistake.
    expect(screen.queryByTestId("chat-leave-confirm")).toBeNull();

    // The row is gone from the list it was on.
    await waitFor(() => expect(screen.queryByTestId("chat-rejoin")).toBeNull());
    expect(lists("left").length).toBeGreaterThan(0);
  });

  it("invalidates the INBOX rather than re-sorting it here", async () => {
    const { server, lists } = leftServer();
    renderInbox(server, frozenCache());
    await waitFor(() => expect(screen.getByTestId("chat-conversation-row")).toBeTruthy());

    // The control: a cache that is never invalidated is never re-read, so a
    // tab press on its own proves nothing.
    await openLeftTab();
    pressTab("inbox");
    await waitFor(() => expect(screen.queryByTestId("chat-rejoin")).toBeNull());
    const untouched = lists("inbox").length;
    expect(untouched).toBe(1);

    // And the finding: the `204` puts the read back on the wire, because
    // `rejoin` touches neither the read markers nor `updated_at` and where
    // the thread lands on the inbox is the server's answer, not one this
    // pair can splice in.
    pressTab("left");
    await waitFor(() => expect(screen.getByTestId("chat-rejoin")).toBeTruthy());
    screen.getByTestId("chat-rejoin").click();
    await waitFor(() => expect(screen.queryByTestId("chat-rejoin")).toBeNull());

    pressTab("inbox");
    await waitFor(() => expect(lists("inbox").length).toBeGreaterThan(untouched));
  });

  it("puts the thread back on the inbox, where the server says it belongs", async () => {
    const { server } = leftServer();
    renderInbox(server);
    await openLeftTab();
    screen.getByTestId("chat-rejoin").click();
    await waitFor(() => expect(screen.queryByTestId("chat-rejoin")).toBeNull());

    pressTab("inbox");
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId("chat-conversation-row")
          .map((row) => row.getAttribute("data-chat-conversation-id"))
      ).toContain(OTHER_ID)
    );
  });
});

describe("the two refusals", () => {
  it("a 404 is about the SERVER: every rejoin control goes, not just the one pressed", async () => {
    const { server, rejoins } = leftServer({
      rejoinStatus: 404,
      left: [leftRow(OTHER_ID), leftRow(CONVERSATION_ID)],
    });
    renderInbox(server);
    await waitFor(() => expect(screen.getByTestId("chat-list-view-tabs")).toBeTruthy());
    pressTab("left");
    await waitFor(() => expect(screen.getAllByTestId("chat-rejoin")).toHaveLength(2));

    const controls = screen.getAllByTestId("chat-rejoin");
    controls[0]?.click();

    // BOTH, and on the strength of one answer: the URL either exists on this
    // deployment or it does not, and pressing the second one could only
    // produce the same 404.
    await waitFor(() => expect(screen.queryAllByTestId("chat-rejoin")).toHaveLength(0));
    expect(rejoins()).toHaveLength(1);
    // The rows themselves stay: the list is still true, only the way back is
    // absent from this server.
    expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(2);
  });

  it("a 403 is about the THREAD: this module's sentence, asked exactly once", async () => {
    const { server, rejoins } = leftServer({ rejoinStatus: 403 });
    renderInbox(server);
    await openLeftTab();
    screen.getByTestId("chat-rejoin").click();

    await waitFor(() => expect(screen.getByTestId("chat-rejoin-error")).toBeTruthy());
    expect(screen.getByTestId("chat-rejoin-error").textContent).toContain(
      "You are not a participant of this conversation"
    );
    // Settled, so it is not retried: the same answer three times is three
    // round trips spent on a question that is closed.
    expect(rejoins()).toHaveLength(1);
    // And the control stays — this refusal says nothing about the other rows.
    expect(screen.getByTestId("chat-rejoin")).toBeTruthy();
  });
});

describe("finding one of them", () => {
  it("searches the left list on the server, and promises only what it can find", async () => {
    const { server, lists } = leftServer();
    renderInbox(server);
    await openLeftTab();

    const field = screen.getByTestId("chat-list-search") as HTMLInputElement;
    // A left thread's last line is the departure marker, and an unlabelled
    // marker draws nothing and is found by nothing — so the field must not
    // repeat the inbox's "or message".
    expect(field.placeholder).toBe("Name or listing");

    fireEvent.change(field, { target: { value: "Marta" } });

    await waitFor(
      () =>
        expect(
          lists("left").some((call) => call.url.includes("search=Marta"))
        ).toBe(true),
      { timeout: 3000 }
    );
    // The search travels on the LEFT list's own read; the inbox is not
    // re-queried behind the tab a person is not looking at.
    for (const call of lists("inbox")) expect(call.url).not.toContain("search=Marta");
  });
});
