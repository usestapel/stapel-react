/**
 * THE INBOX IS A LIST OF PEOPLE, NOT A LIST OF CATEGORIES.
 *
 * The defect these tests pin: every row's title was the conversation KIND, so
 * a seller with ten buyers read ten rows saying "Direct message" and told
 * them apart by the clock. The fix is a host seam, and the two properties
 * that make it a fix rather than a rearrangement are both asserted here:
 *
 *   1. three conversations with three counterparties render three DIFFERENT
 *      names, and
 *   2. they are resolved in ONE batch — the id set is asked about once for
 *      the whole page, never once per row. The count is asserted against a
 *      real `useQuery` inside the fake seam, so "one batch" is measured the
 *      way a host's `useProfilesBatch` would actually behave: per distinct
 *      query key, per fetch, not per render.
 *
 * And the third, which is the one the house has been bitten by before: with
 * NO seam wired the row must say it could not name the person, not fall back
 * to a label that looks deliberate.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { ConversationListPanel } from "../src/default/index.js";
import type { ChatPeopleSlot, ChatPerson, Conversation } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { ConversationThreadPanel } from "../src/default/index.js";
import {
  BUYER,
  CONVERSATION_ID,
  conversation,
  conversationPage,
  messagePage,
} from "./fixtures.js";

const NAMES: Readonly<Record<string, string>> = {
  "u-anna": "Anna Petrova",
  "u-boris": "Boris Ivanov",
  "u-clara": "Clara Weiss",
};

/** Three threads, three different people, one reader. */
function threeConversations(): readonly Conversation[] {
  return Object.keys(NAMES).map((sellerId, index) =>
    conversation({
      id: `c-${sellerId}`,
      unread_count: index === 0 ? 2 : 0,
      updated_at: `2026-08-2${index + 1}T10:00:00Z`,
      participants: [
        { user_id: BUYER, role: "member", last_read_seq: 0 },
        { user_id: sellerId, role: "member", last_read_seq: 0 },
      ],
    })
  );
}

/**
 * A people seam shaped like the real one: a batch read behind TanStack, keyed
 * by the id set. `fetches` therefore counts REQUESTS — one per distinct set —
 * which is exactly the number a host wiring `useProfilesBatch` would pay.
 */
function peopleSlot(): { slot: ChatPeopleSlot; fetches: () => number; keys: () => string[] } {
  let fetches = 0;
  const keys: string[] = [];
  // Named as a COMPONENT, because it is one: it calls a hook, exactly as a
  // host's `useProfilesBatch` wiring does.
  function People(props: Parameters<ChatPeopleSlot>[0]) {
    const key = [...props.userIds].sort().join(",");
    const query = useQuery({
      queryKey: ["test-people", key],
      queryFn: () => {
        fetches += 1;
        keys.push(key);
        return Promise.resolve(NAMES);
      },
      enabled: key.length > 0,
    });
    const found = query.data;
    return props.children({
      pending: query.isPending,
      lookup: (userId): ChatPerson | null => {
        const displayName = found?.[userId];
        return displayName === undefined ? null : { userId, displayName };
      },
    });
  }
  return { slot: People, fetches: () => fetches, keys: () => keys };
}

function renderInbox(rows: readonly Conversation[], slot?: ChatPeopleSlot) {
  const server = mockServer({
    "GET /conversations": { body: conversationPage(rows) },
  });
  render(
    <TestHarness
      server={server}
      realtime={{ socketUrl: null }}
      {...(slot !== undefined ? { slots: { people: slot } } : {})}
    >
      <ConversationListPanel viewerId={BUYER} openHref={(id) => `/chat/${id}`} />
    </TestHarness>
  );
  return server;
}

describe("the inbox names the person, not the kind", () => {
  it("renders three different counterparties, resolved in ONE batch", async () => {
    const people = peopleSlot();
    renderInbox(threeConversations(), people.slot);

    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(3)
    );
    for (const displayName of Object.values(NAMES)) {
      await waitFor(() => expect(screen.getByText(displayName)).toBeTruthy());
    }

    // The kind is no longer a title anywhere on this screen.
    expect(screen.queryByText("Direct message")).toBeNull();

    // ONE request for the whole page — the claim, measured. A per-row seam
    // would have produced three distinct keys and three fetches.
    expect(people.fetches()).toBe(1);
    expect(people.keys()).toEqual(["u-anna,u-boris,u-clara"]);
  });

  it("without a seam it says the name is unavailable — never the kind", async () => {
    renderInbox(threeConversations());
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(3)
    );
    // The honest sentence, three times — a row that cannot name its person
    // must look unfinished, because it is.
    expect(screen.getAllByText("Name unavailable")).toHaveLength(3);
    expect(screen.queryByText("Direct message")).toBeNull();
  });

  it("a support case is named by its kind — there is no person to name", async () => {
    const people = peopleSlot();
    renderInbox(
      [
        conversation({
          id: "c-support",
          kind: "support",
          support_status: "open",
          participants: [{ user_id: BUYER, role: "member", last_read_seq: 0 }],
        }),
      ],
      people.slot
    );
    await waitFor(() => expect(screen.getByText("Support")).toBeTruthy());
  });

  it("keeps the server's unread badge and its accessible sentence", async () => {
    const people = peopleSlot();
    renderInbox(threeConversations(), people.slot);
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(3)
    );
    expect(screen.getByLabelText("2 unread")).toBeTruthy();
  });

  it("shows the last line this client already holds, and asks nobody for it", async () => {
    const people = peopleSlot();
    const rows = threeConversations();
    const server = mockServer({
      "GET /conversations": { body: conversationPage(rows) },
    });
    render(
      <TestHarness
        server={server}
        realtime={{ socketUrl: null }}
        slots={{ people: people.slot }}
      >
        <ConversationListPanel viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(3)
    );
    // No thread was opened this session, so no preview is claimed — and the
    // list did NOT go and fetch one per row to invent it.
    expect(screen.queryAllByTestId("chat-row-preview")).toHaveLength(0);
    expect(server.calls.filter((call) => call.url.includes("/messages"))).toEqual([]);
  });

  it("shows the last line for a thread the client HAS, marked as the reader's own", async () => {
    // The other half of the same rule: a preview is rendered exactly when this
    // client honestly holds the message. Opening the thread is what makes it
    // hold one — and the row then reads it out of the cache, not off the wire.
    const people = peopleSlot();
    const row = conversation({
      id: CONVERSATION_ID,
      participants: [
        { user_id: BUYER, role: "member", last_read_seq: 0 },
        { user_id: "u-anna", role: "member", last_read_seq: 0 },
      ],
    });
    const server = mockServer({
      // Declared first: the messages URL contains "/conversations" too.
      "GET /messages": { body: messagePage([1, 2]) },
      "POST /read": { body: {} },
      "GET /conversations": { body: conversationPage([row]) },
    });
    render(
      <TestHarness
        server={server}
        realtime={{ socketUrl: null }}
        slots={{ people: people.slot }}
      >
        <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
        <ConversationListPanel viewerId={BUYER} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("chat-row-preview").textContent).toBe(
        "You: message 2"
      )
    );
  });
});

/**
 * THE ROW NAMES THE LISTING, NOT JUST ITS TITLE.
 *
 * A row for a conversation with a subject (stapel-chat 0.6.0) used to draw
 * only `subjectRowLabel()`'s title text — the same card already carries a
 * price and a thumbnail (`readSubjectCard`), and a buyer scanning ten threads
 * about ten different listings could not tell them apart by price at a
 * glance, nor recognize one by its photo. The row now draws thumbnail, title
 * and price on one line, and a conversation with no subject — or a subject
 * whose card is missing entirely — renders exactly as it always did.
 */
function listingCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    listing_id: "42",
    title: "Bicycle, almost new",
    price: 45000,
    currency: "RUB",
    state: "available",
    url: "/listings/42",
    image: {
      ref: "image/abc",
      preview_b64: "data:image/webp;base64,AAAA",
      variants: [
        { tier: "64", branch: null, url: "/media/cdn/image/abc/64.webp", width: 64 },
        { tier: "240", branch: "w", url: "/media/cdn/image/abc/240w.webp", width: 240 },
      ],
    },
    meta_status: "ok",
    ...overrides,
  };
}

function withListingSubject(card: Record<string, unknown> | null): Conversation {
  return conversation({
    subject: {
      type: "listing",
      key: "42",
      card,
      meta_status: card === null ? "partial" : "ok",
    },
  });
}

describe("the inbox row shows what the conversation is about", () => {
  it("renders the subject's thumbnail and price beside its title", async () => {
    const people = peopleSlot();
    renderInbox([withListingSubject(listingCard())], people.slot);
    await waitFor(() =>
      expect(screen.getByTestId("chat-conversation-row")).toBeTruthy()
    );
    expect(screen.getByTestId("chat-row-subject-title").textContent).toBe(
      "Bicycle, almost new"
    );
    // The price is DATA — `Intl` renders it for the reader's locale, same as
    // the pinned thread card.
    expect(screen.getByTestId("chat-row-subject-price").textContent).toContain(
      "45,000"
    );
    // The smallest variant wide enough for a thumbnail, not a 720px one.
    const thumb = screen.getByTestId("chat-row-subject-thumb");
    expect(thumb.tagName).toBe("IMG");
    expect(thumb.getAttribute("src")).toBe("/media/cdn/image/abc/240w.webp");
    expect(thumb.getAttribute("alt")).toBe("Bicycle, almost new");
  });

  it("a conversation without a subject renders as it always did", async () => {
    const people = peopleSlot();
    renderInbox(threeConversations(), people.slot);
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(3)
    );
    expect(screen.queryByTestId("chat-row-subject")).toBeNull();
    expect(screen.queryByTestId("chat-row-subject-thumb")).toBeNull();
  });

  it("a subject with no photo draws the themed placeholder, never a broken image", async () => {
    const people = peopleSlot();
    renderInbox([withListingSubject(listingCard({ image: null }))], people.slot);
    await waitFor(() =>
      expect(screen.getByTestId("chat-row-subject-thumb")).toBeTruthy()
    );
    const thumb = screen.getByTestId("chat-row-subject-thumb");
    expect(thumb.tagName).toBe("DIV");
    expect(thumb.getAttribute("data-photo")).toBe("none");
    // Still the title and price — only the photo is missing.
    expect(screen.getByTestId("chat-row-subject-title").textContent).toBe(
      "Bicycle, almost new"
    );
  });

  it("a subject whose card could not be built draws no subject line at all", async () => {
    const people = peopleSlot();
    renderInbox([withListingSubject(null)], people.slot);
    await waitFor(() =>
      expect(screen.getByTestId("chat-conversation-row")).toBeTruthy()
    );
    expect(screen.queryByTestId("chat-row-subject")).toBeNull();
  });
});
