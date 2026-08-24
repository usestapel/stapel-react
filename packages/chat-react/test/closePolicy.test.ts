/**
 * The close-code table, and the degradation it becomes on screen.
 *
 * These are the two pure functions the socket and the seam both read, so a
 * verdict is stated once and asserted once. The socket's own behaviour under
 * each code is exercised through the real handshake path in
 * `handshake.test.ts`; this file pins the TABLE against
 * `stapel_realtime/close_codes.py`, which is the document it mirrors.
 */
import { describe, expect, it } from "vitest";
import {
  CHAT_WS_CLOSE_DATA_HOME_UNAVAILABLE,
  CHAT_WS_CLOSE_FORBIDDEN,
  CHAT_WS_CLOSE_HEARTBEAT_TIMEOUT,
  CHAT_WS_CLOSE_NOT_PARTICIPANT,
  CHAT_WS_CLOSE_OVERFLOW,
  CHAT_WS_CLOSE_PROTOCOL_ERROR,
  CHAT_WS_CLOSE_REVOKED,
  CHAT_WS_CLOSE_STREAM_UNKNOWN,
  CHAT_WS_CLOSE_UNAUTHENTICATED,
  chatClosePolicy,
  chatDegradation,
  chatSocketTarget,
} from "../src/index.js";
import type { ChatSocketStatus } from "../src/index.js";

describe("the numbers are the substrate's, not this pair's", () => {
  it("mirrors stapel_realtime.close_codes", () => {
    expect(CHAT_WS_CLOSE_PROTOCOL_ERROR).toBe(4400);
    expect(CHAT_WS_CLOSE_UNAUTHENTICATED).toBe(4401);
    expect(CHAT_WS_CLOSE_FORBIDDEN).toBe(4403);
    expect(CHAT_WS_CLOSE_STREAM_UNKNOWN).toBe(4404);
    expect(CHAT_WS_CLOSE_HEARTBEAT_TIMEOUT).toBe(4408);
    expect(CHAT_WS_CLOSE_REVOKED).toBe(4410);
    expect(CHAT_WS_CLOSE_OVERFLOW).toBe(4413);
    expect(CHAT_WS_CLOSE_DATA_HOME_UNAVAILABLE).toBe(4503);
  });

  it("keeps the old name pointing at the same number, and says why it is wrong", () => {
    // 4403 also means "cookie handshake from an origin this deployment does
    // not allow-list" — telling that person they are "not a participant" is
    // a lie about someone else's misconfiguration.
    expect(CHAT_WS_CLOSE_NOT_PARTICIPANT).toBe(CHAT_WS_CLOSE_FORBIDDEN);
  });
});

describe("three actions, and 4401 is not among the terminal ones", () => {
  it("a refused CREDENTIAL asks for a new one", () => {
    expect(chatClosePolicy(4401)).toEqual({
      action: "renew-credential",
      reason: "credential_rejected",
    });
  });

  it("the terminal set is exactly the substrate's, plus a build this server cannot read", () => {
    const terminal = [4400, 4403, 4404, 4410];
    for (const code of terminal) {
      expect(chatClosePolicy(code).action, String(code)).toBe("stop");
    }
    // `stapel_realtime.TERMINAL_CLOSE_CODES` is {4403, 4404, 4410} — 4401 is
    // deliberately NOT in it, because the credential behind it is renewable.
    expect(chatClosePolicy(4401).action).not.toBe("stop");
  });

  it("faults reconnect: heartbeat, overflow, a missing data home", () => {
    for (const code of [4408, 4413, 4503]) {
      expect(chatClosePolicy(code).action, String(code)).toBe("reconnect");
    }
  });

  it("an unrecognised code is a FAULT, never a stop", () => {
    // 1006 (abnormal), 1001 (the proxy cycled), anything a future substrate
    // mints. A client that stops on a code it does not know is a client that
    // stops.
    for (const code of [1000, 1001, 1006, 4999]) {
      expect(chatClosePolicy(code), String(code)).toEqual({
        action: "reconnect",
        reason: "transport",
      });
    }
  });
});

describe("what a browser can put on a handshake", () => {
  it("cookie and null are the same construction — no subprotocols", () => {
    expect(chatSocketTarget("wss://h/ws", { channel: "cookie" })).toEqual({
      url: "wss://h/ws",
      protocols: [],
    });
    expect(chatSocketTarget("wss://h/ws", null)).toEqual({
      url: "wss://h/ws",
      protocols: [],
    });
  });

  it("a query token merges into a URL that already has parameters", () => {
    expect(chatSocketTarget("wss://h/ws?x=1", { channel: "query", token: "t" })).toEqual({
      url: "wss://h/ws?x=1&token=t",
      protocols: [],
    });
  });
});

function status(over: Partial<ChatSocketStatus>): ChatSocketStatus {
  return {
    state: "closed",
    refusal: undefined,
    reason: undefined,
    attempt: 0,
    ...over,
  };
}

const LIVE = { hasSocket: true, attempted: true };

describe("a degraded socket is never anonymous", () => {
  it("says nothing while it is live", () => {
    expect(chatDegradation(status({ state: "open" }), LIVE)).toBeNull();
  });

  it("says nothing before the socket is allowed to try", () => {
    // The thread window has not loaded, so the socket is held back on
    // purpose. Nothing has failed.
    expect(
      chatDegradation(status({ state: "closed" }), { hasSocket: true, attempted: false })
    ).toBeNull();
  });

  it("names a deployment with no socket at all, instead of polling in silence", () => {
    expect(
      chatDegradation(status({ state: "closed" }), { hasSocket: false, attempted: true })
    ).toMatchObject({ reason: "no_socket" });
  });

  it("distinguishes a reconnect from a credential renewal while both are pending", () => {
    expect(
      chatDegradation(status({ state: "degraded", reason: "transport", attempt: 2 }), LIVE)
    ).toMatchObject({ reason: "reconnecting", attempt: 2 });
    expect(
      chatDegradation(
        status({ state: "connecting", reason: "credential_rejected" }),
        LIVE
      )
    ).toMatchObject({ reason: "renewing_credential" });
    // The very first connect has no close behind it.
    expect(chatDegradation(status({ state: "connecting" }), LIVE)).toBeNull();
  });

  it("turns every refusal into something a person can act on", () => {
    const cases = [
      ["unauthenticated", "sign_in_required"],
      ["forbidden", "forbidden"],
      ["unknown_stream", "forbidden"],
      ["revoked", "forbidden"],
      ["protocol", "unsupported"],
      ["unreachable", "unreachable"],
    ] as const;
    for (const [refusal, reason] of cases) {
      expect(
        chatDegradation(status({ state: "closed", refusal }), LIVE),
        refusal
      ).toMatchObject({ reason });
    }
  });

  it("every named reason carries an i18n key, so no skin can render it blank", () => {
    const seen = new Set<string>();
    for (const refusal of [
      "unauthenticated",
      "forbidden",
      "unknown_stream",
      "revoked",
      "protocol",
      "unreachable",
    ] as const) {
      const degraded = chatDegradation(status({ state: "closed", refusal }), LIVE);
      expect(degraded?.messageKey).toMatch(/^chat\.transport\.degraded\./);
      seen.add(degraded?.messageKey ?? "");
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
