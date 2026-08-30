/**
 * PRESENCE IS ABOUT THE OTHER PERSON — the client half of stapel-chat 0.7.0.
 *
 * The defect these tests pin: the header drew "Live" whenever
 * THIS browser's socket was up, beside the seller's name, and every reader
 * took it to mean the seller was there. The two properties that replace it:
 *
 *   the READ   the header renders `participants[].online` / `.last_seen_at`
 *              — a server-side fact about that person's own connections — and
 *              nothing on the screen is derived from this client's transport;
 *   the LIVE   `chat.presence.changed` flips it without a refetch.
 *
 * The negative test is the load-bearing one: a live socket with an OFFLINE
 * counterparty must say "last seen …", because that is precisely the case the
 * old header got backwards.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { ConversationThreadPanel } from "../src/default/index.js";
import {
  PRESENCE_UNKNOWN,
  applyConversationPresence,
  chatQueryKeys,
  participantPresence,
  presenceAt,
  presenceExpired,
  presenceExpiryDelay,
  readChatPresenceFrame,
} from "../src/index.js";
import type { Conversation } from "../src/index.js";
import { chatI18nBundleRu } from "../src/i18n/ru.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, CONVERSATION_ID, SELLER, conversation, messagePage } from "./fixtures.js";

/** A conversation whose SELLER carries presence. */
function withPresence(
  online: boolean,
  lastSeenAt: string | null = "2026-08-30T09:00:00Z"
): Conversation {
  return conversation({
    participants: [
      { user_id: BUYER, role: "member", last_read_seq: 1, online: true, last_seen_at: null },
      {
        user_id: SELLER,
        role: "member",
        last_read_seq: 3,
        online,
        last_seen_at: lastSeenAt,
      },
    ],
  });
}

function renderThread(row: Conversation): void {
  const server = mockServer({
    "GET /messages": { body: messagePage([1, 2]) },
    "POST /read": { body: {} },
    "GET /conversations/": { body: row },
  });
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
    </TestHarness>
  );
}

describe("the header says whether the OTHER person is there", () => {
  it("renders online when the counterparty is connected", async () => {
    renderThread(withPresence(true));
    const line = await screen.findByTestId("chat-presence");
    expect(line.getAttribute("data-online")).toBe("true");
  });

  it("renders a last-seen time when they are not — the case the old tag got backwards", async () => {
    // This client's socket is irrelevant here and the harness gives it none;
    // the answer comes from the participant row either way.
    renderThread(withPresence(false, "2026-08-30T09:00:00Z"));
    const line = await screen.findByTestId("chat-presence");
    expect(line.getAttribute("data-online")).toBe("false");
    expect(line.textContent ?? "").not.toBe("");
  });

  it("says plainly 'offline' rather than inventing a date nobody has", async () => {
    renderThread(withPresence(false, null));
    const line = await screen.findByTestId("chat-presence");
    expect(line.getAttribute("data-online")).toBe("false");
  });

  it("says nothing in a thread with more than one other party", async () => {
    // "Online" names a person. In a group it names nobody, so there is no
    // sentence to render — and an adjective about four people would be the
    // same overreach the old tag committed.
    renderThread(
      conversation({
        kind: "group",
        participants: [
          { user_id: BUYER, role: "member", last_read_seq: 1 },
          { user_id: SELLER, role: "member", last_read_seq: 3, online: true },
          { user_id: "u-third", role: "member", last_read_seq: 0, online: true },
        ],
      })
    );
    await screen.findByTestId("chat-thread");
    expect(screen.queryByTestId("chat-presence")).toBeNull();
  });

  it("the Russian sentence carries both genders", () => {
    // The contract knows a user id, never a gender. "byl(a)" — the both-genders form is the only
    // form that is not wrong for half of a marketplace.
    expect(chatI18nBundleRu["chat.presence.last_seen"]).toContain("был(а)");
    expect(chatI18nBundleRu["chat.presence.online"]).toBe("в сети");
  });
});

describe("a server that does not send presence yet", () => {
  it("reads as offline with nothing to say, never as online", () => {
    // The fields are OPTIONAL in the schema. A 0.6.x host omits them, and the
    // ONLY safe direction to degrade in is silence: a false 'online' is the
    // entire defect.
    const row = conversation();
    expect(participantPresence(row, SELLER)).toEqual(PRESENCE_UNKNOWN);
  });

  it("answers the same for a participant who is not on the thread", () => {
    expect(participantPresence(conversation(), "u-stranger")).toEqual(PRESENCE_UNKNOWN);
    expect(participantPresence(undefined, SELLER)).toEqual(PRESENCE_UNKNOWN);
  });
});

describe("chat.presence.changed", () => {
  const frame = (payload: Record<string, unknown>) => ({
    type: "chat.presence.changed",
    stream: `chat:conv:${CONVERSATION_ID}`,
    payload,
    envelopeSeq: undefined,
    payloadSeq: undefined,
  });

  it("is read off the wire with both fields", () => {
    const read = readChatPresenceFrame(
      frame({
        conversation_id: CONVERSATION_ID,
        user_id: SELLER,
        online: true,
        last_seen_at: "2026-08-30T10:00:00Z",
        online_until: "2026-08-30T10:01:30Z",
      })
    );
    expect(read).toEqual({
      conversation_id: CONVERSATION_ID,
      user_id: SELLER,
      online: true,
      last_seen_at: "2026-08-30T10:00:00Z",
      // The deadline that makes the frame self-limiting.
      online_until: "2026-08-30T10:01:30Z",
    });
  });

  it("treats anything that is not literally true as NOT online", () => {
    // A truthy-but-wrong value must not be able to paint somebody present.
    const read = readChatPresenceFrame(
      frame({ conversation_id: CONVERSATION_ID, user_id: SELLER, online: "yes" })
    );
    expect(read?.online).toBe(false);
  });

  it("flips the cached conversation without a refetch", () => {
    const client = new QueryClient();
    client.setQueryData(chatQueryKeys.conversation(CONVERSATION_ID), withPresence(false));
    const changed = applyConversationPresence(client, {
      conversation_id: CONVERSATION_ID,
      user_id: SELLER,
      online: true,
      last_seen_at: "2026-08-30T10:00:00Z",
      online_until: null,
    });
    expect(changed).toBe(true);
    const row = client.getQueryData<Conversation>(
      chatQueryKeys.conversation(CONVERSATION_ID)
    );
    expect(participantPresence(row, SELLER).online).toBe(true);
    // The other participant is untouched — a flip is about one person.
    expect(participantPresence(row, BUYER).online).toBe(true);
  });

  it("is a no-op when nothing actually changed, so no render is spent", () => {
    const client = new QueryClient();
    client.setQueryData(
      chatQueryKeys.conversation(CONVERSATION_ID),
      withPresence(true, "2026-08-30T09:00:00Z")
    );
    expect(
      applyConversationPresence(client, {
        conversation_id: CONVERSATION_ID,
        user_id: SELLER,
        online: true,
        last_seen_at: "2026-08-30T09:00:00Z",
        online_until: null,
      })
    ).toBe(false);
  });

  it("is a no-op for a conversation this client is not holding", () => {
    const client = new QueryClient();
    expect(
      applyConversationPresence(client, {
        conversation_id: CONVERSATION_ID,
        user_id: SELLER,
        online: true,
        last_seen_at: null,
        online_until: null,
      })
    ).toBe(false);
  });
});

describe("the live tail repaints the header", () => {
  it("an arriving flip moves the line from last-seen to online", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const server = mockServer({
      "GET /messages": { body: messagePage([1, 2]) },
      "POST /read": { body: {} },
      "GET /conversations/": { body: withPresence(false) },
    });
    render(
      <TestHarness server={server} realtime={{ socketUrl: null }} queryClient={client}>
        <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
      </TestHarness>
    );
    const line = await screen.findByTestId("chat-presence");
    expect(line.getAttribute("data-online")).toBe("false");

    applyConversationPresence(client, {
      conversation_id: CONVERSATION_ID,
      user_id: SELLER,
      online: true,
      last_seen_at: "2026-08-30T10:00:00Z",
      online_until: null,
    });

    await waitFor(() =>
      expect(
        screen.getByTestId("chat-presence").getAttribute("data-online")
      ).toBe("true")
    );
  });
});

// ── the deadline expires locally (stapel-chat 0.7.3) ─────────────────────
//
// The defect: `chat.presence.changed` is announced from a DISCONNECT, and a
// lease running out announces nothing — nothing happens, so there is no event
// — while the lease exists for exactly the case where no disconnect ever runs.
// A header told only `online: true` kept saying it forever. Seen live: online
// 90s after the peer was gone, while the server already said offline.

describe("an online that expires on its own clock", () => {
  const at = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

  it("is still online before the deadline", () => {
    const p = { online: true, lastSeenAt: null, onlineUntil: at(60_000) };
    expect(presenceExpired(p)).toBe(false);
    expect(presenceAt(p).online).toBe(true);
  });

  it("reads offline once the deadline has passed, with no event at all", () => {
    const p = { online: true, lastSeenAt: at(-90_000), onlineUntil: at(-1_000) };
    expect(presenceExpired(p)).toBe(true);
    expect(presenceAt(p).online).toBe(false);
    // last-seen is untouched: it is still the last time anybody saw them.
    expect(presenceAt(p).lastSeenAt).toBe(p.lastSeenAt);
  });

  it("keeps the old behaviour when the server sends no deadline", () => {
    // An older server. Blinking every such participant offline because of a
    // field their backend has never heard of would be a worse lie than the
    // one this fixes.
    const p = { online: true, lastSeenAt: null, onlineUntil: null };
    expect(presenceExpired(p)).toBe(false);
    expect(presenceExpiryDelay(p)).toBeNull();
  });

  it("waits for nothing it cannot act on", () => {
    // Offline is already the final answer; an unparseable deadline is not a
    // reason to arm a timer that would fire on garbage.
    expect(presenceExpiryDelay({ online: false, lastSeenAt: null, onlineUntil: at(60_000) })).toBeNull();
    expect(presenceExpiryDelay({ online: true, lastSeenAt: null, onlineUntil: "not-a-date" })).toBeNull();
  });

  it("asks to be woken exactly when the deadline lands", () => {
    const p = { online: true, lastSeenAt: null, onlineUntil: at(45_000) };
    const delay = presenceExpiryDelay(p) ?? -1;
    expect(delay).toBeGreaterThan(43_000);
    expect(delay).toBeLessThanOrEqual(45_000);
    // Already past: due now, never negative.
    expect(presenceExpiryDelay({ ...p, onlineUntil: at(-5_000) })).toBe(0);
  });
});

describe("the header flips itself without any frame arriving", () => {
  it("goes from online to last-seen when the lease runs out", async () => {
    // A real, very short lease rather than fake timers: the thread mounts antd
    // and a query client, and freezing their clocks tests the harness instead
    // of the mechanism. 400ms is the same code path a 90-second one takes.
    const lease = new Date(Date.now() + 400).toISOString();
    const seen = new Date(Date.now() - 5_000).toISOString();
    renderThread(
      conversation({
        participants: [
          { user_id: BUYER, role: "member", last_read_seq: 1 },
          {
            user_id: SELLER,
            role: "member",
            last_read_seq: 3,
            online: true,
            last_seen_at: seen,
            online_until: lease,
          },
        ],
      })
    );
    const line = await screen.findByTestId("chat-presence");
    expect(line.getAttribute("data-online")).toBe("true");

    // No disconnect, no frame, no refetch — only time passing, which is
    // precisely the transition the server cannot announce.
    await waitFor(
      () =>
        expect(
          screen.getByTestId("chat-presence").getAttribute("data-online")
        ).toBe("false"),
      { timeout: 4000 }
    );
  });
});
