/**
 * THE SUBJECT LINE IS A SEAM, not only a default.
 *
 * The row already draws what a conversation is ABOUT — the subject card's
 * thumbnail, its title (a link to the listing, D420) and its price, read off
 * the card stapel-chat inlines in the list response. That default is what a
 * deployment gets for free, and these tests keep it: a conversation whose
 * provider serves the conventional card still paints exactly the strip it did.
 *
 * What is new is the way IN. `slots.subjectCard` has always been the THREAD's
 * pinned card and never reached an inbox row, so a deployment whose provider
 * answers a differently-shaped card — or answers no card at all, leaving the
 * envelope with the opaque `(subject_type, subject_key)` it always carries —
 * had an empty strip and nothing to do about it. `renderSubject` is that row's
 * half, and the three properties that make it a seam rather than a hook are
 * asserted here:
 *
 *   1. a host's line REPLACES the default one, rather than stacking under it;
 *   2. it is called for EVERY row — including a conversation with no card at
 *      all, which is precisely the row a host resolving keys can draw and this
 *      pair cannot;
 *   3. `null` is an ANSWER. A host saying "this thread has nothing to show"
 *      gets no strip, never a quiet fall back to the card it just declined.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversationListPanel } from "../src/default/index.js";
import type { Conversation } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, conversation, conversationPage } from "./fixtures.js";

/** A card in the shape `classified.subject_cards` serves. */
const LISTING_CARD: Record<string, unknown> = {
  title: "Bicycle, almost new",
  price: 45000,
  currency: "RUB",
  state: "available",
  url: "/listings/42",
};

/** A thread about a listing whose provider answered with a card. */
function withCard(): Conversation {
  return conversation({
    id: "c-card",
    subject: { type: "listing", key: "42", card: LISTING_CARD, meta_status: "ok" },
  });
}

/**
 * A thread about a listing whose provider answered NOTHING — the opaque
 * `(type, key)` and no card. The envelope shape a deployment with no
 * registered `card_function` (or a `missing` one) actually sends.
 */
function withKeyOnly(): Conversation {
  return conversation({
    id: "c-key-only",
    subject: { type: "listing", key: "77", card: null, meta_status: "missing" },
  });
}

function renderInbox(
  rows: readonly Conversation[],
  panelProps: Partial<Parameters<typeof ConversationListPanel>[0]> = {}
): void {
  const server = mockServer({
    "GET /conversations": { body: conversationPage(rows) },
  });
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <ConversationListPanel viewerId={BUYER} {...panelProps} />
    </TestHarness>
  );
}

async function rows(count: number): Promise<void> {
  await waitFor(() =>
    expect(screen.getAllByTestId("chat-conversation-row")).toHaveLength(count)
  );
}

describe("the default subject line", () => {
  it("draws the card's title and price with no host wiring at all", async () => {
    renderInbox([withCard()]);
    await rows(1);
    expect(screen.getByTestId("chat-row-subject-title").textContent).toBe(
      "Bicycle, almost new"
    );
    // The price is DATA — `Intl` renders it — so the assertion is that there
    // is one and that the amount is in it, not which spaces the locale used.
    expect(screen.getByTestId("chat-row-subject-price").textContent).toContain("45");
    expect(screen.getByTestId("chat-row-subject-link").getAttribute("href")).toBe(
      "/listings/42"
    );
  });

  it("draws NOTHING for a subject the provider could not build a card for", async () => {
    // The gap this seam exists for, stated as the row it leaves: a thread
    // that IS about a listing, with the key on the wire, and a strip a person
    // cannot see.
    renderInbox([withKeyOnly()]);
    await rows(1);
    expect(screen.queryByTestId("chat-row-subject")).toBeNull();
  });
});

describe("renderSubject", () => {
  it("replaces the pair's own line rather than stacking under it", async () => {
    renderInbox([withCard()], {
      renderSubject: (row) => <span data-testid="host-line">host: {row.id}</span>,
    });
    await rows(1);
    expect(screen.getByTestId("host-line").textContent).toBe("host: c-card");
    // The default is GONE, not hidden behind it: two subject lines on one row
    // would be the pair and the host disagreeing about the same fact.
    expect(screen.queryByTestId("chat-row-subject")).toBeNull();
    expect(screen.queryByTestId("chat-row-subject-title")).toBeNull();
  });

  it("is asked about a conversation the pair can draw nothing for", async () => {
    // The point of the seam: the host holds the catalogue, so the opaque key
    // is enough for it and is not enough for this pair.
    const seen: string[] = [];
    renderInbox([withKeyOnly()], {
      renderSubject: (row) => {
        seen.push(row.subject?.key ?? "");
        return <span data-testid="host-line">Listing #{row.subject?.key}</span>;
      },
    });
    await rows(1);
    expect(seen).toContain("77");
    expect(screen.getByTestId("host-line").textContent).toBe("Listing #77");
  });

  it("takes `null` as an answer and draws no strip", async () => {
    renderInbox([withCard()], { renderSubject: () => null });
    await rows(1);
    expect(screen.queryByTestId("chat-row-subject")).toBeNull();
    // Not a fall back to the card either — the host declined it.
    expect(screen.queryByTestId("chat-row-subject-title")).toBeNull();
  });

  it("keeps the host's line OUT of the row control (D420)", async () => {
    // The one thing about the strip that is layout and not content: the row
    // is a control that opens the thread, and a link inside it would be a
    // control inside a control. So whatever comes back is a SIBLING of the
    // row control, not a descendant of it.
    renderInbox([withCard()], {
      openHref: (id) => `/chat/${id}`,
      renderSubject: () => (
        <a href="/listings/42" data-testid="host-line">
          Bicycle
        </a>
      ),
    });
    await rows(1);
    const rowControl = document.querySelector("[data-chat-row-open]");
    const hostLine = screen.getByTestId("host-line");
    expect(rowControl).not.toBeNull();
    expect(rowControl?.contains(hostLine)).toBe(false);
  });
});
