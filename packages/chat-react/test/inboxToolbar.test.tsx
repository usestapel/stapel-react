/**
 * FINDING ONE CONVERSATION IN AN INBOX — now the SERVER's job.
 *
 * The toolbar shipped in 0.11.0 could only narrow the rows this client had
 * already loaded: a search box that reads one page of twenty and reports
 * "nothing found" over an inbox of three hundred. stapel-chat 0.8.2 closed
 * that gap with `?search=` and `?unread=true`, filtering BEFORE the page is
 * taken, and these tests pin what that has to mean here:
 *
 *   1. the controls reach the WIRE — the search text, the unread flag, both
 *      together, and both still attached when a second page is asked for. A
 *      filter that narrows the query but not the paging is a filter you can
 *      page out of;
 *   2. typing is DEBOUNCED: five keystrokes are not five reads of the whole
 *      inbox, and nothing goes out before the pause the constant names;
 *   3. no CLIENT predicate runs on top. A row the server returned is drawn,
 *      even when this client cannot see the field it matched on — the double
 *      filter that would hide it is the defect `model/inboxQuery.ts` names;
 *   4. the two empty answers stay two different sentences, and the filtered
 *      one keeps the toolbar, because the toolbar is the way back out;
 *   5. the field survives its own keystroke. A search is a NEW query, so the
 *      list goes back through `loading` — and a toolbar drawn inside that arm
 *      would be torn down by the very letter that moved it.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationListPanel } from "../src/default/index.js";
import { INBOX_SEARCH_DEBOUNCE_MS } from "../src/index.js";
import type { ChatPeopleSlot, ChatSlots, Conversation } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { BUYER, conversation, conversationPage, lastMessage } from "./fixtures.js";

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

/** The last line of Clara's thread — in no name and no title. */
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
      ...(id === CLARA
        ? { last_message: lastMessage({ body_preview: CLARA_LAST_LINE }) }
        : {}),
      participants: [
        { user_id: BUYER, role: "member", last_read_seq: 0 },
        { user_id: sellerId ?? "", role: "member", last_read_seq: 0 },
      ],
    })
  );
}

/**
 * A stand-in for stapel-chat's own filtering — the three fields it matches
 * (`services.drawn_last_line` and the two around it), applied BEFORE the page
 * is taken.
 *
 * Reproducing the rule rather than answering a fixed page is what makes the
 * assertions below mean anything: a test whose server ignores `?search=`
 * proves the parameter travelled and nothing about what it did.
 */
function rowText(row: Conversation): readonly string[] {
  const seller = row.participants?.find((p) => p.user_id !== BUYER)?.user_id ?? "";
  const card = row.subject?.card as { title?: string } | undefined;
  return [
    PEOPLE[seller] ?? "",
    card?.title ?? "",
    row.last_message?.body_preview ?? "",
  ];
}

function inboxServer(
  rows: readonly Conversation[] = threads(),
  options: { readonly pageSize?: number } = {}
): MockServer {
  return mockServer({
    "GET /conversations": (call) => {
      const query = new URL(call.url).searchParams;
      const search = (query.get("search") ?? "").trim().toLowerCase();
      const unreadOnly = query.get("unread") === "true";
      const anchor = query.get("anchor");
      let items = rows.filter((row) => !unreadOnly || row.unread_count > 0);
      if (search !== "") {
        items = items.filter((row) =>
          rowText(row).some((field) => field.toLowerCase().includes(search))
        );
      }
      const size = options.pageSize ?? items.length;
      // A page is taken from the FILTERED list, and the anchor walks that
      // list — the property the whole "filter before paging" rule buys.
      const start = anchor === null ? 0 : Number(anchor);
      const page = items.slice(start, start + size);
      const hasNext = start + size < items.length;
      return {
        body: conversationPage(page, {
          has_next: hasNext,
          next_anchor: hasNext ? String(start + size) : null,
        }),
      };
    },
  });
}

type PanelProps = Parameters<typeof ConversationListPanel>[0];

function renderInbox(
  props: PanelProps = {},
  server: MockServer = inboxServer()
): MockServer {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
  return server;
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

/** Every conversation-list URL this render has asked for, in order. */
function listCalls(server: MockServer): readonly URL[] {
  return server.calls
    .filter((call) => call.url.includes("/conversations"))
    .map((call) => new URL(call.url));
}

function searchTerms(server: MockServer): readonly string[] {
  return listCalls(server)
    .map((url) => url.searchParams.get("search"))
    .filter((term): term is string => term !== null);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the controls reach the wire", () => {
  it("sends the search as `?search=`, and narrows by the counterpart's name", async () => {
    const server = renderInbox();
    await allThreeLoaded();
    type("boris");
    await waitFor(() => expect(visible()).toEqual([BORIS]));
    expect(searchTerms(server)).toEqual(["boris"]);
  });

  it("finds a row by a field this CLIENT cannot see — the subject's title", async () => {
    // The one that proves there is no client predicate underneath: the title
    // is matched at fields only that subject type's policy names, so a local
    // filter would be guessing. Here the server answers and the row is drawn.
    const server = renderInbox();
    await allThreeLoaded();
    type("Oak");
    await waitFor(() => expect(visible()).toEqual([CLARA]));
    expect(searchTerms(server)).toEqual(["Oak"]);
  });

  it("narrows by the last line the row carries", async () => {
    renderInbox();
    await allThreeLoaded();
    type("harpsichord");
    await waitFor(() => expect(visible()).toEqual([CLARA]));
  });

  it("a blank or whitespace-only box is no search at all", async () => {
    // The server says so, and the pair does not spend a request finding out:
    // `?search=` never travels, and the key does not move, so the unfiltered
    // page is still the one on screen.
    const server = renderInbox();
    await allThreeLoaded();
    type("   ");
    await waitFor(() => expect(visible()).toHaveLength(3));
    expect(searchTerms(server)).toEqual([]);
    expect(listCalls(server)).toHaveLength(1);
  });

  it("sends the chip as `?unread=true`, and only when it is on", async () => {
    const server = renderInbox();
    await allThreeLoaded();
    fireEvent.click(screen.getByTestId("chat-list-unread-filter"));
    await waitFor(() => expect(visible()).toEqual([ANNA]));
    expect(listCalls(server).map((url) => url.searchParams.get("unread"))).toEqual([
      null,
      "true",
    ]);
    // The row that survived is the one carrying the badge's own sentence.
    expect(screen.getByLabelText("2 unread")).toBeTruthy();
  });

  it("sends BOTH when both are on — one query, two narrowings", async () => {
    const server = renderInbox();
    await allThreeLoaded();
    fireEvent.click(screen.getByTestId("chat-list-unread-filter"));
    await waitFor(() => expect(visible()).toEqual([ANNA]));
    type("bicycle");
    // The visible rows do not move (Anna's thread matches both), so waiting
    // on the LIST would pass before the search ever left.
    await waitFor(() => expect(searchTerms(server)).toEqual(["bicycle"]));
    expect(visible()).toEqual([ANNA]);
    const last = listCalls(server).at(-1);
    expect(last?.searchParams.get("search")).toBe("bicycle");
    expect(last?.searchParams.get("unread")).toBe("true");
  });

  it("carries the filter into the NEXT page, and pages the filtered list", async () => {
    // Paging out of a search is the failure this asserts against: the anchor
    // walks the FILTERED list, so page two of a search is more of the search.
    const server = renderInbox({}, inboxServer(threads(), { pageSize: 1 }));
    await waitFor(() => expect(visible()).toEqual([ANNA]));
    type("a");
    // Every name and every title here contains an "a" — three matches, one
    // per page.
    await waitFor(() => expect(searchTerms(server)).toEqual(["a"]));
    fireEvent.click(screen.getByText("Load more"));
    await waitFor(() => expect(visible()).toHaveLength(2));
    const paged = listCalls(server).at(-1);
    expect(paged?.searchParams.get("search")).toBe("a");
    expect(paged?.searchParams.get("anchor")).toBe("1");
  });

  it("a new search starts paging over, rather than resuming somebody else's", async () => {
    const server = renderInbox({}, inboxServer(threads(), { pageSize: 1 }));
    await waitFor(() => expect(visible()).toEqual([ANNA]));
    fireEvent.click(screen.getByText("Load more"));
    await waitFor(() => expect(visible()).toHaveLength(2));
    type("boris");
    await waitFor(() => expect(visible()).toEqual([BORIS]));
    const first = listCalls(server).find(
      (url) => url.searchParams.get("search") === "boris"
    );
    // No anchor: a filtered list is a different list and its first page is
    // its own.
    expect(first?.searchParams.get("anchor")).toBeNull();
  });
});

describe("typing is debounced", () => {
  it("does not spend a read per keystroke", async () => {
    const server = renderInbox();
    await allThreeLoaded();
    for (const value of ["b", "bo", "bor", "bori", "boris"]) type(value);
    // Five letters in one tick have not become five reads of the inbox.
    expect(searchTerms(server)).toEqual([]);
    await waitFor(() => expect(searchTerms(server)).toEqual(["boris"]));
    expect(visible()).toEqual([BORIS]);
  });

  it("waits the pause the constant names before it asks", async () => {
    expect(INBOX_SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(250);
    vi.useFakeTimers();
    const server = renderInbox();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(visible()).toHaveLength(3);

    type("boris");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INBOX_SEARCH_DEBOUNCE_MS - 1);
    });
    expect(searchTerms(server)).toEqual([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(searchTerms(server)).toEqual(["boris"]);
  });

  it("the field itself never lags — only the query does", async () => {
    // The box is controlled by the raw value: a debounce a person can SEE in
    // the characters they typed is a broken text field, not a throttle.
    renderInbox({ searchDebounceMs: 5_000 });
    await allThreeLoaded();
    type("boris");
    expect(screen.getByTestId("chat-list-search").getAttribute("value")).toBe("boris");
    expect(visible()).toHaveLength(3);
  });
});

describe("the two empty answers are two different sentences", () => {
  it("a filter that finds nothing says so — and keeps the toolbar", async () => {
    renderInbox();
    await allThreeLoaded();
    type("nobody by that name");
    await waitFor(() =>
      expect(screen.getByTestId("chat-conversation-list-no-matches")).toBeTruthy()
    );
    expect(visible()).toEqual([]);
    expect(screen.getByTestId("chat-conversation-list-no-matches").textContent).toContain(
      "Nothing found."
    );
    // NOT the inbox's own empty copy: this person has three conversations.
    expect(screen.queryByTestId("chat-conversation-list-empty")).toBeNull();
    // And the way back out is still on screen.
    expect(screen.getByTestId("chat-list-search")).toBeTruthy();
  });

  it("an unread chip with nothing unread is the same sentence", async () => {
    const read = threads().map((row) => ({ ...row, unread_count: 0 }));
    renderInbox({}, inboxServer(read));
    await allThreeLoaded();
    fireEvent.click(screen.getByTestId("chat-list-unread-filter"));
    await waitFor(() =>
      expect(screen.getByTestId("chat-conversation-list-no-matches")).toBeTruthy()
    );
    expect(screen.queryByTestId("chat-conversation-list-empty")).toBeNull();
  });

  it("an empty inbox says it is empty, and offers no filter over nothing", async () => {
    renderInbox({}, inboxServer([]));
    await waitFor(() =>
      expect(screen.getByTestId("chat-conversation-list-empty")).toBeTruthy()
    );
    expect(screen.getByTestId("chat-conversation-list-empty").textContent).toContain(
      "No conversations yet."
    );
    expect(screen.queryByTestId("chat-list-toolbar")).toBeNull();
    expect(screen.queryByTestId("chat-conversation-list-no-matches")).toBeNull();
  });

  it("clearing the box gives every conversation back", async () => {
    renderInbox();
    await allThreeLoaded();
    type("boris");
    await waitFor(() => expect(visible()).toEqual([BORIS]));
    type("");
    await waitFor(() => expect(visible()).toEqual([ANNA, BORIS, CLARA]));
  });
});

describe("the toolbar survives its own keystroke", () => {
  it("the field is the same element before and after the search lands", async () => {
    // A search is a new query, so the list passes through `loading` — and a
    // toolbar drawn inside that arm would be unmounted mid-word, taking the
    // focus and the caret with it.
    renderInbox();
    await allThreeLoaded();
    const before = screen.getByTestId("chat-list-search");
    before.focus();
    type("boris");
    await waitFor(() => expect(visible()).toEqual([BORIS]));
    expect(screen.getByTestId("chat-list-search")).toBe(before);
    expect(document.activeElement).toBe(before);
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
    await waitFor(() => expect(visible()).toEqual([ANNA]));
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
    await waitFor(() => expect(visible()).toEqual([CLARA]));
  });

  it("`filters={false}` hides the controls but still filters", async () => {
    const server = renderInbox({ filters: false, search: "oak" });
    await waitFor(() => expect(visible()).toEqual([CLARA]));
    expect(screen.queryByTestId("chat-list-toolbar")).toBeNull();
    expect(searchTerms(server)).toEqual(["oak"]);
  });
});
