import type { StapelClient } from "@stapel/core";
import type {
  ActiveCallResponse,
  AdmitResponse,
  CallCreateRequest,
  CallResponse,
  CallSessionRequest,
  CallTokenResponse,
  JoinRequest,
  JoinResponse,
  LobbyActionRequest,
  MediaTokenResponse,
  ParticipantListResponse,
  RoomCreateRequest,
  RoomResponse,
  ScopeUsageResponse,
} from "./types.js";

/**
 * The two request shapes `GET /scopes/{scope_key}/usage/` accepts, as a
 * DISCRIMINATED UNION rather than a bag of loose optional strings.
 *
 * The endpoint takes `month` OR `months`, never both — `months` is ignored
 * when `month` is given — and answers `error.400.video_invalid_usage_period`
 * for a malformed `month`, a `months` outside 1..36, or a `tz` that is not an
 * IANA zone. A `{ month?, months? }` bag would make "both" and "neither"
 * expressible and push the refusal to the server for a mistake the type system
 * can refuse for free.
 */
export type ScopeUsageRequest =
  | {
      /** The last `months` calendar months, newest first. */
      readonly kind: "window";
      readonly months: number;
      readonly tz: string;
    }
  | {
      /** ONE calendar month, `YYYY-MM`. Answers a one-element `months` list,
       * so a reader renders the same shape either way. */
      readonly kind: "month";
      readonly month: string;
      readonly tz: string;
    };

/** The anchored page a participant listing asks for (core `AnchorPagination`
 * — `limit`/`offset` is forbidden shelf-wide). `anchor` is the `joined_at`
 * cursor a previous page handed back, exclusive. */
export interface ParticipantPageRequest {
  readonly anchor?: string;
  readonly limit?: number;
  readonly direction?: "next" | "prev" | "center";
}

/**
 * The pair's typed operation surface — bound to the injected
 * {@link StapelClient} (the per-module override seam of frontend-standard
 * §7.2). Paths are relative to the runtime's `baseUrl` (`/video/api/v1/`).
 *
 * ── Seven of eight operations, and the one that is not here ────────────────
 *
 * `manifest.json` lists the whole of stapel-video's HTTP surface (8 paths):
 * room create/read, the join grant, the two lobby verdicts, the participant
 * list, the usage read, and the provider webhook. All seven browser-callable
 * ones are here. `POST /webhook` is not, and never will be: it is the
 * provider's ingress, verified by a provider signature a browser does not
 * hold.
 *
 * Until 0.2.0 this file carried only `scopeUsage`, on the argument that rooms
 * and the lobby "belong to a meeting client, which is a media-server session
 * and not a React data pair". The half of that argument that is true is about
 * the MEDIA session — which is why `<CallStage>` dynamic-imports an optional
 * peer and can be replaced by a host's own. The half that was wrong is the
 * seam: `JoinResponse.token` is minted by stapel-video's provider out of the
 * join grant, and the lobby is a stapel concept no vendor SDK has heard of.
 * These six calls are precisely what a host cannot get from the SDK it already
 * owns.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2; until then they are hand-authored here (the ONE legal home of path
 * strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface VideoApi {
  readonly client: StapelClient;

  /**
   * One partition's per-month, per-person call time.
   *
   * TWO gates on the far side, and both answer **404**: the mandate gate
   * (`STAPEL_VIDEO["USAGE_MANDATE"]`, held IN this scope) and the scope
   * lookup. `error.404.video_scope_not_found` is therefore uniform over three
   * different situations — the scope does not exist, the scope has no calls,
   * and the caller may not read it — because a 403 would confirm that a
   * guessed tenant id is real. Nothing in this pair tries to tell them apart.
   */
  scopeUsage(
    scopeKey: string,
    request: ScopeUsageRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ScopeUsageResponse>;

  /**
   * Open a room. The caller becomes its host and is admitted immediately, so
   * the answer already carries a token: a host never waits in their own lobby.
   */
  createRoom(
    request?: RoomCreateRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<JoinResponse>;

  /**
   * Read a room by its join code. `404` for a code nobody holds.
   *
   * `scope_key` comes back EMPTY for a caller who is not already in the room:
   * holding a code is an invitation to ask, never proof of belonging, and the
   * tenant a room belongs to is not part of what a code reveals.
   */
  getRoom(
    joinCode: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<RoomResponse>;

  /**
   * Ask to join. Answers `admitted` (with the token), `waiting` (parked in the
   * lobby, no token), or **403 `error.403.video_join_denied`** — a denial is a
   * refusal on the wire, not a `denied` body, so it arrives as a thrown
   * `StapelApiError` and `model/meeting.ts` is where the two shapes become one
   * outcome.
   *
   * `client_session_id` is a stable per-browser mark: the provider folds it
   * into the connection identity, so a reload lands under the SAME identity
   * and the vendor evicts the pre-reload connection instead of leaving a ghost
   * tile until its disconnect timeout.
   */
  joinRoom(
    joinCode: string,
    request?: JoinRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<JoinResponse>;

  /** The room's people, FIFO by `joined_at`. Host-or-participant only: a join
   * code is not authority to enumerate who else is in a call (403
   * `error.403.video_not_room_participant`). */
  participants(
    joinCode: string,
    request?: ParticipantPageRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ParticipantListResponse>;

  /** Host verdict: let a waiting person in, and mint their token. */
  admitParticipant(
    joinCode: string,
    request: LobbyActionRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<AdmitResponse>;

  /** Host verdict: turn a waiting person away. Sticky for this room. */
  denyParticipant(
    joinCode: string,
    request: LobbyActionRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<LobbyActionRequest>;

  // ── 1:1 calls ────────────────────────────────────────────────────────────
  //
  // Seven operations, and every refusal about a call the caller is not party
  // to is **404** — on accept, decline, hangup and the token re-mint as well
  // as on the read. A call id names two people and the conversation they are
  // having, so a 403 would confirm that a guessed id is a real call. Nothing
  // in this pair tries to tell "gone" from "not yours", because the server
  // deliberately does not.

  /**
   * Ring somebody. Answers the CALLER's own token.
   *
   * The callee's token is not minted here and never travels on the ring frame
   * — it comes back from {@link acceptCall}, to an authenticated request by
   * the person it belongs to. That is why the incoming-call overlay has no
   * credential to redact.
   *
   * Refusals worth branching on: **403** `error.403.video_call_not_allowed`
   * (the two of you are not both in that conversation), **409**
   * `error.409.video_call_busy` (one of you is already on a call), **400**
   * `error.400.video_call_invalid_callee`, and **503**
   * `error.503.video_call_provider_unavailable` — the media backend, which is
   * retryable where none of the others are.
   */
  createCall(
    request: CallCreateRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CallTokenResponse>;

  /**
   * This person's live call, or `{ call: null }`.
   *
   * The repair for every dropped frame, and the reason the ring socket is
   * allowed to be best-effort: a lost `call.incoming` would otherwise be a
   * call that never rang and a lost `call.ended` a ring that never stops. The
   * provider re-reads it on mount and on every realtime reconnect.
   */
  activeCall(options?: {
    readonly signal?: AbortSignal;
  }): Promise<ActiveCallResponse>;

  /** One call, for its two parties. 404 for everyone else, and for a call
   * that does not exist — the same answer, given once. */
  getCall(
    callId: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CallResponse>;

  /** The callee picks up, and gets THEIR token. 409 if the ring already ran
   * out or either party got onto another call meanwhile. */
  acceptCall(
    callId: string,
    request?: CallSessionRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CallTokenResponse>;

  /** The callee says no. Terminal, and the caller is told over the socket. */
  declineCall(
    callId: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CallResponse>;

  /** Either party ends it, from either live state. A caller hanging up
   * mid-ring ends the call rather than missing it: somebody was there and
   * stopped waiting, which is a different fact the thread line records. */
  hangupCall(
    callId: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CallResponse>;

  /**
   * A fresh media grant for a call already in progress. Live calls only (409
   * otherwise).
   *
   * Not a nicety: a media token is presented AGAIN on every full reconnect and
   * nothing re-mints it automatically, so without this the token's TTL is a
   * hard ceiling on coming back from a tunnel — and the failure reads as a
   * network fault rather than as an expiry.
   */
  callToken(
    callId: string,
    request?: CallSessionRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<MediaTokenResponse>;
}

const signalOf = (options?: {
  readonly signal?: AbortSignal;
}): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

/** The query string for one request shape — the union, flattened once. */
function usageQuery(request: ScopeUsageRequest): Record<string, string | number> {
  return request.kind === "month"
    ? { month: request.month, tz: request.tz }
    : { months: request.months, tz: request.tz };
}

/** The anchored page, flattened to a query — absent members are absent from
 * the query string rather than sent as `undefined`. */
function participantQuery(
  request: ParticipantPageRequest | undefined
): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (request?.anchor !== undefined) query["anchor"] = request.anchor;
  if (request?.limit !== undefined) query["limit"] = request.limit;
  if (request?.direction !== undefined) query["direction"] = request.direction;
  return query;
}

/** A join code is human-shareable (`abc-defg-hij`) and therefore arrives from a
 * text field, a URL or a paste. Encoded on the way into a path for the same
 * reason the scope key is. */
function roomPath(joinCode: string, suffix = ""): string {
  return `/rooms/${encodeURIComponent(joinCode)}${suffix}`;
}

/** A call id is a UUID the server minted, but it reaches this function from a
 * realtime frame, a URL and a stored draft, so it is encoded like every other
 * caller-held segment rather than trusted to be path-safe. */
function callPath(callId: string, suffix = ""): string {
  return `/calls/${encodeURIComponent(callId)}${suffix}`;
}

export function createVideoApi(client: StapelClient): VideoApi {
  return {
    client,

    scopeUsage: (scopeKey, request, options) =>
      client.get(
        // The scope key is host-chosen and opaque (for meettoday: a workspace
        // id). Encoded, because "opaque" includes shapes that are not path-safe.
        `/scopes/${encodeURIComponent(scopeKey)}/usage/`,
        { query: usageQuery(request), ...signalOf(options) }
      ),

    createRoom: (request, options) =>
      client.post("/rooms", request ?? {}, signalOf(options)),

    getRoom: (joinCode, options) =>
      client.get(roomPath(joinCode), signalOf(options)),

    joinRoom: (joinCode, request, options) =>
      client.post(roomPath(joinCode, "/join"), request ?? {}, signalOf(options)),

    participants: (joinCode, request, options) =>
      client.get(roomPath(joinCode, "/participants"), {
        query: participantQuery(request),
        ...signalOf(options),
      }),

    admitParticipant: (joinCode, request, options) =>
      client.post(roomPath(joinCode, "/lobby/admit"), request, signalOf(options)),

    denyParticipant: (joinCode, request, options) =>
      client.post(roomPath(joinCode, "/lobby/deny"), request, signalOf(options)),

    createCall: (request, options) =>
      client.post("/calls", request, signalOf(options)),

    // NOT callPath("active"): "active" is a reserved name in this space, not
    // an id, and routing it through the encoder would be one edit away from
    // asking for a call whose id is the literal string "active".
    activeCall: (options) => client.get("/calls/active", signalOf(options)),

    getCall: (callId, options) => client.get(callPath(callId), signalOf(options)),

    acceptCall: (callId, request, options) =>
      client.post(callPath(callId, "/accept"), request ?? {}, signalOf(options)),

    declineCall: (callId, options) =>
      client.post(callPath(callId, "/decline"), {}, signalOf(options)),

    hangupCall: (callId, options) =>
      client.post(callPath(callId, "/hangup"), {}, signalOf(options)),

    callToken: (callId, request, options) =>
      client.post(callPath(callId, "/token"), request ?? {}, signalOf(options)),
  };
}
