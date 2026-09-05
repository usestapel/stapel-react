/**
 * The 1:1 call, as data: its states, its clock, and the refusals it can meet.
 *
 * A call is not a small conference, and nothing in this file reuses the room
 * vocabulary. A room is entered with a join code — a shareable secret that
 * admits whoever holds it — and policed afterwards by a lobby; a call has two
 * named parties decided before anything connects, no third seat, and nothing
 * to share. `model/meeting.ts` is that other lifecycle and stays separate.
 *
 * ── The two numbers a client must not compute ─────────────────────────────
 *
 * `duration_seconds` and `expires_at` both arrive from the server, and both
 * are the kind of value a reader is tempted to derive locally.
 *
 * The duration is `ended_at - answered_at` **on the server**, zero for a call
 * nobody answered. Subtracting two ISO strings in a browser gives a different
 * answer the moment a clock is off by a second, and this number is the one the
 * chat thread's own call line and the presence meter already agree on.
 * Two answers to how long a call was is how a support conversation starts.
 *
 * `expires_at` is the server's ring deadline. A client that starts its own 45
 * seconds when the frame arrives is late by the delivery latency plus any
 * skew, and the visible defect is an overlay that keeps ringing for a call
 * that ended a minute ago. {@link ringRemainingMs} counts against the field.
 *
 * ── Open strings, closed rendering ────────────────────────────────────────
 *
 * `state`, `end_reason` and `media` are open strings on the wire. Every mapper
 * here answers a NEUTRAL key for a value it does not know, never `undefined`
 * and never a blank: a backend that grows a seventh state must leave an older
 * client saying something true and vague, not showing an empty box.
 */
import type { CallResponse } from "../api/types.js";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import type { VideoI18nKey } from "../i18n/keys.js";

// ── States ─────────────────────────────────────────────────────────────────

/** The callee has been told and has not answered. The only state with a
 * deadline attached. */
export const CALL_RINGING = "ringing";
/** Both parties hold a token; media is up or coming up. */
export const CALL_ACCEPTED = "accepted";
/** The callee said no. */
export const CALL_DECLINED = "declined";
/** Nobody said anything and the ring ran out. */
export const CALL_MISSED = "missed";
/** It happened and it is over. The only state with a duration. */
export const CALL_ENDED = "ended";
/** The provider refused the room or the grant, so there was never anything to
 * answer. Distinct from `ended` on purpose: a question about a call that never
 * rang is a different question from one about a call that did. */
export const CALL_FAILED = "failed";

/** The states in which a person is ON a call. Named once, because a second
 * spelling somewhere would be a second answer to whether somebody is busy. */
export const LIVE_CALL_STATES: readonly string[] = [CALL_RINGING, CALL_ACCEPTED];

/** Is this call still happening? */
export function isCallLive(call: CallResponse | null | undefined): boolean {
  return call !== null && call !== undefined && LIVE_CALL_STATES.includes(call.state);
}

/** Is this call still ringing (as the SERVER last said — see
 * {@link isRingExpired} for the clock half)? */
export function isRinging(call: CallResponse | null | undefined): boolean {
  return call?.state === CALL_RINGING;
}

/** Which side of this call is `userId` on? `undefined` for a stranger, which
 * is what a frame for somebody else's call decodes to. */
export function callRole(
  call: CallResponse,
  userId: string | undefined
): "caller" | "callee" | undefined {
  if (userId === undefined) return undefined;
  if (String(call.caller_id) === String(userId)) return "caller";
  if (String(call.callee_id) === String(userId)) return "callee";
  return undefined;
}

/** The other person's user id — the one a host resolves a name and an avatar
 * for. `undefined` when the viewer is neither party. */
export function otherPartyId(
  call: CallResponse,
  userId: string | undefined
): string | undefined {
  const role = callRole(call, userId);
  if (role === "caller") return String(call.callee_id);
  if (role === "callee") return String(call.caller_id);
  return undefined;
}

// ── The ring clock ─────────────────────────────────────────────────────────

/**
 * Milliseconds left on the ring, against the SERVER's `expires_at`.
 *
 * `0` once the deadline has passed, and `undefined` when the call is not
 * ringing or carries no deadline — three different facts a caller branches on,
 * where a single number would have to overload one of them.
 *
 * `now` is injectable so a test can drive the boundary without sleeping, and
 * so a host that has a server-clock offset can apply it in one place.
 */
export function ringRemainingMs(
  call: CallResponse | null | undefined,
  now: number = Date.now()
): number | undefined {
  if (!isRinging(call)) return undefined;
  const expires = call?.expires_at;
  if (expires === null || expires === undefined || expires.length === 0) return undefined;
  const at = Date.parse(expires);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, at - now);
}

/**
 * Has the ring run out, by this browser's clock?
 *
 * The client mirrors the server's timeout rather than waiting for
 * `call.ended`: the frame is the CONFIRMATION, not the trigger. A client that
 * waits for it shows a ring for a call that is already over every time a frame
 * is lost — and a lost frame is the ordinary case a best-effort socket is
 * allowed to have.
 *
 * A ringing call with no `expires_at` never expires here. That is deliberate:
 * inventing a deadline the server did not state would end a call early, and
 * the server's own sweeper is the backstop that ends it late.
 */
export function isRingExpired(
  call: CallResponse | null | undefined,
  now: number = Date.now()
): boolean {
  return ringRemainingMs(call, now) === 0;
}

/**
 * Seconds a call has been connected, for the in-call timer.
 *
 * Anchored on the SERVER's `answered_at` and not on the moment the client
 * decided the call was up, so both people's timers say the same thing and a
 * reconnect does not restart the clock. `undefined` before it is answered.
 */
export function connectedSeconds(
  call: CallResponse | null | undefined,
  now: number = Date.now()
): number | undefined {
  if (call === null || call === undefined) return undefined;
  if (call.state !== CALL_ACCEPTED) return undefined;
  const answered = call.answered_at;
  if (answered === null || answered === undefined || answered.length === 0) return undefined;
  const at = Date.parse(answered);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.floor((now - at) / 1000));
}

/** `M:SS`, or `H:MM:SS` past an hour — the shape a phone shows. Never a
 * localized template: a duration clock is digits and colons in every locale
 * this fleet ships, and routing it through the i18n engine would put a
 * translator in the path of a value that ticks once a second. */
export function formatCallClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

// ── Copy keys ──────────────────────────────────────────────────────────────

/** The sentence for a finished call's state. Neutral for an unknown one. */
export function callStateKey(state: string | undefined): VideoI18nKey {
  switch (state) {
    case CALL_RINGING:
      return VIDEO_I18N_KEYS.callStateRinging;
    case CALL_ACCEPTED:
      return VIDEO_I18N_KEYS.callStateAccepted;
    case CALL_DECLINED:
      return VIDEO_I18N_KEYS.callStateDeclined;
    case CALL_MISSED:
      return VIDEO_I18N_KEYS.callStateMissed;
    case CALL_ENDED:
      return VIDEO_I18N_KEYS.callStateEnded;
    case CALL_FAILED:
      return VIDEO_I18N_KEYS.callStateFailed;
    default:
      return VIDEO_I18N_KEYS.callStateUnknown;
  }
}

/** Did the caller ask for audio only? The overlay and the panel both need it,
 * and `media` is an open string, so "not the literal 'audio'" is video. */
export function isAudioOnly(call: CallResponse | null | undefined): boolean {
  return call?.media === "audio";
}

// ── Refusals ───────────────────────────────────────────────────────────────

/**
 * The uniform 404, and the one thing a client must NOT do with it.
 *
 * `error.404.video_call_not_found` covers "no such call", "you are not a party
 * to it" and — on an action — "it is gone". The server refuses to tell them
 * apart, because a call id names two people and the conversation they are
 * having, so a 403 would confirm a guessed id. Any copy built on this
 * predicate has to be true of all three; "that call has ended" is not.
 */
export function isCallNotFound(error: unknown): boolean {
  return codeOf(error) === "error.404.video_call_not_found";
}

/** One of the two parties is already on a call. The one refusal whose remedy
 * is "finish the other one", so it is worth its own sentence. */
export function isCallBusy(error: unknown): boolean {
  return codeOf(error) === "error.409.video_call_busy";
}

/** The call moved on while this screen was looking at it — the ring ran out,
 * or somebody hung up first. The remedy is a re-read, never a retry. */
export function isCallStateConflict(error: unknown): boolean {
  return codeOf(error) === "error.409.video_call_state";
}

/** The two of you are not both in that conversation. In this product that is
 * a wiring answer, not a user one: the button should not have been offered. */
export function isCallNotAllowed(error: unknown): boolean {
  return codeOf(error) === "error.403.video_call_not_allowed";
}

/** `callee_id` named nobody, or named the caller. */
export function isInvalidCallee(error: unknown): boolean {
  return codeOf(error) === "error.400.video_call_invalid_callee";
}

/**
 * The media backend could not give us a room or a grant.
 *
 * The ONE retryable refusal in this family, and the reason it is worth
 * distinguishing: every other code above is a fact about the call or the
 * caller that trying again cannot change, while this one is a service that may
 * be back in ten seconds. A screen that offers "try again" for all six teaches
 * people to press it at a wall.
 */
export function isCallProviderUnavailable(error: unknown): boolean {
  return codeOf(error) === "error.503.video_call_provider_unavailable";
}

function codeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" ? code : undefined;
}
