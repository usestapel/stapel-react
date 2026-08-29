/**
 * A DEGRADED TRANSPORT IS NEVER SILENT — and "configured but never connects"
 * is one of the names.
 *
 * `transport: "polling"` was true and useless: it read the same whether the
 * deployment has no sockets, the credential was refused, or the socket had
 * never once opened. A person saw "Refreshing every few seconds" and read it
 * as a product decision; so did everyone reporting that the websockets were
 * done. A degraded mode that cannot say why is indistinguishable from a
 * working product, which is exactly how it survives.
 *
 * Two halves here:
 *
 *  - the pure mapping (`chatDegradation`), over every state the substrate can
 *    report, each landing on a NAMED reason with an i18n key in all three
 *    locales — no state may fall through to an unnamed disconnected one;
 *  - the real runtime, driven until it produces `never_connected` — the state
 *    a whole deployment can sit in for months, and the one this pair was in.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RealtimeStreamStatus } from "@stapel/realtime";
import {
  chatDegradation,
  chatI18nBundleEn,
  chatInboxStream,
  useChatFreshness,
} from "../src/index.js";
import type { ChatDegradedReason } from "../src/index.js";
import { chatI18nBundleRu } from "../src/i18n/ru.js";
import { chatI18nBundleEs } from "../src/i18n/es.js";
import { TransportTag } from "../src/default/TransportTag.js";
import { TestHarness, installBrowserWebSocket, mockServer, ChatServer } from "./harness.js";
import type { BrowserWebSocketEnvironment } from "./harness.js";

const STREAM = chatInboxStream("u-buyer");

function status(patch: Partial<RealtimeStreamStatus>): RealtimeStreamStatus {
  return {
    stream: STREAM.key,
    state: "idle",
    refusal: undefined,
    reason: undefined,
    attempt: 0,
    cursor: 0,
    gap: undefined,
    serverSeq: undefined,
    ...patch,
  };
}

const HAS_SOCKET = { hasSocket: true, attempted: true };

describe("every reason a socket is not carrying a stream has a NAME", () => {
  it("a live or replaying stream is not degraded", () => {
    expect(chatDegradation(status({ state: "live" }), null, HAS_SOCKET)).toBeNull();
    expect(chatDegradation(status({ state: "replaying" }), null, HAS_SOCKET)).toBeNull();
  });

  it("resync is healing, not degrading — the socket is open and the store re-reads", () => {
    expect(
      chatDegradation(status({ state: "resync", gap: 900 }), null, HAS_SOCKET)
    ).toBeNull();
  });

  it("the substrate's five refusal kinds each get their own sentence", () => {
    const cases: [RealtimeStreamStatus["refusal"], ChatDegradedReason][] = [
      ["session", "sign_in_required"],
      ["origin", "origin_not_allowed"],
      ["forbidden", "forbidden"],
      ["revoked", "revoked"],
      ["stream_unknown", "unsupported"],
      ["unsupported", "unsupported"],
    ];
    for (const [refusal, reason] of cases) {
      expect(
        chatDegradation(status({ state: "refused", refusal }), null, HAS_SOCKET)?.reason
      ).toBe(reason);
    }
  });

  it("a first connect is not a degradation; a retried one is", () => {
    expect(
      chatDegradation(status({ state: "connecting", attempt: 0 }), null, HAS_SOCKET)
    ).toBeNull();
    expect(
      chatDegradation(status({ state: "reconnecting", attempt: 1 }), null, HAS_SOCKET)
        ?.reason
    ).toBe("reconnecting");
  });

  it("the substrate's named silences win over the generic reconnect", () => {
    const never = chatDegradation(
      status({ state: "reconnecting", attempt: 4 }),
      { kind: "never_connected", since: 1_000, attempts: 4 },
      HAS_SOCKET
    );
    expect(never?.reason).toBe("never_connected");
    expect(never?.since).toBe(1_000);

    const long = chatDegradation(
      status({ state: "reconnecting", attempt: 2 }),
      { kind: "reconnecting_long", since: 2_000, attempts: 2 },
      HAS_SOCKET
    );
    expect(long?.reason).toBe("reconnecting_long");
    expect(long?.since).toBe(2_000);
  });

  it("no provider, and no socket in this build, are both `no_socket` — never silence", () => {
    expect(
      chatDegradation(
        {
          stream: STREAM.key,
          state: "no_provider",
          refusal: undefined,
          reason: undefined,
          attempt: 0,
          cursor: 0,
          gap: undefined,
          serverSeq: undefined,
        },
        null,
        HAS_SOCKET
      )?.reason
    ).toBe("no_socket");
    expect(
      chatDegradation(status({ state: "idle" }), null, {
        hasSocket: false,
        attempted: true,
      })?.reason
    ).toBe("no_socket");
  });

  it("every reason carries a key that resolves in en, ru and es", () => {
    const reasons: ChatDegradedReason[] = [
      "reconnecting",
      "reconnecting_long",
      "never_connected",
      "sign_in_required",
      "forbidden",
      "revoked",
      "origin_not_allowed",
      "unsupported",
      "no_socket",
    ];
    for (const reason of reasons) {
      const degraded = chatDegradation(
        status({ state: "refused", refusal: "forbidden" }),
        null,
        HAS_SOCKET
      );
      expect(degraded).not.toBeNull();
      // Build the key the same way the mapper does, then prove all three
      // bundles answer it: a named degradation nobody translated is a raw key
      // on a customer's screen.
      const key = `chat.transport.degraded.${reason}`;
      expect(chatI18nBundleEn[key]).toBeTruthy();
      expect(chatI18nBundleRu[key]).toBeTruthy();
      expect(chatI18nBundleEs[key]).toBeTruthy();
    }
  });
});

// ── the real runtime ─────────────────────────────────────────────────────────

let env: BrowserWebSocketEnvironment;
const retries: { fn: () => void; delay: number }[] = [];
let nowMs = 1_000_000;

beforeEach(() => {
  retries.length = 0;
  nowMs = 1_000_000;
  env = installBrowserWebSocket();
});

afterEach(() => {
  env.restore();
});

function Surface(): React.ReactElement {
  const freshness = useChatFreshness(STREAM, () => [], { fallbackRefetchInterval: 0 });
  return (
    <div>
      <span data-testid="transport">{freshness.transport}</span>
      <span data-testid="degraded">{freshness.degraded?.reason ?? "none"}</span>
      <span data-testid="attempt">{freshness.degraded?.attempt ?? -1}</span>
    </div>
  );
}

function mount(): void {
  render(
    <TestHarness
      server={mockServer({})}
      realtime={{
        socketUrl: "wss://chat.test",
        schedule: (fn, delay) => {
          retries.push({ fn, delay });
          return () => {
            const index = retries.findIndex((entry) => entry.fn === fn);
            if (index >= 0) retries.splice(index, 1);
          };
        },
        now: () => nowMs,
        random: () => 0.5,
      }}
    >
      <Surface />
    </TestHarness>
  );
}

/** Run the earliest pending retry — a reconnect, or a degradation deadline. */
function runNextTimer(): void {
  const entry = retries.shift();
  if (entry === undefined) throw new Error("nothing scheduled");
  act(() => {
    entry.fn();
  });
}

describe("a socket that is configured and never connects SAYS SO", () => {
  it("names never_connected rather than spinning on `reconnecting` forever", async () => {
    mount();
    await waitFor(() => expect(env.sockets.length).toBe(1));

    // An ingress that does not upgrade, an allowlist nobody filled in: the
    // handshake dies without ever opening, over and over.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => {
        env.last().serverClose(1006);
      });
      runNextTimer();
    }

    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("never_connected")
    );
    // Not "reconnecting": it never connected once. That distinction is the
    // difference between "your network went away" and "this was never wired
    // up here", and only the second one an operator can act on.
    expect(screen.getByTestId("transport").textContent).not.toBe("socket");
    expect(Number(screen.getByTestId("attempt").textContent)).toBeGreaterThanOrEqual(3);
  });

  it("a socket that WORKED and then went away is reconnecting_long, not never_connected", async () => {
    mount();
    await waitFor(() => expect(env.sockets.length).toBe(1));
    const consumer = new ChatServer(env.last(), { stream: STREAM.key, ephemeral: true });
    act(() => {
      consumer.accept();
    });
    await waitFor(() =>
      expect(screen.getByTestId("transport").textContent).toBe("socket")
    );

    act(() => {
      env.last().serverClose(1006);
    });
    // A minute down, on the injected clock. The runtime re-derives on a timer
    // precisely because silence produces no events to hang the answer on.
    nowMs += 61_000;
    await waitFor(() => expect(retries.length).toBeGreaterThan(0));
    runNextTimer();

    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("reconnecting_long")
    );
  });
});

// ── the label a healthy screen wears ─────────────────────────────────────────

/**
 * THE REGRESSION THIS BLOCK EXISTS FOR.
 *
 * `chatDegradation` was right the whole time; the SKIN was not. `TransportTag`
 * fell back to a transport label whenever `degraded` was `null`, and the
 * transport is `"polling"` for every state that is not live — including the
 * three healthy ones: a socket still connecting, a socket deliberately held
 * back until the thread window loads, and a resync catching up. The label for
 * `"polling"` was "Refreshing every few seconds", so a perfectly healthy
 * screen printed the pair's own complaint copy as a standing banner, from its
 * first frame until the socket opened.
 *
 * That is worse than the original defect it was written for. The original was
 * a true sentence nobody could act on; this was the same sentence shown when
 * it was FALSE, which leaves a person no way to tell a fixed product from a
 * broken one and teaches them to skip the one message that matters.
 *
 * So the assertion is about the copy, not about the internal state: no screen
 * whose socket is fine may say anything about refreshing on a timer.
 */
const REFRESH_COPY = /refreshing|every few seconds/i;

function TaggedSurface(): React.ReactElement {
  // A non-zero fallback interval is the shape that produced the bug: the
  // polling timer IS armed while the socket is connecting, so `transport`
  // reads "polling" on a screen where nothing is wrong.
  const freshness = useChatFreshness(STREAM, () => [], {
    fallbackRefetchInterval: 3_000,
  });
  return (
    <TransportTag
      transport={freshness.transport}
      degraded={freshness.degraded}
      status={freshness.status}
    />
  );
}

function mountTagged(): void {
  render(
    <TestHarness
      server={mockServer({})}
      realtime={{
        socketUrl: "wss://chat.test",
        schedule: (fn, delay) => {
          retries.push({ fn, delay });
          return () => {
            const index = retries.findIndex((entry) => entry.fn === fn);
            if (index >= 0) retries.splice(index, 1);
          };
        },
        now: () => nowMs,
        random: () => 0.5,
      }}
    >
      <TaggedSurface />
    </TestHarness>
  );
}

describe("a screen whose socket is fine never says it is refreshing on a timer", () => {
  it("says nothing about refreshing while the socket is still connecting", async () => {
    mountTagged();
    await waitFor(() => expect(env.sockets.length).toBe(1));
    const tag = screen.getByTestId("chat-transport");
    // The frame a person sees first, and the frame a shot runner keeps.
    expect(tag.textContent ?? "").not.toMatch(REFRESH_COPY);
    // Nothing is wrong, so nothing is named as wrong.
    expect(tag.getAttribute("data-degraded")).toBeNull();
  });

  it("a live socket says NOTHING — the working state needs no chrome", async () => {
    // Through 0.5.x this asserted the tag read "Live" ("Live" in Russian).
    // That label sat in the thread header beside the counterparty's name and
    // every person using the product read it as "the seller is online" — a
    // statement about the READER's own network wearing somebody else's name.
    // Presence is its own line now (`PresenceLine`, from the server, about
    // them); this control speaks only about this client's transport, and only
    // when there is something to say. The expected state is silence.
    mountTagged();
    await waitFor(() => expect(env.sockets.length).toBe(1));
    const consumer = new ChatServer(env.last(), { stream: STREAM.key, ephemeral: true });
    act(() => {
      consumer.accept();
    });

    await waitFor(() => expect(screen.queryByTestId("chat-transport")).toBeNull());
    // And the sentence that started all of this is nowhere on the screen.
    expect(document.body.textContent ?? "").not.toMatch(REFRESH_COPY);
    expect(document.body.textContent ?? "").not.toContain(
      chatI18nBundleEn["chat.transport.live"]
    );
  });

  it("still SAYS SO when the socket really never connects", async () => {
    mountTagged();
    await waitFor(() => expect(env.sockets.length).toBe(1));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => {
        env.last().serverClose(1006);
      });
      runNextTimer();
    }
    const tag = screen.getByTestId("chat-transport");
    await waitFor(() =>
      expect(tag.getAttribute("data-degraded")).toBe("never_connected")
    );
    // The named degradation is allowed to talk about refreshing — it is the
    // one place the sentence is true, and the seam can prove it.
    expect(tag.textContent).toBe(
      chatI18nBundleEn["chat.transport.degraded.never_connected"]
    );
  });

  it("no transport label the healthy path can reach mentions refreshing", () => {
    for (const key of [
      "chat.transport.live",
      "chat.transport.connecting",
      "chat.transport.catching_up",
      "chat.transport.idle",
    ]) {
      for (const bundle of [chatI18nBundleEn, chatI18nBundleRu, chatI18nBundleEs]) {
        const copy = bundle[key];
        expect(copy).toBeTruthy();
        expect(copy ?? "").not.toMatch(REFRESH_COPY);
        // The Russian sentence the owner reported this product for.
        expect(copy ?? "").not.toMatch(/обновляется раз в несколько секунд/i);
      }
    }
    // Deleted, not merely unused: an unreachable key is a sentence waiting to
    // be wired back up by the next person who needs "a polling label".
    expect(chatI18nBundleEn["chat.transport.polling"]).toBeUndefined();
    expect(chatI18nBundleRu["chat.transport.polling"]).toBeUndefined();
    expect(chatI18nBundleEs["chat.transport.polling"]).toBeUndefined();
  });
});
