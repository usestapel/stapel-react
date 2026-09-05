/**
 * `<CallsProvider>` — the ring, mounted once, for the whole app.
 *
 * A call arrives while the callee is doing something else. That is the only
 * case there is: nobody sits on a chat thread waiting to be rung. A ringing UI
 * that lives inside the thread rings for the one person who was already
 * looking at it, which is the same as not ringing at all — so this provider
 * goes at the app root, beside the query client, and every page below it can
 * be interrupted.
 *
 * It is HEADLESS. It renders `children` and nothing else; `<IncomingCallOverlay>`
 * in `/default` is what draws the state it publishes. A host that wants its own
 * overlay reads {@link useIncomingCall} and draws whatever it likes.
 *
 * ── What it owns ─────────────────────────────────────────────────────────
 *
 * 1. **The subscription** to `video:user:<id>` — but only when a
 *    `<RealtimeProvider>` and a socket origin are both present. Without them
 *    the provider still works, off the REST read alone: later, not broken.
 * 2. **The repair.** `GET /calls/active` on mount and on every realtime
 *    RECONNECT. The stream is best-effort by contract, so a dropped
 *    `call.incoming` is a call that never rang and a dropped `call.ended` is a
 *    ring that never stops. Re-reading on reconnect is what makes both
 *    self-healing rather than permanent.
 * 3. **The clock.** The ring ends on the SERVER's `expires_at`, mirrored
 *    locally — the frame is the confirmation, not the trigger.
 * 4. **Cross-tab arbitration.** Every tab shows the overlay; exactly one rings
 *    aloud, and a verdict anywhere dismisses it everywhere.
 * 5. **The out-of-focus channel.** A browser notification and a vibration when
 *    the page is hidden, because a backgrounded tab has a socket and no eyes.
 *
 * ── What it deliberately does NOT own ────────────────────────────────────
 *
 * The media session. `<CallPanel>` connects to the SFU; this provider hands
 * over the token and the url and stays out of it. Two components with an
 * opinion about when a `Room` is connected is how a call gets torn down by the
 * thing that was supposed to be watching it.
 *
 * It also does not decide whether calling is OFFERED anywhere. A thread header
 * knows whether this pair of people may talk; this provider knows whether a
 * call is happening. `<StartCallButton>` in `@stapel/chat-react` is the former
 * and takes a callback — which is how the two packages cooperate without
 * chat-react depending on a media SDK to draw a button.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import { useT } from "@stapel/core";
import type { CallResponse, CallTokenResponse } from "../api/types.js";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { useVideoRuntime } from "../model/context.js";
import {
  useActiveCall,
  useCallActions,
} from "../model/callQueries.js";
import type { CallActionsBag } from "../model/callQueries.js";
import {
  callInboxSocketUrl,
  callInboxStreamKey,
  decodeCallEvent,
} from "../model/callInbox.js";
import type { CallFrameLike, CallInboxEvent } from "../model/callInbox.js";
import { callRole, isRinging, otherPartyId } from "../model/calls.js";
import { openCallTabBus } from "../model/callTabs.js";
import type { CallTabBus } from "../model/callTabs.js";

/** The media credential for the call this browser is IN. Held in memory only,
 * and never written anywhere: it is a bearer credential for a room, and a
 * `localStorage` copy of it outlives the call it was minted for. */
export interface CallGrant {
  readonly token: string;
  readonly url: string;
}

/** What the whole app can see about the call in progress. */
export interface CallsState {
  /** The live call, or `undefined`. */
  readonly call: CallResponse | undefined;
  /** Which side this viewer is on. */
  readonly role: "caller" | "callee" | undefined;
  /** The other person's user id — what a host resolves a name for. */
  readonly peerId: string | undefined;
  /** Ringing, and this viewer is the one being rung. */
  readonly incoming: boolean;
  /** Ringing, and this viewer placed it — the "calling" state. */
  readonly outgoing: boolean;
  /** Answered: the media session should be up. */
  readonly connected: boolean;
  /** The grant for the connected call, once this browser holds one. */
  readonly grant: CallGrant | undefined;
  /** Should THIS tab make a sound? False in every tab but one. */
  readonly ringsAloud: boolean;
  /** Milliseconds left on the ring, against the server's deadline. */
  readonly ringRemainingMs: number | undefined;
  /** The first read is still in flight. */
  readonly loading: boolean;
  readonly error: unknown;
}

export interface CallsApi extends CallsState {
  /** Ring somebody in a conversation. Resolves with the grant. */
  readonly place: (args: {
    calleeId: string;
    threadKey?: string;
    media?: "audio" | "video";
  }) => Promise<CallTokenResponse>;
  readonly accept: () => Promise<void>;
  readonly decline: () => Promise<void>;
  readonly hangup: () => Promise<void>;
  /** Re-mint the media grant — what a manual Reconnect uses. */
  readonly remint: () => Promise<CallGrant | undefined>;
  /** Re-read `/calls/active`. Wired to reconnect already; exposed so a host
   * can pin it to its own "came back online" signal too. */
  readonly refresh: () => void;
  readonly gate: CallActionsBag["gate"];
}

const CallsContext = createContext<CallsApi | null>(null);

/**
 * The call in progress, from anywhere below `<CallsProvider>`.
 *
 * Throws when no provider is mounted, rather than answering an idle state: a
 * button that silently does nothing because somebody forgot the provider is
 * the failure this whole wave exists to prevent, and it would look exactly
 * like "nobody is calling".
 */
export function useCalls(): CallsApi {
  const value = useContext(CallsContext);
  if (value === null) {
    throw new Error(
      "useCalls() requires <CallsProvider> above it. Mount it once at the app " +
        "root — a call arrives while the person is on some other page, so a " +
        "provider mounted per-screen rings only for whoever was already looking."
    );
  }
  return value;
}

/**
 * The ringing half, for an overlay.
 *
 * A separate hook from {@link useCalls} because it is what a host's own
 * overlay needs and nothing more — a component that only draws a ring should
 * not be able to hang up a call by autocomplete.
 */
export function useIncomingCall(): {
  readonly call: CallResponse | undefined;
  readonly peerId: string | undefined;
  readonly incoming: boolean;
  readonly outgoing: boolean;
  readonly ringsAloud: boolean;
  readonly remainingMs: number | undefined;
  readonly accept: () => Promise<void>;
  readonly decline: () => Promise<void>;
  readonly cancel: () => Promise<void>;
} {
  const calls = useCalls();
  return {
    call: calls.call,
    peerId: calls.peerId,
    incoming: calls.incoming,
    outgoing: calls.outgoing,
    ringsAloud: calls.ringsAloud,
    remainingMs: calls.ringRemainingMs,
    accept: calls.accept,
    decline: calls.decline,
    // The caller's "cancel" IS a hangup — a call the callee never answered
    // ends rather than being missed, because somebody was there and stopped
    // waiting. One verb, two words for it depending on which end you are on.
    cancel: calls.hangup,
  };
}

export interface CallsProviderProps {
  readonly children: ReactNode;
  /** This viewer's user id. Required: every decision here — am I the caller or
   * the callee, which inbox is mine — is about identity, and a provider that
   * guessed would ring the wrong person. */
  readonly userId: string | undefined;
  /** The WebSocket origin, e.g. `wss://api.example.com`. Falls back to the
   * runtime's. Absent, the provider runs REST-only and says so through
   * `live: false` — it never falls back to a hidden poll. */
  readonly wsOrigin?: string;
  /** Turn the whole thing off — for a page or a build where calling is not
   * offered. The provider still renders children. */
  readonly enabled?: boolean;
  /** Ask the browser for notification permission and show one while the page
   * is hidden. Default on; a host that has its own notification policy turns
   * it off rather than fighting it. */
  readonly notifyWhenHidden?: boolean;
  /**
   * How this provider is fed live frames — the TRANSPORT SEAM, not a test
   * hook.
   *
   * The headless entry imports no socket package: `@stapel/realtime` is the
   * fleet's one reconnect/close-code runtime and it lives in the `/default`
   * skin, exactly as the lobby's does. So `<LiveCallsProvider>` (from
   * `@stapel/video-react/default`) is this provider with the realtime
   * subscription supplied, and a host on its own transport passes its own
   * implementation here.
   *
   * Absent, the provider is REST-only: it still holds the call, still ends the
   * ring on the server's deadline, and still repairs on every refresh — it
   * just learns about a new one on the next read rather than immediately. That
   * is a stated degradation, never a hidden poll.
   *
   * `onReconnected` is the one the whole design leans on: a socket that came
   * back missed whatever happened while it was away, and re-reading
   * `/calls/active` is the only thing that turns that from a permanent wrong
   * state into a two-second one.
   */
  readonly subscribe?: (args: {
    streamKey: string;
    url: string | undefined;
    onFrame: (frame: CallFrameLike) => void;
    onReconnected: () => void;
  }) => () => void;
  /** Cross-tab bus factory. Swapped in tests; a host has no reason to. */
  readonly openBus?: typeof openCallTabBus;
}

export function CallsProvider(props: CallsProviderProps): ReactElement {
  const {
    children,
    userId,
    enabled = true,
    notifyWhenHidden = true,
    subscribe,
    openBus = openCallTabBus,
  } = props;
  const runtime = useVideoRuntime();
  const wsOrigin = props.wsOrigin ?? runtime.wsOrigin;

  const active = useActiveCall({ enabled: enabled && userId !== undefined });
  const actions = useCallActions();
  const [grant, setGrant] = useState<CallGrant | undefined>(undefined);
  const [ringOwner, setRingOwner] = useState<string | undefined>(undefined);
  const [remaining, setRemaining] = useState<number | undefined>(undefined);

  const call = active.call;
  const callId = call?.id;
  const role = call !== undefined ? callRole(call, userId) : undefined;
  const ringing = isRinging(call);

  // ── the repair read, on mount and on reconnect ──────────────────────────
  const refresh = active.refetch;

  // ── the cross-tab bus ───────────────────────────────────────────────────
  const busRef = useRef<CallTabBus | null>(null);
  const [dismissed, setDismissed] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return undefined;
    const bus = openBus((message) => {
      if (message.kind === "claim") {
        // Somebody else got there first. Show the overlay; make no sound.
        setRingOwner((current) => current ?? message.from);
      } else {
        // Dealt with in another tab. Close here without a round trip, and
        // re-read so this tab's cache agrees with the server rather than with
        // a sibling's word.
        setDismissed(message.callId);
        refresh();
      }
    });
    busRef.current = bus;
    return () => {
      busRef.current = null;
      bus.close();
    };
  }, [enabled, openBus, refresh]);

  // Claim the sound for a ring this tab has not seen before. The FIRST tab to
  // claim wins; there is no election, because the answer only has to be "one
  // of them" and every mechanism that would make it "the right one" costs more
  // than it buys and gets a tab wrong on session restore.
  const claimedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!ringing || callId === undefined || role !== "callee") return;
    if (claimedFor.current === callId) return;
    claimedFor.current = callId;
    const bus = busRef.current;
    if (bus === null) {
      setRingOwner(undefined);
      return;
    }
    setRingOwner((current) => current ?? bus.id);
    bus.post({ kind: "claim", callId, from: bus.id });
  }, [ringing, callId, role]);

  // A ring that is over releases the claim, or the next call in this tab is
  // silent forever.
  useEffect(() => {
    if (ringing) return;
    claimedFor.current = undefined;
    setRingOwner(undefined);
  }, [ringing]);

  const announceResolved = useCallback((id: string): void => {
    busRef.current?.post({
      kind: "resolved",
      callId: id,
      from: busRef.current.id,
    });
  }, []);

  // ── the realtime subscription ───────────────────────────────────────────
  const onEvent = useCallback(
    (event: CallInboxEvent): void => {
      // Every arm ends in a re-read rather than in a locally-built row. An
      // `incoming` frame carries five fields and the row carries thirteen;
      // synthesising the rest would put a fabricated `state` on screen, and
      // the re-read is the same call that repairs a frame we never got.
      switch (event.kind) {
        case "incoming":
        case "accepted":
          refresh();
          return;
        case "declined":
        case "ended":
          setGrant(undefined);
          refresh();
          return;
        default:
          return;
      }
    },
    [refresh]
  );

  const streamKey = userId !== undefined ? callInboxStreamKey(userId) : undefined;
  const url =
    wsOrigin !== undefined && wsOrigin.length > 0
      ? callInboxSocketUrl(wsOrigin)
      : undefined;

  useEffect(() => {
    if (!enabled || subscribe === undefined || streamKey === undefined) {
      return undefined;
    }
    return subscribe({
      streamKey,
      url,
      onFrame: (frame) => {
        const event = decodeCallEvent(frame);
        if (event !== undefined) onEvent(event);
      },
      onReconnected: refresh,
    });
  }, [enabled, subscribe, streamKey, url, onEvent, refresh]);

  // ── the ring clock ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ringing || call === undefined) {
      setRemaining(undefined);
      return undefined;
    }
    const compute = (): void => {
      const expires = call.expires_at;
      if (expires === null || expires === undefined) {
        setRemaining(undefined);
        return;
      }
      const at = Date.parse(expires);
      setRemaining(Number.isNaN(at) ? undefined : Math.max(0, at - Date.now()));
    };
    compute();
    const timer = setInterval(compute, 250);
    return () => {
      clearInterval(timer);
    };
  }, [ringing, call]);

  // ── the out-of-focus channel ────────────────────────────────────────────
  const incoming =
    ringing && role === "callee" && callId !== undefined && dismissed !== callId;
  const t = useT();
  useNotifyWhenHidden(
    incoming && notifyWhenHidden,
    callId,
    t(VIDEO_I18N_KEYS.callIncomingTitle)
  );

  // A call that ends clears the grant. Held here rather than in the panel so
  // a token never survives the call it was minted for.
  useEffect(() => {
    if (call === undefined) setGrant(undefined);
  }, [call]);

  const value = useMemo<CallsApi>(() => {
    const outgoing = ringing && role === "caller";
    const connected = call?.state === "accepted";
    const owned = busRef.current?.id;
    return {
      call: dismissed !== undefined && dismissed === callId ? undefined : call,
      role,
      peerId: call !== undefined ? otherPartyId(call, userId) : undefined,
      incoming,
      outgoing,
      connected,
      grant,
      ringsAloud: incoming && (ringOwner === undefined || ringOwner === owned),
      ringRemainingMs: remaining,
      loading: active.loading,
      error: active.error ?? actions.error,
      gate: actions.gate,
      place: async (args) => {
        const answer = await actions.place({
          callee_id: args.calleeId,
          ...(args.threadKey !== undefined ? { thread_key: args.threadKey } : {}),
          ...(args.media !== undefined ? { media: args.media } : {}),
        });
        setGrant({ token: answer.token, url: answer.url });
        return answer;
      },
      accept: async () => {
        if (callId === undefined) return;
        const answer = await actions.accept(callId);
        setGrant({ token: answer.token, url: answer.url });
        announceResolved(callId);
      },
      decline: async () => {
        if (callId === undefined) return;
        await actions.decline(callId);
        setGrant(undefined);
        announceResolved(callId);
      },
      hangup: async () => {
        if (callId === undefined) return;
        await actions.hangup(callId);
        setGrant(undefined);
        announceResolved(callId);
      },
      remint: async () => {
        if (callId === undefined) return undefined;
        const next = await actions.remint(callId);
        setGrant(next);
        return next;
      },
      refresh,
    };
  }, [
    call,
    callId,
    dismissed,
    role,
    userId,
    incoming,
    ringing,
    grant,
    ringOwner,
    remaining,
    active.loading,
    active.error,
    actions,
    announceResolved,
    refresh,
  ]);

  return <CallsContext.Provider value={value}>{children}</CallsContext.Provider>;
}

/**
 * A browser notification and a buzz while the page is HIDDEN.
 *
 * The in-browser twin of the server's push: a tab that is open but not looked
 * at has a socket and no eyes, and it is the case a person is in when they
 * switch away to check a listing.
 *
 * Permission is asked ONLY from inside the ring — which is a user-adjacent
 * moment and the closest thing to a gesture this path has — and never on load.
 * A `default` permission simply produces no notification: a prompt on page
 * load is the pattern every browser now buries, and asking there would spend
 * the one prompt a site gets on a moment the person has no context for.
 */
function useNotifyWhenHidden(
  active: boolean,
  callId: string | undefined,
  title: string
): void {
  const shownFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!active || callId === undefined) return undefined;
    if (shownFor.current === callId) return undefined;
    shownFor.current = callId;

    const doc = (globalThis as { document?: Document }).document;
    if (doc?.visibilityState !== "hidden") return undefined;

    const nav = (globalThis as { navigator?: Navigator }).navigator;
    try {
      // A short double-buzz: long enough to feel, short enough not to be a
      // toy. Silently absent on desktop and on iOS, which is why it is not
      // guarded by a capability check that would only restate the try.
      nav?.vibrate?.([200, 100, 200]);
    } catch {
      /* a policy-blocked vibrate is not worth a broken ring */
    }

    const N = (globalThis as { Notification?: typeof Notification }).Notification;
    if (typeof N !== "function") return undefined;
    let live: Notification | undefined;
    const show = (): void => {
      try {
        // The title is resolved through the i18n engine by the caller — this
        // package renders no literal string, and a notification is a string a
        // person reads on a lock screen in their own language.
        live = new N(title, { tag: `stapel-call-${callId}`, silent: false });
      } catch {
        /* some engines throw for a non-persistent notification */
      }
    };
    if (N.permission === "granted") show();
    else if (N.permission === "default") void N.requestPermission().then((p) => {
      if (p === "granted") show();
    });
    return () => {
      live?.close();
    };
  }, [active, callId, title]);
}
