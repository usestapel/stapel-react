/**
 * A REFRESH IN FLIGHT IS A QUESTION, NOT AN OUTCOME.
 *
 * The wire cutover dropped `renewing_credential` on purpose: the substrate
 * could not express "a 4401 is inside core's single-flight refresh right now",
 * and a pair that cannot know a thing must not print a sentence claiming it.
 * `@stapel/realtime` publishes `RealtimeState.refreshing` now, so the pair
 * can, and this file pins the three properties that make saying it honest:
 *
 *  1. **The window is named, and it is not an all-is-well rendering.** During
 *     a refresh the socket is gone and nothing is armed yet — the one moment
 *     when a screen most easily reads as "nothing is happening". The tag says
 *     the credential is being checked, in words, and says neither "Live" nor
 *     "Paused".
 *  2. **It is debounced.** A healthy refresh answers in well under a second,
 *     and a scary sentence about your sign-in that flashes for 80 ms is worse
 *     than silence. Below `RENEWING_CREDENTIAL_DEBOUNCE_MS` nothing about the
 *     rendering changes at all, and the test records every reason the surface
 *     ever showed to prove it.
 *  3. **It never becomes a promise.** The three landings are read exactly as
 *     they were before this signal existed, INCLUDING after the window was on
 *     screen: renewed reconnects, no verdict backs off with the session
 *     intact, refused says `sign_in_required`. Nothing latches "was
 *     refreshing" into "will succeed".
 *
 * As everywhere else in this package since the cutover: the real handshake,
 * the real `SessionManager`, and a double that stands at `globalThis.
 * WebSocket` rather than in front of the seam under test.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REFRESH_UNAVAILABLE, createSessionManager } from "@stapel/core";
import type { RefreshOutcome, SessionManager } from "@stapel/core";
import { useRealtimeState } from "@stapel/realtime/react";
import {
  RENEWING_CREDENTIAL_DEBOUNCE_MS,
  chatDegraded,
  chatI18nBundleEn,
  chatInboxStream,
  useChatFreshness,
  withRenewingCredential,
} from "../src/index.js";
import type { ChatDegradedReason } from "../src/index.js";
import { TransportTag } from "../src/default/TransportTag.js";
import {
  ChatServer,
  TestHarness,
  installBrowserWebSocket,
  mockServer,
} from "./harness.js";
import type { BrowserWebSocketEnvironment } from "./harness.js";

const VIEWER = "u-buyer";
const INBOX = chatInboxStream(VIEWER);
const SOCKET_ORIGIN = "wss://chat.test";

function text(key: string): string {
  return String(chatI18nBundleEn[key]);
}

// ── the pure overlay ─────────────────────────────────────────────────────────

describe("withRenewingCredential — what a question may and may not say", () => {
  const asking = { since: 1_000 } as const;
  const down = chatDegraded("reconnecting", 1);

  it("changes nothing while the refresh is younger than the threshold", () => {
    const still = withRenewingCredential(
      down,
      asking,
      asking.since + RENEWING_CREDENTIAL_DEBOUNCE_MS - 1
    );
    expect(still?.reason).toBe("reconnecting");
    expect(still?.messageKey).toBe(down.messageKey);
  });

  it("names the credential once the threshold passes, on the QUESTION's clock", () => {
    const named = withRenewingCredential(
      down,
      asking,
      asking.since + RENEWING_CREDENTIAL_DEBOUNCE_MS
    );
    expect(named?.reason).toBe("renewing_credential");
    // `since` is when we started ASKING, not when the socket went away: what
    // a skin can honestly put after "since".
    expect(named?.since).toBe(asking.since);
    expect(named?.attempt).toBe(down.attempt);
  });

  it("an ANSWER outranks the question, however long the refresh has run", () => {
    const answers: ChatDegradedReason[] = [
      "sign_in_required",
      "forbidden",
      "revoked",
      "origin_not_allowed",
      "unsupported",
      "no_socket",
    ];
    for (const reason of answers) {
      expect(
        withRenewingCredential(chatDegraded(reason, 2), asking, asking.since + 60_000)
          ?.reason
      ).toBe(reason);
    }
  });

  it("a stream the socket is carrying stays undegraded — a shared client's refresh is not this stream's news", () => {
    expect(withRenewingCredential(null, asking, asking.since + 60_000)).toBeNull();
  });

  it("clearing the field restores the underlying reason EXACTLY — there is no latch", () => {
    for (const reason of ["reconnecting", "reconnecting_long", "never_connected"] as const) {
      const underneath = chatDegraded(reason, 3, 500);
      // The refresh ran long enough to have been rendered, and then landed.
      expect(withRenewingCredential(underneath, asking, asking.since + 60_000)?.reason).toBe(
        "renewing_credential"
      );
      expect(withRenewingCredential(underneath, null, asking.since + 60_000)).toBe(
        underneath
      );
    }
  });
});

// ── the real runtime ─────────────────────────────────────────────────────────

let env: BrowserWebSocketEnvironment;
const timers: { fn: () => void; delay: number }[] = [];
let nowMs = 1_000_000;
let refreshCalls = 0;
let answer: ((outcome: RefreshOutcome) => void) | null = null;
/** Every reason the surface has rendered, in order — the debounce's evidence. */
const seen: string[] = [];

beforeEach(() => {
  timers.length = 0;
  seen.length = 0;
  nowMs = 1_000_000;
  refreshCalls = 0;
  answer = null;
  env = installBrowserWebSocket();
});

afterEach(() => {
  env.restore();
});

function Surface(): React.ReactElement {
  const freshness = useChatFreshness(INBOX, () => [], { fallbackRefetchInterval: 0 });
  const client = useRealtimeState();
  const reason = freshness.degraded?.reason ?? "none";
  useEffect(() => {
    seen.push(reason);
  }, [reason]);
  return (
    <div>
      <span data-testid="aggregate-state">{client.state}</span>
      <span data-testid="asking">{client.refreshing === null ? "no" : "yes"}</span>
      <span data-testid="transport">{freshness.transport}</span>
      <span data-testid="degraded">{reason}</span>
      <TransportTag transport={freshness.transport} degraded={freshness.degraded} />
    </div>
  );
}

/**
 * A session whose refresh does not answer until this test says so — which is
 * the only way to stand inside a window that a healthy deployment leaves in
 * under a second.
 */
function mount(): SessionManager {
  const manager = createSessionManager({
    doRefresh: () =>
      new Promise<RefreshOutcome>((resolve) => {
        refreshCalls += 1;
        answer = resolve;
      }),
  });
  manager.markAuthenticated();
  render(
    <TestHarness
      server={mockServer({})}
      realtime={{
        socketUrl: SOCKET_ORIGIN,
        schedule: (fn, delay) => {
          timers.push({ fn, delay });
          return () => {
            const index = timers.findIndex((entry) => entry.fn === fn);
            if (index >= 0) timers.splice(index, 1);
          };
        },
        now: () => nowMs,
        random: () => 0.5,
      }}
    >
      <Surface />
    </TestHarness>
  );
  return manager;
}

async function connected(): Promise<ChatServer> {
  await waitFor(() => expect(env.sockets.length).toBeGreaterThan(0));
  const server = new ChatServer(env.last(), { stream: INBOX.key, ephemeral: true });
  act(() => {
    server.accept();
  });
  await waitFor(() => expect(screen.getByTestId("transport").textContent).toBe("socket"));
  return server;
}

/** Let the refresh promise and whatever it schedules settle. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** The debounce timer, and only it — the substrate's own live in tens of seconds. */
function debounceTimer(): { fn: () => void; delay: number } | undefined {
  return timers.find((entry) => entry.delay === RENEWING_CREDENTIAL_DEBOUNCE_MS);
}

/** Stand past the threshold: advance the injected clock, then fire the timer. */
function crossTheThreshold(): void {
  const entry = debounceTimer();
  if (entry === undefined) throw new Error("no debounce timer was armed");
  timers.splice(timers.indexOf(entry), 1);
  nowMs += RENEWING_CREDENTIAL_DEBOUNCE_MS;
  act(() => {
    entry.fn();
  });
}

/** Put the surface inside a refresh window that has been rendered. */
async function insideTheWindow(): Promise<void> {
  mount();
  await connected();
  act(() => {
    env.last().serverClose(4401);
  });
  await settle();
  expect(refreshCalls).toBe(1);
  crossTheThreshold();
  await waitFor(() =>
    expect(screen.getByTestId("degraded").textContent).toBe("renewing_credential")
  );
}

describe("the refresh window is named, and is never an all-is-well rendering", () => {
  it("says the credential is being checked — not 'Live', not 'Paused'", async () => {
    mount();
    await connected();

    act(() => {
      env.last().serverClose(4401);
    });
    await settle();
    // The question is open: the socket is gone and the answer is on the wire.
    expect(screen.getByTestId("asking").textContent).toBe("yes");
    // Still young. Nothing new is said yet — that is the debounce.
    expect(screen.getByTestId("degraded").textContent).toBe("reconnecting");

    crossTheThreshold();
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("renewing_credential")
    );

    // THE TRAP, asserted on the rendering a person actually reads — and this
    // is the line that gives the next three their teeth: in this window there
    // is no socket and no timer, so the SEAM's own flattening of the state is
    // `idle`, whose copy is "Paused". A person reads "Paused" as "nothing is
    // happening, all is well", at the exact moment their credential is being
    // renewed. The only thing standing between that word and the screen is
    // the degradation derived from `refreshing`.
    expect(screen.getByTestId("transport").textContent).toBe("idle");
    const tag = screen.getByTestId("chat-transport");
    expect(tag.textContent).toBe(text("chat.transport.degraded.renewing_credential"));
    expect(tag.textContent).not.toBe(text("chat.transport.idle"));
    expect(tag.textContent).not.toBe(text("chat.transport.live"));
    expect(tag.getAttribute("data-degraded")).toBe("renewing_credential");
    // And the aggregate the substrate publishes agrees it is not idle, so the
    // guard holds on both sides of the boundary.
    expect(screen.getByTestId("aggregate-state").textContent).not.toBe("idle");
    // The sentence is a question. It does not tell anyone it worked.
    expect(tag.textContent).not.toBe(text("chat.transport.degraded.sign_in_required"));
  });

  it("the sentence is worded as a question in all three locales", async () => {
    const { chatI18nBundleRu } = await import("../src/i18n/ru.js");
    const { chatI18nBundleEs } = await import("../src/i18n/es.js");
    const key = "chat.transport.degraded.renewing_credential";
    for (const bundle of [chatI18nBundleEn, chatI18nBundleRu, chatI18nBundleEs]) {
      expect(bundle[key]).toBeTruthy();
      // Not the key itself, and not a sentence borrowed from an OUTCOME —
      // the whole point is that this window is distinguishable from the
      // three landings.
      expect(bundle[key]).not.toBe(key);
      expect(bundle[key]).not.toBe(bundle["chat.transport.degraded.sign_in_required"]);
      expect(bundle[key]).not.toBe(bundle["chat.transport.degraded.reconnecting"]);
    }
  });
});

describe("the debounce: a fast refresh is never announced", () => {
  it("a refresh that answers inside the threshold shows nothing new, ever", async () => {
    mount();
    await connected();

    act(() => {
      env.last().serverClose(4401);
    });
    await settle();
    // A timer is armed for the moment it would stop being young…
    expect(debounceTimer()?.delay).toBe(RENEWING_CREDENTIAL_DEBOUNCE_MS);

    // …and the refresh answers in 80 ms, as a healthy one does.
    nowMs += 80;
    act(() => {
      answer?.("authenticated");
    });
    await settle();

    // The timer left with the question it was measuring: nothing can fire
    // later and put a stale sentence on a screen whose refresh is long done.
    expect(debounceTimer()).toBeUndefined();
    // And across the whole episode the person was never shown it. This is the
    // assertion the field's `since` exists for.
    expect(seen).not.toContain("renewing_credential");
  });
});

describe("the three landings, after the window was on screen", () => {
  it("renewed — reconnects at once, and nobody is asked to sign in", async () => {
    await insideTheWindow();
    const before = env.sockets.length;

    act(() => {
      answer?.("authenticated");
    });
    await settle();

    // Exactly what this lands as today: a new socket, immediately, with no
    // backoff — the person is looking at the screen.
    expect(env.sockets.length).toBe(before + 1);
    expect(screen.getByTestId("degraded").textContent).not.toBe("renewing_credential");
    expect(screen.getByTestId("degraded").textContent).not.toBe("sign_in_required");

    const second = new ChatServer(env.last(), { stream: INBOX.key, ephemeral: true });
    act(() => {
      second.accept();
    });
    await waitFor(() =>
      expect(screen.getByTestId("transport").textContent).toBe("socket")
    );
    expect(screen.getByTestId("degraded").textContent).toBe("none");
  });

  it("no verdict — backs off, keeps the session, and drops the sentence", async () => {
    const manager = mount();
    await connected();
    act(() => {
      env.last().serverClose(4401);
    });
    await settle();
    crossTheThreshold();
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("renewing_credential")
    );

    act(() => {
      answer?.(REFRESH_UNAVAILABLE);
    });
    await settle();

    // A 502 mid-redeploy says nothing about the credential: back off, and
    // never sign anyone out. Unchanged by the window having been shown.
    expect(timers.some((entry) => entry.delay > 0)).toBe(true);
    expect(manager.getStatus()).toBe("authenticated");
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("reconnecting")
    );
    expect(screen.getByTestId("degraded").textContent).not.toBe("sign_in_required");
  });

  it("refused — says sign_in_required, and the question does not soften it", async () => {
    const manager = mount();
    await connected();
    act(() => {
      env.last().serverClose(4401);
    });
    await settle();
    crossTheThreshold();
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("renewing_credential")
    );

    act(() => {
      answer?.(null);
    });
    await settle();

    // The verdict is not debounced and is not delayed: an answer replaces the
    // question the moment it lands.
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("sign_in_required")
    );
    expect(screen.getByTestId("chat-transport").textContent).toBe(
      text("chat.transport.degraded.sign_in_required")
    );
    expect(manager.getStatus()).toBe("unauthenticated");
    // "Was refreshing" bought nothing: the socket is not retried behind the
    // refusal.
    expect(env.sockets).toHaveLength(1);
  });
});
