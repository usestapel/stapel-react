/**
 * NOTIFICATIONS — asked at a moment that earned it, shown only when unseen.
 *
 * Two halves, and the first is the one that is easy to get wrong:
 *
 *   the ASK    never on page load. `denied` is TERMINAL — the browser will
 *              not prompt again — so a prompt on arrival, answered "no" by
 *              somebody who does not yet know what the product is, spends the
 *              only chance there is. The prompt opens at the first message
 *              exchanged in the open thread.
 *   the SHOW   only while the tab is hidden, never for your own message,
 *              never for a tombstone or a system line.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChatNotifications } from "../src/index.js";
import type { ChatSignal } from "../src/index.js";
import { ConversationThreadPanel } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, CONVERSATION_ID, SELLER, conversation, messagePage } from "./fixtures.js";

// ── the SHOW half ────────────────────────────────────────────────────────

interface FakeNotification {
  readonly title: string;
  readonly options: NotificationOptions | undefined;
}

let shown: FakeNotification[] = [];

function installNotification(permission: NotificationPermission): void {
  class Fake {
    onclick: (() => void) | null = null;
    static permission = permission;
    static requestPermission = async (): Promise<NotificationPermission> => permission;
    constructor(title: string, options?: NotificationOptions) {
      shown.push({ title, options });
    }
    close(): void {
      /* nothing to tear down in a fake */
    }
  }
  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: Fake,
  });
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function messageSignal(overrides: Record<string, unknown> = {}): ChatSignal {
  return {
    kind: "message",
    conversationId: CONVERSATION_ID,
    seq: 4,
    revSeq: 4,
    revision: false,
    message: {
      message_id: "m-4",
      conversation_id: CONVERSATION_ID,
      sender_id: SELLER,
      seq: 4,
      rev_seq: 4,
      kind: "text",
      body: "Still available?",
      reply_to: null,
      attachments: [],
      client_msg_id: null,
      edited: false,
      edited_at: null,
      deleted: false,
      deleted_at: null,
      created_at: "2026-08-30T10:00:00Z",
      ...overrides,
    },
  } as ChatSignal;
}

function fire(signal: ChatSignal, enabled = true): void {
  const { result } = renderHook(() =>
    useChatNotifications({
      viewerId: BUYER,
      enabled,
      copy: () => ({ title: "New message", body: "Still available?" }),
    })
  );
  result.current(signal);
}

describe("a notification is for a message you did not see", () => {
  beforeEach(() => {
    shown = [];
    installNotification("granted");
    setVisibility("hidden");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows one when the tab is hidden and the message is theirs", () => {
    fire(messageSignal());
    expect(shown).toHaveLength(1);
    expect(shown[0]?.title).toBe("New message");
  });

  it("shows nothing while the tab is in front of the person", () => {
    // A notification for a message already on screen is a second copy of
    // something they are reading.
    setVisibility("visible");
    fire(messageSignal());
    expect(shown).toHaveLength(0);
  });

  it("never notifies you about your own message", () => {
    fire(messageSignal({ sender_id: BUYER }));
    expect(shown).toHaveLength(0);
  });

  it("never notifies about a tombstone or a system line", () => {
    fire(messageSignal({ deleted: true, body: "" }));
    fire(messageSignal({ kind: "system" }));
    expect(shown).toHaveLength(0);
  });

  it("collapses a burst onto one tag per thread rather than stacking alerts", () => {
    fire(messageSignal());
    fire(messageSignal({ message_id: "m-5", seq: 5 }));
    expect(shown.map((n) => n.options?.tag)).toEqual([
      `chat:${CONVERSATION_ID}`,
      `chat:${CONVERSATION_ID}`,
    ]);
  });

  it("shows nothing when the deployment did not opt in", () => {
    fire(messageSignal(), false);
    expect(shown).toHaveLength(0);
  });

  it("shows nothing when the browser has not granted the permission", () => {
    // The hook never asks; a permission that is not there is simply not spent.
    installNotification("default");
    fire(messageSignal());
    expect(shown).toHaveLength(0);
  });

  it("shows nothing when the person refused", () => {
    installNotification("denied");
    fire(messageSignal());
    expect(shown).toHaveLength(0);
  });
});

// ── the ASK half ─────────────────────────────────────────────────────────

function renderThread(): void {
  const server = mockServer({
    "GET /messages": { body: messagePage([1, 2]) },
    "POST /read": { body: {} },
    "GET /conversations/": { body: conversation() },
  });
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <ConversationThreadPanel conversationId={CONVERSATION_ID} viewerId={BUYER} />
    </TestHarness>
  );
}

describe("the ask waits for a moment that has earned it", () => {
  beforeEach(() => {
    shown = [];
    installNotification("default");
    setVisibility("visible");
  });

  it("does not prompt on page load", async () => {
    // The whole point. A thread that opens with history behind it has not
    // exchanged anything YET, and asking here is the prompt-on-arrival that
    // spends the only chance the browser gives.
    renderThread();
    await screen.findByTestId("chat-thread");
    await waitFor(() => expect(screen.queryByTestId("chat-thread-title")).not.toBeNull());
    expect(screen.queryByTestId("chat-notifications-prompt")).toBeNull();
  });

  it("does not prompt when the browser has already refused", async () => {
    // `denied` is terminal — every control at that point is theatre, and the
    // sheet would be a button that cannot do anything.
    installNotification("denied");
    renderThread();
    await screen.findByTestId("chat-thread");
    expect(screen.queryByTestId("chat-notifications-prompt")).toBeNull();
  });

  it("does not prompt when it is already granted", async () => {
    installNotification("granted");
    renderThread();
    await screen.findByTestId("chat-thread");
    expect(screen.queryByTestId("chat-notifications-prompt")).toBeNull();
  });
});
