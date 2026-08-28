/**
 * WHAT THE THREAD IS ABOUT — the client half of stapel-chat 0.6.0 subjects.
 *
 * Two properties, and the pair of them is the whole feature:
 *
 *   the WRITE  "message the seller" sends `subject_type`/`subject_key`, which
 *              is what widens `direct_key` into one thread per listing. A
 *              half-supplied subject is dropped rather than sent, because
 *              upstream refuses it (`chat_incomplete_subject`);
 *   the READ   the thread pins the subject owner's card at the top — photo,
 *              title, price, link — and a thread with no subject is exactly
 *              what it always was.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StartChatButton, ConversationThreadPanel } from "../src/default/index.js";
import type { Conversation } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  BUYER,
  CONVERSATION_ID,
  SELLER,
  conversation,
  messagePage,
} from "./fixtures.js";

/** A card in the shape `classified.subject_cards` serves. */
function listingCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    listing_id: "42",
    title: "Bicycle, almost new",
    price: 45000,
    currency: "RUB",
    location_label: "Yerevan",
    state: "available",
    url: "/listings/42",
    image: {
      ref: "image/abc",
      preview_b64: "data:image/webp;base64,AAAA",
      variants: [
        { tier: "64", branch: null, url: "/media/cdn/image/abc/64.webp", width: 64 },
        { tier: "240", branch: "w", url: "/media/cdn/image/abc/240w.webp", width: 240 },
        { tier: "720", branch: "w", url: "/media/cdn/image/abc/720w.webp", width: 720 },
      ],
    },
    meta_status: "ok",
    ...overrides,
  };
}

function withSubject(card: Record<string, unknown> | null): Conversation {
  return conversation({
    subject: { type: "listing", key: "42", card, meta_status: card === null ? "partial" : "ok" },
  });
}

function renderThread(row: Conversation | null, seqs: readonly number[] = [1, 2]): MockServer {
  const server = mockServer({
    "GET /messages": { body: messagePage(seqs) },
    "POST /read": { body: {} },
    ...(row === null
      ? {}
      : { "GET /conversations/": { body: row } }),
  });
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
    </TestHarness>
  );
  return server;
}

describe('"message the seller" about a listing', () => {
  it("sends the subject, which is what gives the pair a thread per listing", async () => {
    const server = mockServer({
      "POST /conversations": { body: conversation() },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <StartChatButton
          sellerId={SELLER}
          viewerId={BUYER}
          subjectType="listing"
          subjectKey={42}
        />
      </TestHarness>
    );
    screen.getByTestId("chat-start-button").click();
    await waitFor(() =>
      expect(server.calls.some((call) => call.method === "POST")).toBe(true)
    );
    const created = server.calls.find((call) => call.method === "POST");
    expect(created?.body).toEqual({
      kind: "direct",
      participant_ids: [SELLER],
      subject_type: "listing",
      subject_key: "42",
    });
  });

  it("drops a half-supplied subject rather than sending one upstream refuses", async () => {
    const server = mockServer({
      "POST /conversations": { body: conversation() },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }}>
        <StartChatButton sellerId={SELLER} viewerId={BUYER} subjectType="listing" />
      </TestHarness>
    );
    screen.getByTestId("chat-start-button").click();
    await waitFor(() =>
      expect(server.calls.some((call) => call.method === "POST")).toBe(true)
    );
    expect(server.calls.find((call) => call.method === "POST")?.body).toEqual({
      kind: "direct",
      participant_ids: [SELLER],
    });
  });
});

describe("the thread says what it is about", () => {
  it("pins the card: photo, title, price, and a link to the listing", async () => {
    renderThread(withSubject(listingCard()));
    await waitFor(() => expect(screen.getByTestId("chat-subject")).toBeTruthy());
    expect(screen.getByTestId("chat-subject-title").textContent).toBe(
      "Bicycle, almost new"
    );
    // The price is DATA — `Intl` renders it for the reader's locale.
    expect(screen.getByTestId("chat-subject-price").textContent).toContain("45,000");
    expect(screen.getByTestId("chat-subject-link").getAttribute("href")).toBe(
      "/listings/42"
    );
    // The smallest variant wide enough for a thumbnail, not the 720 tier.
    expect(screen.getByTestId("chat-subject-thumb").getAttribute("src")).toBe(
      "/media/cdn/image/abc/240w.webp"
    );
  });

  it("a deleted listing is drawn with its own sentence, not as an empty box", async () => {
    renderThread(withSubject(listingCard({ state: "gone", title: "", url: "", image: null })));
    await waitFor(() => expect(screen.getByTestId("chat-subject")).toBeTruthy());
    expect(screen.getByTestId("chat-subject-note").textContent).toBe(
      "This has been removed."
    );
    expect(screen.queryByTestId("chat-subject-link")).toBeNull();
  });

  it("a card the provider could not build says so", async () => {
    renderThread(withSubject(null));
    await waitFor(() => expect(screen.getByTestId("chat-subject")).toBeTruthy());
    expect(screen.getByTestId("chat-subject-note").textContent).toBe(
      "We couldn't load what this conversation is about."
    );
  });

  it("a thread with no subject renders no card and still works", async () => {
    renderThread(conversation());
    await waitFor(() =>
      expect(screen.getAllByTestId("chat-message")).toHaveLength(2)
    );
    expect(screen.queryByTestId("chat-subject")).toBeNull();
  });

  it("the empty arm of a subject thread explains why it is empty", async () => {
    // The known cost of widening `direct_key`: the first message about a
    // listing opens a NEW thread beside the pair's old catch-all one. The
    // copy answers that without naming it.
    renderThread(withSubject(listingCard()), []);
    await waitFor(() => expect(screen.getByTestId("chat-thread-empty")).toBeTruthy());
    expect(screen.getByTestId("chat-thread-empty").textContent).toContain(
      "No messages about this yet"
    );
  });
});
