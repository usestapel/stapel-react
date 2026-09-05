/**
 * Which tab rings, and how a verdict in one reaches the others.
 *
 * Five tabs ringing at once is how a feature gets muted permanently, and it is
 * the ordinary case for this product: a marketplace visitor opens listings in
 * new tabs. Every tab shows the overlay — the call is real in all of them —
 * but exactly ONE plays the sound, and accepting or declining anywhere
 * dismisses it everywhere.
 *
 * ── Two transports, one contract ──────────────────────────────────────────
 *
 * `BroadcastChannel` where it exists; a `storage`-event ping otherwise (Safari
 * before 15.4, and any embedding that blocks it). Both are best-effort and
 * both are same-origin only, which is exactly the scope of the problem.
 *
 * A browser that has NEITHER is a browser where every tab rings. That is the
 * honest degradation and it is stated rather than guarded against: the
 * alternative is a lock in `localStorage` with a lease and a clock, which is a
 * distributed-systems problem to solve a noise problem, and its failure mode
 * is a phone that does not ring at all.
 *
 * ── The audio claim is a RACE, deliberately ───────────────────────────────
 *
 * The first tab to claim a ring wins it. There is no election, no ordering and
 * no tie-break, because the answer only has to be "one of them" — and every
 * mechanism that would make it "the right one" (focus, recency, a stored
 * ordinal) costs more than it buys and gets a tab wrong when the browser
 * restores a session. A tab that loses the claim still shows the overlay; only
 * the sound is exclusive.
 */

/** What travels between tabs. Ids only: no payload, no credential, and
 * nothing a listener could not read from its own `GET /calls/active`. */
export interface CallTabMessage {
  /** `claim` — I am ringing this one aloud. `resolved` — it is dealt with,
   * stop showing it. */
  readonly kind: "claim" | "resolved";
  readonly callId: string;
  /** The sender's own tab id, so a tab ignores its own echo. */
  readonly from: string;
}

/** The channel/storage name. One per origin, shared by every tab. */
export const CALL_TAB_CHANNEL = "stapel-video-calls";

/** The `localStorage` key the fallback writes to. A key, not a store: the
 * value is a timestamped message and nothing ever reads it back as state. */
export const CALL_TAB_STORAGE_KEY = "stapel-video-calls:signal";

export interface CallTabBus {
  /** Tell the other tabs. Never throws — a blocked storage or a closed
   * channel is a tab that rings on its own, not a broken screen. */
  post(message: CallTabMessage): void;
  /** Stop listening. */
  close(): void;
  /** This tab's id, for `message.from`. */
  readonly id: string;
}

/** Non-cryptographic and per-tab; it only has to differ from the other tabs
 * of the same browser. `crypto.randomUUID` where it exists, because it does
 * almost everywhere and the fallback is only for old embeddings. */
function newTabId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  return `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/**
 * Open the cross-tab bus.
 *
 * `onMessage` never receives this tab's own posts — the `from` check is here
 * so no caller has to remember it, and forgetting it is a tab that mutes
 * itself.
 *
 * In an environment with neither transport (SSR, a test with no DOM) this
 * returns a bus that posts nowhere and listens to nothing. That is a working
 * single-tab app, which is the correct behaviour for a page with no siblings.
 */
export function openCallTabBus(
  onMessage: (message: CallTabMessage) => void
): CallTabBus {
  const id = newTabId();
  const deliver = (message: unknown): void => {
    if (!isMessage(message) || message.from === id) return;
    onMessage(message);
  };

  const BC = (globalThis as { BroadcastChannel?: typeof BroadcastChannel })
    .BroadcastChannel;
  if (typeof BC === "function") {
    const channel = new BC(CALL_TAB_CHANNEL);
    const listener = (event: MessageEvent): void => {
      deliver(event.data);
    };
    channel.addEventListener("message", listener);
    return {
      id,
      post: (message) => {
        try {
          channel.postMessage(message);
        } catch {
          /* a closed channel is a tab that rings alone */
        }
      },
      close: () => {
        channel.removeEventListener("message", listener);
        try {
          channel.close();
        } catch {
          /* already gone */
        }
      },
    };
  }

  const w = globalThis as unknown as Window & typeof globalThis;
  if (typeof w.addEventListener === "function" && hasStorage(w)) {
    const listener = (event: StorageEvent): void => {
      if (event.key !== CALL_TAB_STORAGE_KEY || event.newValue === null) return;
      try {
        deliver(JSON.parse(event.newValue));
      } catch {
        /* somebody else's key collision, or a truncated write */
      }
    };
    w.addEventListener("storage", listener);
    return {
      id,
      post: (message) => {
        try {
          // The timestamp is what makes two identical messages two `storage`
          // events: the event fires on a CHANGE, and re-claiming the same call
          // after a reload would otherwise be silent.
          w.localStorage.setItem(
            CALL_TAB_STORAGE_KEY,
            JSON.stringify({ ...message, at: Date.now() })
          );
        } catch {
          /* private mode, a quota, a blocked third-party context */
        }
      },
      close: () => {
        w.removeEventListener("storage", listener);
      },
    };
  }

  return { id, post: () => undefined, close: () => undefined };
}

function hasStorage(w: Window & typeof globalThis): boolean {
  try {
    return typeof w.localStorage?.setItem === "function";
  } catch {
    // Reading `localStorage` THROWS in a blocked third-party context — the
    // access itself, not the write — so this has to be a try and not a check.
    return false;
  }
}

function isMessage(value: unknown): value is CallTabMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    (m["kind"] === "claim" || m["kind"] === "resolved") &&
    typeof m["callId"] === "string" &&
    typeof m["from"] === "string"
  );
}
