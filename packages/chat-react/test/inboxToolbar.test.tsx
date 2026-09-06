/**
 * FINDING ONE CONVERSATION IN AN INBOX.
 *
 * The thread list had no search and no unread filter at all: a seller with
 * three hundred threads reached the one they wanted by scrolling. These tests
 * pin the four properties that make the toolbar a fix rather than decoration:
 *
 *   1. a row is found by ALL THREE of the things it draws — the counterpart's
 *      name, the listing it is about, and the last line this client holds —
 *      because a search that only matches one of them sends a person back to
 *      scrolling for the other two;
 *   2. the unread chip is the SERVER's `unread_count`, the same number the
 *      row's badge shows, and it is operable from the keyboard;
 *   3. the two empty states stay two different sentences: an empty inbox says
 *      "no conversations yet", a filter that found nothing says so — telling a
 *      person with three hundred threads that they have none is the failure
 *      this pair has shipped before in other clothes;
 *   4. controlled mode really is controlled: a panel handed `search` never
 *      moves it on its own, so a host can keep the filter in the URL.
 *
 * And the honesty condition: the filter runs over the conversations that are
 * LOADED (the list endpoint takes anchor/direction/limit and nothing else), so
 * the pane says so — and only while there really is another page to load.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ConversationListPanel } from "../src/default/index.js";
import { previewSearchText } from "../src/default/inboxFilter.js";
import { chatQueryKeys } from "../src/index.js";
import type {
  ChatPeopleSlot,
  ChatSlots,
  Conversation,
  ConversationPage,
} from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, conversation, conversationPage, message } from "./fixtures.js";

const ANNA = "c-anna";
const BORIS = "c-boris";
const CLARA = "c-clara";

const PEOPLE: Readonly<Record<string, string>> = {
  "u-anna": "Anna Petrova",
  "u-boris": "Boris Ivanov",
  "u-clara": "Clara Weiss",
};

/** One title per thread, none of them a word in any of the names. */
const TITLES: Readonly<Record<string, string>> = {
  [ANNA]: "Bicycle, almost new",
  [BORIS]: "Winter tyres",
  [CLARA]: "Oak dining table",
};

/** The one line this client actually holds — in no name and no title. */
const CLARA_LAST_LINE = "Is the harpsichord still available?";

/** A directory that answers immediately, the way a wired host's batch does. */
const People: ChatPeopleSlot = (props) =>
  props.children({
    pending: false,
    lookup: (userId) => {
      const displayName = PEOPLE[userId];
      return displayName === undefined ? null : { userId, displayName };
    },
  });
// Module-level, and stable: the harness memoizes the runtime on this object.
const SLOTS: ChatSlots = { people: People };

function threads(): readonly Conversation[] {
  return [
    ["u-anna", ANNA],
    ["u-boris", BORIS],
    ["u-clara", CLARA],
  ].map(([sellerId, id], index) =>
    conversation({
      id: id ?? "",
      // Only Anna's thread is unread — the chip's whole assertion.
      unread_count: index === 0 ? 2 : 0,
      updated_at: `2026-08-2${index + 1}T10:00:00Z`,
      subject: {
        type: "listing",
        key: id ?? "",
        card: { title: TITLES[id ?? ""], url: `/listings/${id ?? ""}` },
        meta_status: "ok",
      },
      participants: [
        { user_id: BUYER, role: "member", last_read_seq: 0 },
        { user_id: sellerId ?? "", role: "member", last_read_seq: 0 },
      ],
    })
  );
}

type PanelProps = Parameters<typeof ConversationListPanel>[0];

function renderInbox(
  props: PanelProps = {},
  page: ConversationPage = conversationPage(threads())
): void {
  const server = mockServer({ "GET /conversations": { body: page } });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // The preview is not served by the list endpoint — a row shows a last line
  // only when this client already holds that thread's window. Seeding the
  // cache is what a session that has opened Clara's thread looks like.
  client.setQueryData(chatQueryKeys.thread(CLARA), {
    messages: [message(1, { conversation_id: CLARA, body: CLARA_LAST_LINE })],
    hasOlder: false,
    olderAnchor: null,
  });
  render(
    <TestHarness
      server={server}
      queryClient={client}
      realtime={{ socketUrl: null }}
      slots={SLOTS}
    >
      <ConversationListPanel
        viewerId={BUYER}
        openHref={(id) => `/chat/${id}`}
        {...props}
      />
    </TestHarness>
  );
}

/** Which conversations the pane is showing, in order. */
function visible(): readonly string[] {
  return screen
    .queryAllByTestId("chat-conversation-row")
    .map((row) => row.getAttribute("data-chat-conversation-id") ?? "");
}

async function allThreeLoaded(): Promise<void> {
  await waitFor(() => expect(visible()).toHaveLength(3));
}

function type(text: string): void {
  fireEvent.change(screen.getByTestId("chat-list-search"), {
    target: { value: text },
  });
}

describe("the thread list can be searched", () => {
  it("narrows by the counterpart's name", async () => {
    renderInbox();
    await allThreeLoaded();
    type("boris");
    expect(visible()).toEqual([BORIS]);
  });

  it("narrows by the listing the thread is about", async () => {
    renderInbox();
    await allThreeLoaded();
    // A word that is in no name and no message — only the subject card.
    type("Oak");
    expect(visible()).toEqual([CLARA]);
  });

  it("narrows by the last message this client holds", async () => {
    renderInbox();
    await allThreeLoaded();
    // In no name and no title: the only way to match it is the preview.
    type("harpsichord");
    expect(visible()).toEqual([CLARA]);
  });

  it("ignores case and surrounding whitespace", async () => {
    renderInbox();
    await allThreeLoaded();
    type("   PETROVA  ");
    expect(visible()).toEqual([ANNA]);
  });

  it("clearing the box gives every conversation back", async () => {
    renderInbox();
    await allThreeLoaded();
    type("boris");
    expect(visible()).toEqual([BORIS]);
    type("");
    expect(visible()).toEqual([ANNA, BORIS, CLARA]);
  });
});

describe("the unread chip", () => {
  it("keeps only the threads the SERVER counts as unread", async () => {
    renderInbox();
    await allThreeLoaded();
    fireEvent.click(screen.getByTestId("chat-list-unread-filter"));
    expect(visible()).toEqual([ANNA]);
    // The row that survived is the one carrying the badge's own sentence.
    expect(screen.getByLabelText("2 unread")).toBeTruthy();
  });

  it("is a real checkbox to a reader, and answers the keyboard", async () => {
    renderInbox();
    await allThreeLoaded();
    const chip = screen.getByTestId("chat-list-unread-filter");
    expect(chip.getAttribute("role")).toBe("checkbox");
    expect(chip.getAttribute("aria-checked")).toBe("false");
    expect(chip.getAttribute("tabindex")).toBe("0");

    // Space is what a checkbox answers to — no mouse anywhere in this filter.
    fireEvent.keyDown(chip, { key: " " });
    expect(chip.getAttribute("aria-checked")).toBe("true");
    expect(visible()).toEqual([ANNA]);
  });

  it("combines with the search box rather than replacing it", async () => {
    renderInbox();
    await allThreeLoaded();
    fireEvent.click(screen.getByTestId("chat-list-unread-filter"));
    type("boris");
    // Boris is read, Anna is unread: the two filters are an AND, and an
    // honest empty is the right answer here.
    expect(visible()).toEqual([]);
    expect(screen.getByTestId("chat-conversation-list-no-matches")).toBeTruthy();
  });
});

describe("the two empty states are two different sentences", () => {
  it("a filter that finds nothing says so — and keeps the toolbar", async () => {
    renderInbox();
    await allThreeLoaded();
    type("nobody by that name");
    expect(visible()).toEqual([]);
    expect(screen.getByTestId("chat-conversation-list-no-matches").textContent).toContain(
      "Nothing found."
    );
    // NOT the inbox's own empty copy: this person has three conversations.
    expect(screen.queryByTestId("chat-conversation-list-empty")).toBeNull();
    // And the way back out is still on screen.
    expect(screen.getByTestId("chat-list-search")).toBeTruthy();
  });

  it("an empty inbox says it is empty, and offers no filter over nothing", async () => {
    renderInbox({}, conversationPage([]));
    await waitFor(() =>
      expect(screen.getByTestId("chat-conversation-list-empty")).toBeTruthy()
    );
    expect(screen.getByTestId("chat-conversation-list-empty").textContent).toContain(
      "No conversations yet."
    );
    expect(screen.queryByTestId("chat-list-toolbar")).toBeNull();
    expect(screen.queryByTestId("chat-conversation-list-no-matches")).toBeNull();
  });
});

describe("the pane says what it is filtering over", () => {
  it("states the scope while another page is still unloaded", async () => {
    renderInbox({}, conversationPage(threads(), { has_next: true, next_anchor: "a" }));
    await allThreeLoaded();
    // Nothing to caveat until a filter is on.
    expect(screen.queryByTestId("chat-list-filter-scope")).toBeNull();
    type("boris");
    expect(screen.getByTestId("chat-list-filter-scope").textContent).toContain(
      "loaded so far"
    );
  });

  it("says nothing once everything is loaded — the filter really is total", async () => {
    renderInbox();
    await allThreeLoaded();
    type("boris");
    expect(screen.queryByTestId("chat-list-filter-scope")).toBeNull();
  });
});

describe("controlled mode", () => {
  it("a host-owned search is never moved by the panel", async () => {
    const onSearchChange = vi.fn();
    renderInbox({ search: "oak", onSearchChange });
    await waitFor(() => expect(visible()).toEqual([CLARA]));
    expect(screen.getByTestId("chat-list-search").getAttribute("value")).toBe("oak");

    type("boris");
    // Reported, and NOT applied: the value belongs to the host.
    expect(onSearchChange).toHaveBeenCalledWith("boris");
    expect(visible()).toEqual([CLARA]);
    expect(screen.getByTestId("chat-list-search").getAttribute("value")).toBe("oak");
  });

  it("a host-owned chip is the same bargain", async () => {
    const onUnreadOnlyChange = vi.fn();
    renderInbox({ unreadOnly: true, onUnreadOnlyChange });
    await waitFor(() => expect(visible()).toEqual([ANNA]));
    fireEvent.click(screen.getByTestId("chat-list-unread-filter"));
    expect(onUnreadOnlyChange).toHaveBeenCalledWith(false);
    expect(visible()).toEqual([ANNA]);
  });

  it("uncontrolled defaults are a starting point, not a lock", async () => {
    renderInbox({ defaultSearch: "boris" });
    await waitFor(() => expect(visible()).toEqual([BORIS]));
    type("oak");
    expect(visible()).toEqual([CLARA]);
  });

  it("`filters={false}` hides the controls but still filters", async () => {
    renderInbox({ filters: false, search: "oak" });
    await waitFor(() => expect(visible()).toEqual([CLARA]));
    expect(screen.queryByTestId("chat-list-toolbar")).toBeNull();
  });
});

describe("a row is only findable by what it shows", () => {
  it("a deleted line and a system line are not searchable text", () => {
    // Both render as something OTHER than their body — a tombstone and the
    // word "System" — so matching the body would find rows by text that is
    // nowhere on the screen.
    expect(previewSearchText(message(1, { deleted: true }))).toBe("");
    expect(
      previewSearchText(message(2, { kind: "system", body: "video.call.ended:188" }))
    ).toBe("");
    expect(previewSearchText(message(3, { body: "still available?" }))).toBe(
      "still available?"
    );
    expect(previewSearchText(undefined)).toBe("");
  });
});
