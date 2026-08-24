/**
 * The meeting client's state, headless.
 *
 * Two bags, because they answer to two different people:
 *
 *  - {@link useMeeting} is the JOINER's — open a room or ask to join one, and
 *    hold the outcome (admitted with a token / waiting / denied). Everything a
 *    guest sees hangs off it.
 *  - {@link useLobby} is the HOST's — who is knocking, and the two verdicts.
 *    It also serves a guest read-only, because the participant list is the
 *    same list.
 *
 * Both take live lobby frames through an `apply` seam rather than opening a
 * socket: the socket is `@stapel/realtime`'s one reviewed copy, wired in the
 * `/default` skin, and these hooks stay usable by a host that has its own
 * transport — or none, in which case the panel says "not live" and offers
 * "Check again" instead of quietly polling (§83.1).
 */
import { useCallback, useMemo, useReducer, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  actionAvailable,
  actionBlocked,
  loadReady,
  mapLoad,
  loadStateFromQuery,
  useActiveSessionReady,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type {
  JoinRequest,
  ParticipantResponse,
  RoomCreateRequest,
  RoomResponse,
} from "../api/types.js";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { useVideoApi, useVideoRuntime } from "./context.js";
import { roomQueryKeys } from "./queryKeys.js";
import {
  isParticipantNotFound,
  joinOutcome,
  joinOutcomeFromError,
  presentParticipants,
  waitingParticipants,
} from "./meeting.js";
import type { JoinOutcome } from "./meeting.js";
import type { LobbyEvent, LobbyWaitingEvent } from "./lobby.js";

// ── the joiner's bag ────────────────────────────────────────────────────────

export interface UseMeetingOptions {
  /** A stable per-browser id, forwarded on create and join. The provider folds
   * it into the connection identity so a reload replaces the pre-reload
   * connection instead of leaving a ghost tile. Defaults to the runtime's. */
  readonly clientSessionId?: string;
}

export interface MeetingBag {
  /** What the last attempt resolved to. `undefined` before anything was
   * asked — which is NOT "denied" and not "waiting". */
  readonly outcome: JoinOutcome | undefined;
  /** The room, when one is held. */
  readonly room: RoomResponse | undefined;
  /** The provider token, present only once admitted (and only when the
   * deployment's provider seam minted one). */
  readonly token: string | undefined;
  /** The caller's own participant id, for matching lobby frames to itself. */
  readonly participantId: string | undefined;
  /** The last failure that was NOT a host's refusal (a denial is an outcome,
   * not an error). */
  readonly error: unknown;
  /** Open a room and become its host. */
  readonly start: (request?: RoomCreateRequest) => void;
  /** Ask to join a room by its join code. */
  readonly join: (joinCode: string, request?: JoinRequest) => void;
  /** Drop the held room — this app's state only; it tells the server nothing. */
  readonly leave: () => void;
  /** Available, or blocked with a reason while a request is in flight. */
  readonly startGate: ActionAvailability;
  readonly joinGate: ActionAvailability;
  /**
   * Feed a live lobby frame in. A verdict about SOMEBODY ELSE is ignored here
   * (it is the lobby's business); a verdict about the holder promotes the
   * outcome — which is the whole reason the socket exists: a guest learns they
   * were let in without asking again.
   */
  readonly applyLobbyEvent: (event: LobbyEvent) => void;
}

export function useMeeting(options: UseMeetingOptions = {}): MeetingBag {
  const api = useVideoApi();
  const runtime = useVideoRuntime();
  const clientSessionId = options.clientSessionId ?? runtime.clientSessionId;
  const [outcome, setOutcome] = useState<JoinOutcome | undefined>(undefined);

  const withSession = useCallback(
    <T extends { client_session_id?: string | null }>(request: T | undefined): T =>
      ({
        ...(request ?? ({} as T)),
        ...(clientSessionId !== undefined
          ? { client_session_id: clientSessionId }
          : {}),
      }) as T,
    [clientSessionId]
  );

  const create = useMutation({
    mutationFn: (request: RoomCreateRequest | undefined) =>
      api.createRoom(withSession(request)),
    onSuccess: (response) => {
      setOutcome(joinOutcome(response));
    },
  });

  const ask = useMutation({
    mutationFn: (input: { joinCode: string; request: JoinRequest | undefined }) =>
      api.joinRoom(input.joinCode, withSession(input.request)),
    onSuccess: (response) => {
      setOutcome(joinOutcome(response));
    },
    onError: (error: unknown) => {
      // A 403 join_denied is the third OUTCOME of this operation, not a fault:
      // it is rendered as the host's answer, with no retry, because asking
      // again cannot change it.
      const denied = joinOutcomeFromError(error);
      if (denied !== undefined) setOutcome(denied);
    },
  });

  const pending = create.isPending || ask.isPending;
  const busyStart = pending
    ? actionBlocked(VIDEO_I18N_KEYS.roomsStartBlockedPending)
    : actionAvailable();
  const busyJoin = pending
    ? actionBlocked(VIDEO_I18N_KEYS.roomsJoinBlockedPending)
    : actionAvailable();

  // A denial arrived through `onError`, so the mutation is also holding it as a
  // failure. It is an outcome on screen and must not ALSO be an error banner.
  const askError =
    ask.error !== null && joinOutcomeFromError(ask.error) === undefined
      ? ask.error
      : undefined;
  const error = create.error ?? askError ?? undefined;

  const applyLobbyEvent = useCallback((event: LobbyEvent): void => {
    setOutcome((current) => {
      if (current === undefined) return current;
      const self = current.participant;
      if (self === undefined || self.id !== event.participantId) return current;
      if (event.kind === "admitted") {
        return {
          kind: "admitted",
          room: current.room as RoomResponse,
          participant: { ...self, status: "admitted" },
          token: event.token,
        };
      }
      if (event.kind === "denied") {
        return {
          kind: "denied",
          room: current.room,
          participant: { ...self, status: "denied" },
        };
      }
      return current;
    });
  }, []);

  const start = useCallback(
    (request?: RoomCreateRequest): void => {
      create.mutate(request);
    },
    [create]
  );
  const join = useCallback(
    (joinCode: string, request?: JoinRequest): void => {
      ask.mutate({ joinCode, request });
    },
    [ask]
  );
  const leave = useCallback((): void => {
    setOutcome(undefined);
    create.reset();
    ask.reset();
  }, [create, ask]);

  return {
    outcome,
    room: outcome?.room,
    token: outcome?.kind === "admitted" ? outcome.token : undefined,
    participantId: outcome?.participant?.id,
    error,
    start,
    join,
    leave,
    startGate: busyStart,
    joinGate: busyJoin,
    applyLobbyEvent,
  };
}

// ── the room read ───────────────────────────────────────────────────────────

/**
 * One room, by join code.
 *
 * The canonical read behind a `/meeting/:code` route: a person who arrives on a
 * link holds a code and nothing else, and this is what turns it into a name, an
 * access level and a lobby switch BEFORE they ask to join. `scope_key` comes
 * back empty for a caller the room does not already hold a row for — holding a
 * code is an invitation to ask, not membership — so nothing here treats it as
 * an identifier.
 */
export function useRoom(
  joinCode: string | undefined,
  options: { readonly enabled?: boolean } = {}
): LoadState<RoomResponse> {
  const api = useVideoApi();
  const sessionReady = useActiveSessionReady();
  const addressable = joinCode !== undefined && joinCode.length > 0;
  const code = joinCode ?? "";
  const query = useQuery({
    queryKey: roomQueryKeys.room(code),
    queryFn: ({ signal }) => api.getRoom(code, { signal }),
    enabled: sessionReady && addressable && (options.enabled ?? true),
  });
  return loadStateFromQuery(query);
}

// ── the host's bag ──────────────────────────────────────────────────────────

/** One person waiting on the host's verdict. */
export interface WaitingPerson {
  readonly participantId: string;
  readonly userId: string;
  /** The name the lobby frame carried, when the arrival was seen live. The
   * REST row carries ids only, so a name is a bonus and never a promise. */
  readonly name: string | undefined;
  /** `true` when this arrival was learned from the socket rather than from the
   * last participant read — so a skin can say the list is ahead of the page. */
  readonly live: boolean;
}

interface Overlay {
  /** Arrivals seen live that the last REST page does not carry yet. */
  readonly arrivals: readonly LobbyWaitingEvent[];
  /** Participant ids already answered — by us, or by another host's client. */
  readonly settled: ReadonlySet<string>;
  /** Names learned from live frames, kept after the arrival is settled so a
   * confirmation can still name the person. */
  readonly names: ReadonlyMap<string, string>;
}

type OverlayAction =
  | { readonly type: "event"; readonly event: LobbyEvent }
  | { readonly type: "settle"; readonly participantId: string }
  | { readonly type: "reset" };

const EMPTY_OVERLAY: Overlay = {
  arrivals: [],
  settled: new Set<string>(),
  names: new Map<string, string>(),
};

function overlayReducer(state: Overlay, action: OverlayAction): Overlay {
  if (action.type === "reset") return EMPTY_OVERLAY;
  if (action.type === "settle") {
    const settled = new Set(state.settled);
    settled.add(action.participantId);
    return {
      arrivals: state.arrivals.filter(
        (a) => a.participantId !== action.participantId
      ),
      settled,
      names: state.names,
    };
  }
  const { event } = action;
  if (event.kind === "waiting") {
    const names = new Map(state.names);
    if (event.userName !== undefined) names.set(event.participantId, event.userName);
    // A re-delivered arrival is the same arrival: the lobby is a set of
    // people, not a log of knocks.
    const known = state.arrivals.some(
      (a) => a.participantId === event.participantId
    );
    if (known || state.settled.has(event.participantId)) {
      return { ...state, names };
    }
    return { arrivals: [...state.arrivals, event], settled: state.settled, names };
  }
  const settled = new Set(state.settled);
  settled.add(event.participantId);
  return {
    arrivals: state.arrivals.filter((a) => a.participantId !== event.participantId),
    settled,
    names: state.names,
  };
}

export interface UseLobbyOptions {
  /** Hold the read (no room yet, or the panel is closed). */
  readonly enabled?: boolean;
  /** Only a host may answer the lobby. A viewer who is not the host gets the
   * list read-only and a stated reason on the controls, rather than buttons
   * the backend answers 403 to. */
  readonly isHost?: boolean;
}

export interface LobbyBag {
  /** The room's people, as the last page read them. */
  readonly participants: LoadState<readonly ParticipantResponse[]>;
  /** Everyone still waiting — the REST page merged with what the socket has
   * said since. */
  readonly waiting: LoadState<readonly WaitingPerson[]>;
  /** Everyone the host let in and who has not left. */
  readonly present: LoadState<readonly ParticipantResponse[]>;
  /** The page did not carry everyone (`has_next`). The skin says so rather
   * than presenting a partial roster as the whole room. */
  readonly hasMore: boolean;
  /** Re-read the participant page. The visible half of "not live". */
  readonly refresh: () => void;
  /** Feed one decoded lobby frame in. */
  readonly apply: (event: LobbyEvent) => void;
  readonly admit: (participantId: string) => void;
  readonly deny: (participantId: string) => void;
  /** The verdict controls' availability: host-only, and blocked while a
   * verdict is in flight. */
  readonly verdictGate: ActionAvailability;
  /** The participant a verdict is currently in flight for. */
  readonly pendingParticipantId: string | undefined;
  /** The last verdict failure. A verdict that raced another host's verdict
   * (`video_participant_not_found`) is NOT reported here — it is settled
   * state, and the row simply leaves. */
  readonly error: unknown;
}

export function useLobby(
  joinCode: string | undefined,
  options: UseLobbyOptions = {}
): LobbyBag {
  const api = useVideoApi();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();
  const [overlay, dispatch] = useReducer(overlayReducer, EMPTY_OVERLAY);
  const [pendingParticipantId, setPending] = useState<string | undefined>(
    undefined
  );
  const addressable = joinCode !== undefined && joinCode.length > 0;
  const enabled = sessionReady && addressable && (options.enabled ?? true);
  const code = joinCode ?? "";

  const page = useQuery({
    queryKey: roomQueryKeys.participants(code),
    queryFn: ({ signal }) => api.participants(code, undefined, { signal }),
    enabled,
  });

  const pageState = loadStateFromQuery(page);
  const participants = mapLoad(pageState, (body) => body.items ?? []);
  const hasMore = page.data?.has_next ?? false;

  const settle = useCallback(
    (participantId: string): void => {
      dispatch({ type: "settle", participantId });
      void queryClient.invalidateQueries({
        queryKey: roomQueryKeys.participants(code),
      });
    },
    [queryClient, code]
  );

  const admitMutation = useMutation({
    mutationFn: (participantId: string) =>
      api.admitParticipant(code, { participant_id: participantId }),
    onSettled: (_data, _error, participantId) => {
      setPending(undefined);
      settle(participantId);
    },
  });

  const denyMutation = useMutation({
    mutationFn: (participantId: string) =>
      api.denyParticipant(code, { participant_id: participantId }),
    onSettled: (_data, _error, participantId) => {
      setPending(undefined);
      settle(participantId);
    },
  });

  const verdictPending = admitMutation.isPending || denyMutation.isPending;
  const verdictGate: ActionAvailability =
    options.isHost === false
      ? actionBlocked(VIDEO_I18N_KEYS.lobbyBlockedNotHost)
      : verdictPending
        ? actionBlocked(VIDEO_I18N_KEYS.lobbyBlockedPending)
        : actionAvailable();

  const admit = useCallback(
    (participantId: string): void => {
      setPending(participantId);
      admitMutation.mutate(participantId);
    },
    [admitMutation]
  );
  const deny = useCallback(
    (participantId: string): void => {
      setPending(participantId);
      denyMutation.mutate(participantId);
    },
    [denyMutation]
  );

  const apply = useCallback((event: LobbyEvent): void => {
    dispatch({ type: "event", event });
  }, []);

  const refresh = useCallback((): void => {
    void page.refetch();
  }, [page]);

  const waiting = useMemo(
    () =>
      mapLoad(participants, (rows): readonly WaitingPerson[] => {
        const known = new Set(rows.map((row) => row.id));
        const fromRest = waitingParticipants(rows)
          .filter((row) => !overlay.settled.has(row.id))
          .map(
            (row): WaitingPerson => ({
              participantId: row.id,
              userId: row.user_id,
              name: overlay.names.get(row.id),
              live: false,
            })
          );
        const fromSocket = overlay.arrivals
          .filter((a) => !known.has(a.participantId))
          .map(
            (a): WaitingPerson => ({
              participantId: a.participantId,
              userId: a.userId,
              name: a.userName,
              live: true,
            })
          );
        return [...fromRest, ...fromSocket];
      }),
    [participants, overlay]
  );

  const present = useMemo(
    () => mapLoad(participants, presentParticipants),
    [participants]
  );

  const verdictError = admitMutation.error ?? denyMutation.error ?? undefined;

  return {
    participants,
    waiting,
    present,
    hasMore,
    refresh,
    apply,
    admit,
    deny,
    verdictGate,
    pendingParticipantId,
    error:
      verdictError !== undefined && !isParticipantNotFound(verdictError)
        ? verdictError
        : undefined,
  };
}

/**
 * A lobby bag over rows a caller already holds — the seam a demo and a host
 * with its own transport render through, and the reason the panel below is
 * testable without a socket or a query client.
 */
export function staticLobbyBag(
  rows: readonly ParticipantResponse[],
  overrides: Partial<LobbyBag> = {}
): LobbyBag {
  const participants = loadReady(rows);
  return {
    participants,
    waiting: loadReady(
      waitingParticipants(rows).map(
        (row): WaitingPerson => ({
          participantId: row.id,
          userId: row.user_id,
          name: undefined,
          live: false,
        })
      )
    ),
    present: loadReady(presentParticipants(rows)),
    hasMore: false,
    refresh: () => undefined,
    apply: () => undefined,
    admit: () => undefined,
    deny: () => undefined,
    verdictGate: actionAvailable(),
    pendingParticipantId: undefined,
    error: undefined,
    ...overrides,
  };
}

/**
 * A meeting bag over an outcome a caller already holds — the seam a demo, a
 * test and a host with its own transport render through. The four states
 * `<MeetingPane>` has (nothing asked / waiting / admitted / denied) are all
 * spellable here without a server, which is why the showcase can photograph
 * every one of them.
 */
export function staticMeetingBag(
  outcome: JoinOutcome | undefined,
  overrides: Partial<MeetingBag> = {}
): MeetingBag {
  return {
    outcome,
    room: outcome?.room,
    token: outcome?.kind === "admitted" ? outcome.token : undefined,
    participantId: outcome?.participant?.id,
    error: undefined,
    start: () => undefined,
    join: () => undefined,
    leave: () => undefined,
    startGate: actionAvailable(),
    joinGate: actionAvailable(),
    applyLobbyEvent: () => undefined,
    ...overrides,
  };
}
