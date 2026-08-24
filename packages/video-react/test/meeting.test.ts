import { describe, expect, it } from "vitest";
import { StapelApiError } from "@stapel/core";
import {
  LOBBY_FRAME_ADMITTED,
  LOBBY_FRAME_DENIED,
  LOBBY_FRAME_WAITING,
  LOBBY_FRAME_TYPES,
  accessLevelKey,
  decodeLobbyEvent,
  isJoinDenied,
  isRoomHost,
  joinOutcome,
  joinOutcomeFromError,
  lobbyLiveness,
  lobbySocketPath,
  lobbySocketUrl,
  lobbyStreamKey,
  normalizeJoinCode,
  participantRoleKey,
  participantStatusKey,
  presentParticipants,
  waitingParticipants,
} from "../src/index.js";
import type { JoinResponse, ParticipantResponse } from "../src/index.js";

const ROOM = {
  id: "r-1",
  join_code: "abc-defg-hij",
  scope_key: "acme-7f0c",
  access_level: "scope_trusted",
  admit_required: true,
  created_by_id: "u-9a1f",
  provider_room_ref: "lk_1",
};

const PARTICIPANT: ParticipantResponse = {
  id: "p-1",
  user_id: "u-4c02",
  status: "waiting",
  role: "guest",
  joined_at: "2026-08-24T09:00:00Z",
};

function response(status: string, token?: string | null): JoinResponse {
  return { status, room: ROOM, participant: PARTICIPANT, ...(token !== undefined ? { token } : {}) };
}

describe("the join grant resolves to one outcome, from two wire shapes", () => {
  it("admitted carries the token", () => {
    const outcome = joinOutcome(response("admitted", "tok-1"));
    expect(outcome.kind).toBe("admitted");
    expect(outcome.kind === "admitted" && outcome.token).toBe("tok-1");
  });

  it("admitted WITHOUT a token is still admitted — an unconfigured provider is not a denial", () => {
    const outcome = joinOutcome(response("admitted", null));
    expect(outcome.kind).toBe("admitted");
    expect(outcome.kind === "admitted" && outcome.token).toBeUndefined();
  });

  it("waiting carries no token", () => {
    expect(joinOutcome(response("waiting")).kind).toBe("waiting");
  });

  it("an unknown status reads as waiting — the arm that claims neither entry nor refusal", () => {
    expect(joinOutcome(response("something-new")).kind).toBe("waiting");
  });

  it("the 403 denial is an OUTCOME, not a failure", () => {
    const denial = new StapelApiError({
      code: "error.403.video_join_denied",
      status: 403,
      message: "denied",
      params: {},
    });
    expect(isJoinDenied(denial)).toBe(true);
    expect(joinOutcomeFromError(denial)?.kind).toBe("denied");
  });

  it("any other failure is NOT folded into a denial", () => {
    expect(joinOutcomeFromError(new TypeError("Failed to fetch"))).toBeUndefined();
  });
});

describe("the wire's open strings never reach a screen raw", () => {
  it("maps every access level, and names the unknown one", () => {
    expect(accessLevelKey("public")).toBe("video.room.access.public");
    expect(accessLevelKey("scope_trusted")).toBe("video.room.access.scope_trusted");
    expect(accessLevelKey("restricted")).toBe("video.room.access.restricted");
    expect(accessLevelKey("something-new")).toBe("video.room.access.unknown");
  });

  it("maps every participant status", () => {
    expect(participantStatusKey("waiting")).toBe("video.participant.status.waiting");
    expect(participantStatusKey("admitted")).toBe("video.participant.status.admitted");
    expect(participantStatusKey("denied")).toBe("video.participant.status.denied");
    expect(participantStatusKey("left")).toBe("video.participant.status.left");
    expect(participantStatusKey("?")).toBe("video.participant.status.unknown");
  });

  it("an unrecognised role reads as a guest — never promotes a stranger", () => {
    expect(participantRoleKey("host")).toBe("video.participant.role.host");
    expect(participantRoleKey("something-new")).toBe("video.participant.role.guest");
  });
});

describe("host-ness is told, never guessed", () => {
  it("is true only when the viewer id matches the creator", () => {
    expect(isRoomHost(ROOM, "u-9a1f")).toBe(true);
    expect(isRoomHost(ROOM, "u-4c02")).toBe(false);
  });

  it("is false when no viewer id was supplied — a guess would light a control the backend 403s", () => {
    expect(isRoomHost(ROOM, undefined)).toBe(false);
    expect(isRoomHost(undefined, "u-9a1f")).toBe(false);
  });
});

describe("join codes as a person actually holds them", () => {
  it("trims, lowercases and drops inner whitespace", () => {
    expect(normalizeJoinCode("  Abc-DEFG-hij \n")).toBe("abc-defg-hij");
    expect(normalizeJoinCode("abc defg hij")).toBe("abcdefghij");
  });
});

describe("the lobby's three frames", () => {
  it("names exactly the three the consumer relays", () => {
    expect([...LOBBY_FRAME_TYPES].sort()).toEqual(
      ["lobby.admitted", "lobby.denied", "lobby.waiting"].sort()
    );
  });

  it("decodes an arrival, with the name only the socket carries", () => {
    const event = decodeLobbyEvent({
      type: LOBBY_FRAME_WAITING,
      payload: { participant_id: "p-1", user_id: "u-4c02", user_name: "Ada L." },
    });
    expect(event).toEqual({
      kind: "waiting",
      participantId: "p-1",
      userId: "u-4c02",
      userName: "Ada L.",
    });
  });

  it("decodes a verdict", () => {
    expect(
      decodeLobbyEvent({
        type: LOBBY_FRAME_ADMITTED,
        payload: { participant_id: "p-1", user_id: "u-4c02", token: "tok" },
      })
    ).toEqual({ kind: "admitted", participantId: "p-1", userId: "u-4c02", token: "tok" });
    expect(
      decodeLobbyEvent({
        type: LOBBY_FRAME_DENIED,
        payload: { participant_id: "p-1", user_id: "u-4c02" },
      })
    ).toEqual({ kind: "denied", participantId: "p-1", userId: "u-4c02" });
  });

  it("refuses a frame that names nobody — removing 'nobody' would remove the wrong row", () => {
    expect(
      decodeLobbyEvent({ type: LOBBY_FRAME_DENIED, payload: { user_id: "u-4c02" } })
    ).toBeUndefined();
  });

  it("ignores a type the lobby does not own", () => {
    expect(
      decodeLobbyEvent({
        type: "chat.read",
        payload: { participant_id: "p-1", user_id: "u-4c02" },
      })
    ).toBeUndefined();
  });

  it("builds the stream key and the path routing.py serves", () => {
    expect(lobbyStreamKey("abc-defg-hij")).toBe("video:lobby:abc-defg-hij");
    expect(lobbySocketPath("abc-defg-hij")).toBe("ws/video/lobby/abc-defg-hij");
    expect(lobbySocketUrl("wss://api.example.com/", "abc-defg-hij")).toBe(
      "wss://api.example.com/ws/video/lobby/abc-defg-hij"
    );
  });

  it("reduces the substrate's states to what a person is told — and never to silence", () => {
    expect(lobbyLiveness("live")).toBe("live");
    expect(lobbyLiveness("replaying")).toBe("live");
    expect(lobbyLiveness("reconnecting")).toBe("reconnecting");
    expect(lobbyLiveness("resync")).toBe("reconnecting");
    expect(lobbyLiveness("refused")).toBe("refused");
    // The important one: no stream at all is "offline", a state the panel
    // renders with a visible "Check again" — never a hidden poll (§83.1).
    expect(lobbyLiveness(undefined)).toBe("offline");
    expect(lobbyLiveness("closed")).toBe("offline");
  });
});

describe("the room's people, split the way the screens need them", () => {
  const rows: readonly ParticipantResponse[] = [
    { ...PARTICIPANT, id: "p-1", status: "waiting" },
    { ...PARTICIPANT, id: "p-2", status: "admitted" },
    { ...PARTICIPANT, id: "p-3", status: "left" },
    { ...PARTICIPANT, id: "p-4", status: "denied" },
  ];

  it("waiting is only the people still owed a verdict", () => {
    expect(waitingParticipants(rows).map((r) => r.id)).toEqual(["p-1"]);
  });

  it("present excludes those who left and those turned away", () => {
    expect(presentParticipants(rows).map((r) => r.id)).toEqual(["p-2"]);
  });
});
