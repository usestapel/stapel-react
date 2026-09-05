import { describe, expect, it } from "vitest";
import {
  CALL_FRAME_ACCEPTED,
  CALL_FRAME_DECLINED,
  CALL_FRAME_ENDED,
  CALL_FRAME_INCOMING,
  CALL_FRAME_TYPES,
  CALL_INBOX_SOCKET_PATH,
  applyCallEvent,
  callInboxSocketUrl,
  callInboxStreamKey,
  decodeCallEvent,
} from "../src/model/callInbox.js";
import {
  callRole,
  connectedSeconds,
  formatCallClock,
  isAudioOnly,
  isCallBusy,
  isCallLive,
  isCallNotAllowed,
  isCallNotFound,
  isCallProviderUnavailable,
  isCallStateConflict,
  isInvalidCallee,
  isRingExpired,
  isRinging,
  otherPartyId,
  ringRemainingMs,
} from "../src/model/calls.js";
import type { CallResponse } from "../src/api/types.js";

const ALICE = "u-alice";
const BOB = "u-bob";
const CAROL = "u-carol";

function ringing(overrides: Partial<CallResponse> = {}): CallResponse {
  return {
    id: "call-1",
    thread_key: "conv-1",
    caller_id: ALICE,
    callee_id: BOB,
    room_name: "call-call-1",
    media: "video",
    state: "ringing",
    end_reason: "",
    started_at: "2026-09-06T10:00:00+00:00",
    expires_at: "2026-09-06T10:00:45+00:00",
    ...overrides,
  } as CallResponse;
}

const AT_START = Date.parse("2026-09-06T10:00:00Z");

// ── the ring clock ──────────────────────────────────────────────────────────

describe("the ring counts against the SERVER's deadline", () => {
  it("reports what the server said is left, not 45 seconds from now", () => {
    // A frame that arrived 10s late leaves 35s, not a fresh 45. Getting this
    // wrong shows as an overlay that outlives the call it announces.
    expect(ringRemainingMs(ringing(), AT_START + 10_000)).toBe(35_000);
  });

  it("floors at zero rather than going negative", () => {
    expect(ringRemainingMs(ringing(), AT_START + 60_000)).toBe(0);
    expect(isRingExpired(ringing(), AT_START + 60_000)).toBe(true);
  });

  it("is undefined — not zero — for a call that is not ringing", () => {
    // Three different facts: "no deadline", "not ringing" and "ran out". A
    // single number would have to overload one of them.
    expect(ringRemainingMs(ringing({ state: "accepted" }), AT_START)).toBeUndefined();
    expect(isRingExpired(ringing({ state: "accepted" }), AT_START)).toBe(false);
  });

  it("never expires a ring the server gave no deadline for", () => {
    // Inventing a deadline would end a call early. The server's own sweeper is
    // the backstop that ends it late, which is the safe direction.
    const noDeadline = ringing({ expires_at: null });
    expect(ringRemainingMs(noDeadline, AT_START + 600_000)).toBeUndefined();
    expect(isRingExpired(noDeadline, AT_START + 600_000)).toBe(false);
  });

  it("ignores a deadline it cannot parse", () => {
    expect(ringRemainingMs(ringing({ expires_at: "soon" }), AT_START)).toBeUndefined();
  });
});

describe("the in-call timer is anchored on the server's answered_at", () => {
  it("counts from when the SERVER says it was answered", () => {
    const call = ringing({
      state: "accepted",
      answered_at: "2026-09-06T10:00:05+00:00",
    });
    expect(connectedSeconds(call, AT_START + 125_000)).toBe(120);
  });

  it("has no answer before the call is accepted", () => {
    expect(connectedSeconds(ringing(), AT_START + 10_000)).toBeUndefined();
  });

  it("formats a clock the way a phone does", () => {
    expect(formatCallClock(0)).toBe("0:00");
    expect(formatCallClock(9)).toBe("0:09");
    expect(formatCallClock(192)).toBe("3:12");
    expect(formatCallClock(3661)).toBe("1:01:01");
  });
});

// ── roles ───────────────────────────────────────────────────────────────────

describe("who is on which side", () => {
  it("names the caller, the callee and neither", () => {
    const call = ringing();
    expect(callRole(call, ALICE)).toBe("caller");
    expect(callRole(call, BOB)).toBe("callee");
    expect(callRole(call, CAROL)).toBeUndefined();
    expect(callRole(call, undefined)).toBeUndefined();
  });

  it("hands back the OTHER person's id, and nothing for a stranger", () => {
    const call = ringing();
    expect(otherPartyId(call, ALICE)).toBe(BOB);
    expect(otherPartyId(call, BOB)).toBe(ALICE);
    expect(otherPartyId(call, CAROL)).toBeUndefined();
  });

  it("reads live states and the audio-only flag", () => {
    expect(isCallLive(ringing())).toBe(true);
    expect(isCallLive(ringing({ state: "accepted" }))).toBe(true);
    expect(isCallLive(ringing({ state: "ended" }))).toBe(false);
    expect(isCallLive(undefined)).toBe(false);
    expect(isRinging(ringing({ state: "accepted" }))).toBe(false);
    expect(isAudioOnly(ringing({ media: "audio" }))).toBe(true);
    expect(isAudioOnly(ringing())).toBe(false);
  });
});

// ── refusals ────────────────────────────────────────────────────────────────

describe("the six refusals are told apart", () => {
  const err = (code: string): unknown => ({ code });

  it("matches each code to its own predicate", () => {
    expect(isCallNotFound(err("error.404.video_call_not_found"))).toBe(true);
    expect(isInvalidCallee(err("error.400.video_call_invalid_callee"))).toBe(true);
    expect(isCallNotAllowed(err("error.403.video_call_not_allowed"))).toBe(true);
    expect(isCallBusy(err("error.409.video_call_busy"))).toBe(true);
    expect(isCallStateConflict(err("error.409.video_call_state"))).toBe(true);
    expect(
      isCallProviderUnavailable(err("error.503.video_call_provider_unavailable"))
    ).toBe(true);
  });

  it("keeps the ONE retryable one distinct from the five that are not", () => {
    // A screen that offers "try again" for all six teaches people to press it
    // at a wall: only the provider outage can change its mind.
    const busy = err("error.409.video_call_busy");
    expect(isCallProviderUnavailable(busy)).toBe(false);
    expect(isCallBusy(busy)).toBe(true);
  });

  it("says no to anything that is not an error envelope", () => {
    expect(isCallNotFound(undefined)).toBe(false);
    expect(isCallNotFound(new Error("boom"))).toBe(false);
    expect(isCallNotFound({ code: 404 })).toBe(false);
  });
});

// ── the ring stream ─────────────────────────────────────────────────────────

describe("the call inbox stream", () => {
  it("is addressed to one person", () => {
    expect(callInboxStreamKey(BOB)).toBe(`video:user:${BOB}`);
  });

  it("has NO id in its socket path", () => {
    // The authorization, not a formatting choice: the server builds the key
    // from the authenticated scope, so the consumer physically cannot name
    // somebody else's inbox. A path parameter would make that a comparison a
    // future edit can drop.
    expect(CALL_INBOX_SOCKET_PATH).toBe("/ws/video/inbox");
    expect(CALL_INBOX_SOCKET_PATH).not.toMatch(/[<:{]/u);
    expect(callInboxSocketUrl("wss://api.test/")).toBe(
      "wss://api.test/ws/video/inbox"
    );
  });

  it("carries the four frame types the backend relays", () => {
    expect([...CALL_FRAME_TYPES].sort()).toEqual(
      ["call.accepted", "call.declined", "call.ended", "call.incoming"].sort()
    );
  });
});

describe("decoding a frame", () => {
  it("reads an incoming ring, including the server's deadline", () => {
    const event = decodeCallEvent({
      type: CALL_FRAME_INCOMING,
      payload: {
        call_id: "call-1",
        caller_id: ALICE,
        thread_key: "conv-1",
        media: "audio",
        started_at: "2026-09-06T10:00:00+00:00",
        expires_at: "2026-09-06T10:00:45+00:00",
      },
    });
    expect(event).toEqual({
      kind: "incoming",
      callId: "call-1",
      callerId: ALICE,
      threadKey: "conv-1",
      media: "audio",
      startedAt: "2026-09-06T10:00:00+00:00",
      expiresAt: "2026-09-06T10:00:45+00:00",
    });
  });

  it("carries NO credential on any frame", () => {
    // The property the whole overlay design rests on: the lobby has to redact
    // a token per socket, and this stream has nothing to redact because the
    // callee's grant comes back from the authenticated accept.
    const frames = [
      { type: CALL_FRAME_INCOMING, payload: { call_id: "c", caller_id: ALICE } },
      { type: CALL_FRAME_ACCEPTED, payload: { call_id: "c" } },
      { type: CALL_FRAME_DECLINED, payload: { call_id: "c" } },
      { type: CALL_FRAME_ENDED, payload: { call_id: "c", state: "ended" } },
    ];
    for (const frame of frames) {
      const decoded = decodeCallEvent(frame) as unknown as Record<string, unknown>;
      expect(Object.keys(decoded)).not.toContain("token");
      expect(JSON.stringify(decoded)).not.toMatch(/token/iu);
    }
  });

  it("reads an ended frame's own duration rather than deriving one", () => {
    expect(
      decodeCallEvent({
        type: CALL_FRAME_ENDED,
        payload: {
          call_id: "call-1",
          state: "missed",
          end_reason: "ring_timeout",
          duration_seconds: 0,
        },
      })
    ).toEqual({
      kind: "ended",
      callId: "call-1",
      state: "missed",
      endReason: "ring_timeout",
      durationSeconds: 0,
    });
  });

  it("returns undefined for a type this version has never heard of", () => {
    // Forward compatibility: a deployment may relay a frame a newer backend
    // added, and a client that threw would turn an additive change into a
    // broken screen.
    expect(
      decodeCallEvent({ type: "call.transferred", payload: { call_id: "c" } })
    ).toBeUndefined();
  });

  it("returns undefined for a frame with no call id", () => {
    expect(decodeCallEvent({ type: CALL_FRAME_ENDED, payload: {} })).toBeUndefined();
  });
});

describe("applying an event to the call on screen", () => {
  it("ignores an event about a DIFFERENT call", () => {
    // The rule that keeps one screen from being closed by somebody else's
    // hangup. It lives in one function so no caller has to remember it.
    const call = ringing();
    const other = applyCallEvent(call, {
      kind: "ended",
      callId: "call-other",
      state: "ended",
      endReason: "hangup",
      durationSeconds: 5,
    });
    expect(other).toBe(call);
  });

  it("moves a ringing call to accepted with the server's timestamp", () => {
    const next = applyCallEvent(ringing(), {
      kind: "accepted",
      callId: "call-1",
      answeredAt: "2026-09-06T10:00:07+00:00",
    });
    expect(next?.state).toBe("accepted");
    expect(next?.answered_at).toBe("2026-09-06T10:00:07+00:00");
  });

  it("clears the call on declined and on ended", () => {
    expect(
      applyCallEvent(ringing(), { kind: "declined", callId: "call-1" })
    ).toBeNull();
    expect(
      applyCallEvent(ringing(), {
        kind: "ended",
        callId: "call-1",
        state: "ended",
        endReason: "hangup",
        durationSeconds: 3,
      })
    ).toBeNull();
  });

  it("does not synthesise a call out of an incoming frame", () => {
    // A frame carries six fields and the row carries thirteen. Building the
    // rest would put a fabricated `state` on screen; the provider re-reads
    // instead, which is the same call that repairs a frame we never got.
    expect(
      applyCallEvent(null, {
        kind: "incoming",
        callId: "call-1",
        callerId: ALICE,
        threadKey: "conv-1",
        media: "video",
        startedAt: undefined,
        expiresAt: undefined,
      })
    ).toBeNull();
  });
});
