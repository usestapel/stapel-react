import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  matchMandate,
  useMandate,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/**
 * "Call" — the same door as "Message the seller", one step further in.
 *
 * ── Why this lives in chat-react and places no call ──────────────────────
 *
 * Calling is `@stapel/video-react`'s: it owns the state machine, the media
 * session and a `livekit-client` peer. A thread header importing that to draw
 * a button would put a WebRTC stack in the bundle of every host that shows a
 * conversation and never calls anybody.
 *
 * What chat DOES own is the answer to "may these two people talk, about this
 * thing, right now" — the same question `<StartDirectChat>` answers, from the
 * same axes. So this component holds the GATE and calls back; the host wires
 * the callback to `useCalls().place(…)`. Two packages, one button, neither
 * depending on the other.
 *
 * ── The gate, and the one arm that is not obvious ───────────────────────
 *
 * The server refuses a call whose two parties are not both in the thread
 * (`CALL_AUTHORIZER`), and refuses a second call while either is on one
 * (409 `video_call_busy`). Both refusals are correct and both are useless
 * arriving after the press: the person has already been interrupted by a
 * spinner and a red box. So `busy` is a prop, fed from the video pair's own
 * `useCalls().call !== undefined`, and the control says "you are already on a
 * call" BEFORE it is pressed.
 *
 * A thread with no counterpart id blocks for the same reason
 * `<StartDirectChat>` does: there is nobody to ring, and a button that cannot
 * do anything is worse than an absent one.
 *
 * ── What it does NOT gate on ─────────────────────────────────────────────
 *
 * Whether the OTHER person is reachable. Nothing in the fleet answers that
 * from a browser, and a control that greyed out for "they look offline" would
 * be wrong every time somebody's phone is in a pocket with a push waiting —
 * which is precisely the case a call feature exists for. Ringing out is an
 * answer; a button that refuses to ring is not.
 */
export interface StartCallBag {
  /** Blocked reasons: no counterpart, calling yourself, a visitor with no
   * identity, or a call already in progress. */
  readonly availability: ActionAvailability;
  /** A call is being placed right now — including the thread being created
   * first, when the press is what creates it (see `ensureConversation`). */
  readonly isStarting: boolean;
  /**
   * What `ensureConversation` threw, if it did.
   *
   * A press that has to make the thread first can fail before there is any
   * call to fail, and the gate's own vocabulary cannot say that: a blocked
   * REASON is a fact about the button that was true before it was pressed.
   * `undefined` until something goes wrong, and cleared by the next press.
   */
  readonly error?: unknown;
  /** Ring them. A no-op while blocked, so a host that renders its own control
   * cannot bypass the gate by wiring the callback directly. */
  call(): void;
}

export function StartCall(props: {
  /** The other person. `null`/`undefined` blocks with a reason. */
  peerId: string | null | undefined;
  /** The viewer, when known — calling yourself is blocked with a reason. */
  viewerId?: string | null;
  /** The conversation the call hangs off. The server's default authorizer
   * REQUIRES it: a user id is not a phone number, and membership of a thread
   * is what makes it one. Absent, the control is blocked rather than
   * pressed into a 403 — unless the host can MAKE one, see
   * `ensureConversation`. */
  conversationId: string | null | undefined;
  /**
   * MAKE THE THREAD THE PRESS NEEDS.
   *
   * A call needs a conversation because that is what the server's authorizer
   * reads, and on a listing page there is usually no thread yet: nobody has
   * written to this seller. With only `conversationId` to go on, the control
   * had exactly one honest answer there — blocked, "there is no conversation
   * to call in" — which is a true sentence about a screen where "Call" is
   * precisely what the person wants, and it left hosts either hiding the
   * button or pre-creating an empty thread for every listing anyone looked at.
   *
   * Supplied, an absent `conversationId` stops blocking: the thread is a step
   * of the press rather than a precondition of it. The seam is the host's
   * because CREATING one is (`<StartDirectChat>`'s `POST /conversations/` is
   * the same call, with the same subject and participants only the host
   * knows). Everything else about the gate is unchanged — a visitor, a
   * missing counterpart, calling yourself and being mid-call all still block
   * BEFORE the press, which is the whole point of the component.
   *
   * Resolving to nothing is a refusal, not a call with no thread: the press
   * simply ends, and `bag.error` carries anything thrown.
   */
  ensureConversation?: () => Promise<string | null | undefined>;
  /** Is this person already on a call? Fed from the video pair. */
  busy?: boolean;
  /** A call is in flight. */
  pending?: boolean;
  /** Place the call — the host wires this to `useCalls().place(…)`. */
  onCall: (args: { peerId: string; conversationId: string }) => void;
  children: (bag: StartCallBag) => ReactNode;
}): ReactNode {
  const { peerId, viewerId, conversationId, busy, pending, onCall } = props;
  const ensureConversation = props.ensureConversation;
  // The press that has to make a thread first is in flight from the click
  // until the call is handed over — one state, so the button reads "starting"
  // for the whole of it rather than looking idle while a POST is out.
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * The same mandate read `<StartDirectChat>` makes, with ONE arm different.
   *
   * `anonymous` has no elevation path here, deliberately. Elevating a visitor
   * into an account so they can send a message is a trade they understand —
   * they typed something and want it delivered. Elevating them so a stranger's
   * phone can ring is a different bargain, and it is not one this component
   * should make on a host's behalf. A visitor is told to sign in.
   *
   * `unavailable` stays AVAILABLE, exactly as it does for messaging: outside a
   * `<MandateProvider>` core answers "we could not ask", and "we could not
   * ask" is not "you may not". If the guess is wrong the server refuses,
   * which is where it refused before this component existed.
   */
  const mandate = useMandate();
  const mandateGate = matchMandate<ActionAvailability>(mandate, {
    member: () => actionAvailable(),
    guest: () => actionBlocked(CHAT_I18N_KEYS.callBlockedSignIn),
    anonymous: () => actionBlocked(CHAT_I18N_KEYS.callBlockedSignIn),
    asking: () => actionBlocked(CHAT_I18N_KEYS.callBlockedMandateUnknown),
    unavailable: () => actionAvailable(),
  });

  const availability: ActionAvailability = firstBlock(
    mandateGate,
    peerId === null || peerId === undefined || peerId.length === 0
      ? actionBlocked(CHAT_I18N_KEYS.callBlockedUnknownPeer)
      : actionAvailable(),
    viewerId != null && viewerId === peerId
      ? actionBlocked(CHAT_I18N_KEYS.callBlockedSelf)
      : actionAvailable(),
    // No thread blocks only when nothing can make one. With
    // `ensureConversation` in hand the thread is a step of the press, so the
    // control is pressable and the OTHER gates still decide.
    (conversationId === null ||
      conversationId === undefined ||
      conversationId.length === 0) &&
    ensureConversation === undefined
      ? actionBlocked(CHAT_I18N_KEYS.callBlockedNoThread)
      : actionAvailable(),
    creating ? actionBlocked(CHAT_I18N_KEYS.callBlockedPending) : actionAvailable(),
    busy === true ? actionBlocked(CHAT_I18N_KEYS.callBlockedBusy) : actionAvailable(),
    pending === true
      ? actionBlocked(CHAT_I18N_KEYS.callBlockedPending)
      : actionAvailable()
  );

  const doCall = useCallback((): void => {
    if (!availability.available) return;
    if (peerId === null || peerId === undefined) return;
    if (conversationId !== null && conversationId !== undefined && conversationId.length > 0) {
      onCall({ peerId, conversationId });
      return;
    }
    if (ensureConversation === undefined) return;
    setError(undefined);
    setCreating(true);
    void (async (): Promise<void> => {
      try {
        const made = await ensureConversation();
        if (!alive.current) return;
        // Nothing made is a refusal, not a call placed without a thread: the
        // server would answer that with the 403 this gate exists to avoid.
        if (made !== null && made !== undefined && made.length > 0) {
          onCall({ peerId, conversationId: made });
        }
      } catch (thrown) {
        if (alive.current) setError(thrown);
      } finally {
        if (alive.current) setCreating(false);
      }
    })();
  }, [availability.available, peerId, conversationId, ensureConversation, onCall]);

  return props.children({
    availability,
    isStarting: pending === true || creating,
    ...(error !== undefined ? { error } : {}),
    call: doCall,
  });
}
