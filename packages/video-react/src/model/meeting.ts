/**
 * The meeting model: what a join ATTEMPT actually resolves to, and the small
 * vocabularies the wire spells as open strings.
 *
 * ── One outcome, arriving in two shapes ────────────────────────────────────
 *
 * `POST /rooms/{code}/join` answers `200 {status: "admitted"|"waiting", …}`
 * for two of its three outcomes and **403 `error.403.video_join_denied`** for
 * the third (`views.RoomJoinView.post`). A screen that read only the body
 * would render a denial as a generic failure with a retry button — re-asking a
 * question the host already answered, which is the worst possible reading of
 * a refusal that is deliberately sticky.
 *
 * So the branch lives here, once: {@link joinOutcome} folds a response and
 * {@link joinOutcomeFromError} folds a thrown value, and both produce the same
 * three-armed {@link JoinOutcome}. Nothing above this file looks at
 * `response.status` or at an error code.
 *
 * ── The open strings ──────────────────────────────────────────────────────
 *
 * `access_level`, `ParticipantResponse.status` and `.role` are `str` on the
 * wire (drf-spectacular emits no enum for them), so a screen that printed them
 * would print `scope_trusted` at a person. The maps below turn each into an
 * i18n KEY, with an explicit unknown arm — a value this pair has not seen is a
 * newer backend, not a reason to render a raw enum member.
 */
import { isErrorCode, toFlowError } from "@stapel/core";
import type {
  JoinResponse,
  ParticipantResponse,
  RoomResponse,
} from "../api/types.js";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";

/** Wire values of `JoinResponse.status` this pair understands. */
export const JOIN_ADMITTED = "admitted";
export const JOIN_WAITING = "waiting";
export const JOIN_DENIED = "denied";

/** Wire values of `ParticipantResponse.status`. */
export const PARTICIPANT_WAITING = "waiting";
export const PARTICIPANT_ADMITTED = "admitted";
export const PARTICIPANT_DENIED = "denied";
export const PARTICIPANT_LEFT = "left";

/**
 * What asking to join resolved to.
 *
 * `token` is present ONLY on `admitted`, and it is optional even there: the
 * schema types it `string | null`, and a deployment whose provider seam is
 * unconfigured admits a person without minting one. A stage that treated an
 * absent token as a bug would blame the person for the deployment; it renders
 * a named refusal instead.
 */
export type JoinOutcome =
  | {
      readonly kind: "admitted";
      readonly room: RoomResponse;
      readonly participant: ParticipantResponse;
      readonly token: string | undefined;
    }
  | {
      readonly kind: "waiting";
      readonly room: RoomResponse;
      readonly participant: ParticipantResponse;
    }
  | {
      /** The host said no. Sticky for this room — never offer a retry. */
      readonly kind: "denied";
      readonly room: RoomResponse | undefined;
      readonly participant: ParticipantResponse | undefined;
    };

/** A 200 join body → the outcome it names. An unknown `status` is read as
 * `waiting`: the room holds a row for this person and no token was issued,
 * which is what waiting IS — and it is the only arm that neither claims entry
 * nor claims refusal. */
export function joinOutcome(response: JoinResponse): JoinOutcome {
  if (response.status === JOIN_DENIED) {
    return {
      kind: "denied",
      room: response.room,
      participant: response.participant,
    };
  }
  if (response.status === JOIN_ADMITTED) {
    return {
      kind: "admitted",
      room: response.room,
      participant: response.participant,
      token: response.token ?? undefined,
    };
  }
  return {
    kind: "waiting",
    room: response.room,
    participant: response.participant,
  };
}

/** Is this the sticky refusal a host handed down? */
export function isJoinDenied(error: unknown): boolean {
  return isErrorCode(toFlowError(error), "error.403.video_join_denied");
}

/** Is this "no room has that code"? */
export function isRoomNotFound(error: unknown): boolean {
  return isErrorCode(toFlowError(error), "error.404.video_room_not_found");
}

/** Is this "only the host may do that"? */
export function isNotRoomHost(error: unknown): boolean {
  return isErrorCode(toFlowError(error), "error.403.video_not_room_host");
}

/** Is this "only people in the room may see that"? */
export function isNotRoomParticipant(error: unknown): boolean {
  return isErrorCode(toFlowError(error), "error.403.video_not_room_participant");
}

/** Is this "that person is no longer waiting"? A verdict that raced another
 * verdict, or a lobby that emptied while the host was reading it. */
export function isParticipantNotFound(error: unknown): boolean {
  return isErrorCode(toFlowError(error), "error.404.video_participant_not_found");
}

/**
 * A thrown value → the `denied` outcome, or `undefined` for anything else.
 *
 * `undefined` rather than a `denied` fallback on purpose: a network fault and
 * a host's refusal are different sentences, and only one of them is about the
 * person reading it.
 */
export function joinOutcomeFromError(error: unknown): JoinOutcome | undefined {
  if (!isJoinDenied(error)) return undefined;
  return { kind: "denied", room: undefined, participant: undefined };
}

/** The i18n key naming a room's access level. */
export function accessLevelKey(accessLevel: string): string {
  switch (accessLevel) {
    case "public":
      return VIDEO_I18N_KEYS.roomAccessPublic;
    case "scope_trusted":
      return VIDEO_I18N_KEYS.roomAccessScopeTrusted;
    case "restricted":
      return VIDEO_I18N_KEYS.roomAccessRestricted;
    default:
      return VIDEO_I18N_KEYS.roomAccessUnknown;
  }
}

/** The i18n key naming a participant's status. */
export function participantStatusKey(status: string): string {
  switch (status) {
    case PARTICIPANT_WAITING:
      return VIDEO_I18N_KEYS.participantStatusWaiting;
    case PARTICIPANT_ADMITTED:
      return VIDEO_I18N_KEYS.participantStatusAdmitted;
    case PARTICIPANT_DENIED:
      return VIDEO_I18N_KEYS.participantStatusDenied;
    case PARTICIPANT_LEFT:
      return VIDEO_I18N_KEYS.participantStatusLeft;
    default:
      return VIDEO_I18N_KEYS.participantStatusUnknown;
  }
}

/** The i18n key naming a participant's role. Two values on the wire, and the
 * absence of "host" is what "guest" means — so an unrecognised role reads as a
 * guest rather than promoting a stranger in the UI. */
export function participantRoleKey(role: string): string {
  return role === "host"
    ? VIDEO_I18N_KEYS.participantRoleHost
    : VIDEO_I18N_KEYS.participantRoleGuest;
}

/** Everyone still waiting on the host's verdict, in the FIFO order the page
 * arrived in. */
export function waitingParticipants(
  participants: readonly ParticipantResponse[]
): readonly ParticipantResponse[] {
  return participants.filter((p) => p.status === PARTICIPANT_WAITING);
}

/** Everyone the host let in and who has not left. */
export function presentParticipants(
  participants: readonly ParticipantResponse[]
): readonly ParticipantResponse[] {
  return participants.filter((p) => p.status === PARTICIPANT_ADMITTED);
}

/**
 * Is `userId` this room's host?
 *
 * `RoomResponse.created_by_id` is the only host marker a room carries, and the
 * pair does not learn the viewer's id on its own: the host tells it
 * (`viewerUserId`). Absent a viewer id the answer is `false` — a screen that
 * guessed would offer lobby verdicts the backend then refuses with 403, which
 * is the dead-control shape §83 forbids.
 */
export function isRoomHost(
  room: RoomResponse | undefined,
  viewerUserId: string | undefined
): boolean {
  if (room === undefined || viewerUserId === undefined) return false;
  return room.created_by_id === viewerUserId;
}

/**
 * A join code, normalized the way a person pastes it: trimmed, lower-cased,
 * inner whitespace dropped.
 *
 * The backend's codes are `abc-defg-hij`, and the two things a person actually
 * does with one are paste it with a trailing space out of a chat message and
 * type it with a capital letter at the start because a phone keyboard did that
 * for them. Neither is a different room.
 */
export function normalizeJoinCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}
