/**
 * The lobby's realtime half, as data.
 *
 * stapel-video mounts `ws/video/lobby/<join_code>` (`routing.py:19`) under the
 * JWT auth middleware and relays exactly three frame types from the room's
 * group (`consumers.py:30`): `lobby.waiting`, `lobby.admitted`, `lobby.denied`.
 * Client input is ignored by design (`consumers.py:65-68`) — verdicts go
 * through the REST endpoints, so nothing here ever writes to the socket.
 *
 * ── This file opens no socket, and that is the point ──────────────────────
 *
 * §83.1 records the chat client reading a 4401 close as final and sliding
 * silently into polling; `consumers.py:26-27` closes with the same two codes
 * (4401 unauthenticated / 4403 not a member). The reviewed answer to both
 * lives in `@stapel/realtime` — one close-code table for the fleet — and
 * `<LobbyPanel>` consumes it through `useStream`. What is left for this module
 * is the part that is genuinely stapel-video's: which stream, which frames,
 * and what each frame means.
 *
 * The frame parameter is STRUCTURAL (`LobbyFrameLike`) rather than
 * `RealtimeFrame`, so the headless entry keeps no dependency on the socket
 * package at all: a host that renders its own lobby can feed these decoders
 * from any transport, and the `/default` skin is the only place
 * `@stapel/realtime` is imported.
 */

/** Frame types the lobby consumer relays (`consumers.py:_RELAYED`). */
export const LOBBY_FRAME_WAITING = "lobby.waiting";
export const LOBBY_FRAME_ADMITTED = "lobby.admitted";
export const LOBBY_FRAME_DENIED = "lobby.denied";

/** The three, as one list — the set a test asserts against the backend's. */
export const LOBBY_FRAME_TYPES: readonly string[] = [
  LOBBY_FRAME_WAITING,
  LOBBY_FRAME_ADMITTED,
  LOBBY_FRAME_DENIED,
];

/** The shape this module needs off a decoded realtime frame. `RealtimeFrame`
 * satisfies it structurally; so does a host's own transport. */
export interface LobbyFrameLike {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Somebody asked to join and is parked in the lobby. */
export interface LobbyWaitingEvent {
  readonly kind: "waiting";
  readonly participantId: string;
  readonly userId: string;
  /** The display name the backend attached (`services._display_name`). The
   * wire carries it here and NOWHERE else — the REST participant row is ids
   * only — so a host with no roster still sees who is knocking. */
  readonly userName: string | undefined;
}

/** The host let somebody in. `token` is present only in the admitted person's
 * own copy of the frame; a host watching the lobby has no use for it. */
export interface LobbyAdmittedEvent {
  readonly kind: "admitted";
  readonly participantId: string;
  readonly userId: string;
  readonly token: string | undefined;
}

/** The host turned somebody away. */
export interface LobbyDeniedEvent {
  readonly kind: "denied";
  readonly participantId: string;
  readonly userId: string;
}

export type LobbyEvent =
  | LobbyWaitingEvent
  | LobbyAdmittedEvent
  | LobbyDeniedEvent;

/**
 * The stream key for one room's lobby — the `<module>:<scope>:<id>` shape the
 * substrate routes on (`envelope.stream`).
 */
export function lobbyStreamKey(joinCode: string): string {
  return `video:lobby:${joinCode}`;
}

/**
 * The socket path stapel-video serves this lobby on — `routing.py`'s pattern,
 * spelled once so no caller builds it out of string pieces.
 */
export function lobbySocketPath(joinCode: string): string {
  return `ws/video/lobby/${encodeURIComponent(joinCode)}`;
}

/**
 * The absolute socket URL, from an origin a host supplies.
 *
 * The origin is the HOST's: a library that derived it from `window.location`
 * would be wrong for every deployment whose API is not the page (which is most
 * of them), and a browser cannot send a header on a handshake, so the cookie
 * that authenticates it is scoped to whatever origin this resolves to.
 */
export function lobbySocketUrl(wsOrigin: string, joinCode: string): string {
  const base = wsOrigin.endsWith("/") ? wsOrigin.slice(0, -1) : wsOrigin;
  return `${base}/${lobbySocketPath(joinCode)}`;
}

function readString(
  payload: Readonly<Record<string, unknown>>,
  field: string
): string | undefined {
  const value = payload[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * One relayed frame → the event it carries, or `undefined` when it is not a
 * lobby frame or is missing the ids that make it actionable.
 *
 * `undefined` rather than a partially-filled event: a verdict frame with no
 * `participant_id` names nobody, and a lobby that removed "nobody" from its
 * list would be removing the wrong row.
 */
export function decodeLobbyEvent(frame: LobbyFrameLike): LobbyEvent | undefined {
  const participantId = readString(frame.payload, "participant_id");
  const userId = readString(frame.payload, "user_id");
  if (participantId === undefined || userId === undefined) return undefined;

  switch (frame.type) {
    case LOBBY_FRAME_WAITING:
      return {
        kind: "waiting",
        participantId,
        userId,
        userName: readString(frame.payload, "user_name"),
      };
    case LOBBY_FRAME_ADMITTED:
      return {
        kind: "admitted",
        participantId,
        userId,
        token: readString(frame.payload, "token"),
      };
    case LOBBY_FRAME_DENIED:
      return { kind: "denied", participantId, userId };
    default:
      return undefined;
  }
}

/**
 * How fresh the lobby on screen is — the substrate's connection vocabulary
 * reduced to what a person needs to be told.
 *
 * `offline` is a first-class arm, never a silence: a list that stopped
 * updating and says nothing is the §83.1 defect, and it is the reason the
 * panel keeps a visible "Check again" beside this indicator instead of a
 * hidden poll.
 */
export type LobbyLiveness =
  | "connecting"
  | "live"
  | "reconnecting"
  | "refused"
  | "offline";

/** The substrate's per-stream `state` → the four words above. */
export function lobbyLiveness(
  state: string | undefined
): LobbyLiveness {
  switch (state) {
    case "connecting":
      return "connecting";
    case "replaying":
    case "live":
      return "live";
    case "reconnecting":
    case "resync":
      return "reconnecting";
    case "refused":
      return "refused";
    default:
      return "offline";
  }
}
