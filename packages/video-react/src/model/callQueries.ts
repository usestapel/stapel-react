/**
 * The call's state, headless: one live call, and the four verbs that move it.
 *
 * This is the data half of the global ring. It opens no socket and knows
 * nothing about overlays, ringtones or tabs — those are `CallsProvider`'s,
 * which composes this with the transport. Split that way so a host on its own
 * transport, or with no socket at all, still gets a working call surface: the
 * REST reads below are complete on their own, just later.
 *
 * ── `GET /calls/active` is the repair, not a convenience ──────────────────
 *
 * The ring stream is best-effort by contract. A lost `call.incoming` is a call
 * that never rang; a lost `call.ended` is a ring that never stops. Both are
 * repaired by re-reading this one endpoint, which is why {@link useActiveCall}
 * exposes `refetch` and why the provider calls it on mount AND on every
 * realtime reconnect. Without that the socket's "best effort" is just a
 * defect with a nicer name.
 *
 * ── The client mirrors the server's ring timeout ──────────────────────────
 *
 * A ringing call past its `expires_at` is reported as absent here, before any
 * frame arrives to say so. The frame is the confirmation; waiting for it shows
 * a ring for a call that is already over every time one is dropped.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  actionAvailable,
  actionBlocked,
  useActiveSessionReady,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type {
  CallCreateRequest,
  CallResponse,
  CallTokenResponse,
} from "../api/types.js";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { useVideoApi, useVideoRuntime } from "./context.js";
import { callQueryKeys } from "./queryKeys.js";
import { isCallLive, isRingExpired } from "./calls.js";

/** How often the active-call read refreshes itself when nothing is live.
 * Long, because the socket is the fast path and this is the safety net; a
 * short interval here would be the poll the socket exists to replace. */
const IDLE_REFETCH_MS = 60_000;

export interface UseActiveCallOptions {
  /** Turn the read off entirely — for a host that mounts the provider on a
   * page where calling is not offered. */
  readonly enabled?: boolean;
}

export interface ActiveCallBag {
  /** The live call, or `undefined`. A call whose ring has run out by this
   * browser's clock reads as `undefined` here even while the server's row
   * still says `ringing`, so an overlay never outlives its call. */
  readonly call: CallResponse | undefined;
  /** True while the first read is in flight — distinct from "no call", so a
   * screen does not flash "nobody is calling" before it knows. */
  readonly loading: boolean;
  readonly error: unknown;
  /** Re-read. The repair for a dropped frame; the provider wires it to mount
   * and to every realtime reconnect. */
  readonly refetch: () => void;
  /** Replace what this hook holds without a round trip — for a verb that
   * already answered with the row (accept, decline, hangup). */
  readonly setCall: (call: CallResponse | null) => void;
}

/** The caller's own live call. */
export function useActiveCall(options?: UseActiveCallOptions): ActiveCallBag {
  const api = useVideoApi();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();
  const enabled = (options?.enabled ?? true) && sessionReady;

  const query = useQuery({
    queryKey: callQueryKeys.active,
    queryFn: ({ signal }) => api.activeCall({ signal }),
    enabled,
    refetchInterval: IDLE_REFETCH_MS,
    // A ring is worth a round trip on every remount: the alternative is an
    // overlay that appears seconds late because a cached "no call" was fresh.
    staleTime: 0,
  });

  const raw = query.data?.call ?? undefined;

  // The clock half of the server's ring timeout, applied on READ. `useState`
  // + an interval rather than a render-time comparison, because a component
  // that computes expiry during render never re-renders to act on it.
  const [, tick] = useState(0);
  useEffect(() => {
    if (raw === null || raw === undefined || raw.state !== "ringing") return undefined;
    const timer = setInterval(() => {
      tick((n) => n + 1);
    }, 500);
    return () => {
      clearInterval(timer);
    };
  }, [raw]);

  const call = useMemo(() => {
    if (raw === null || raw === undefined) return undefined;
    if (!isCallLive(raw)) return undefined;
    if (isRingExpired(raw)) return undefined;
    return raw;
  }, [raw]);

  const setCall = useCallback(
    (next: CallResponse | null): void => {
      queryClient.setQueryData(callQueryKeys.active, { call: next });
    },
    [queryClient]
  );

  const refetch = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: callQueryKeys.active });
  }, [queryClient]);

  return {
    call,
    loading: query.isPending && enabled,
    error: query.error,
    refetch,
    setCall,
  };
}

// ── the four verbs ─────────────────────────────────────────────────────────

export interface CallActionsBag {
  /** Ring somebody. Answers the CALLER's own token and url. */
  readonly place: (request: CallCreateRequest) => Promise<CallTokenResponse>;
  /** Pick up. Answers the CALLEE's own token and url — which exists nowhere
   * before this call, deliberately: the ring frame carries no credential. */
  readonly accept: (callId: string) => Promise<CallTokenResponse>;
  /** Refuse. */
  readonly decline: (callId: string) => Promise<CallResponse>;
  /** End it, from either side and either live state. */
  readonly hangup: (callId: string) => Promise<CallResponse>;
  /** A fresh media grant for a call in progress — what a manual Reconnect
   * uses instead of replaying an expired one. */
  readonly remint: (callId: string) => Promise<{ token: string; url: string }>;
  /** Blocked while any of the above is in flight, so a double tap cannot
   * place two calls or accept twice. */
  readonly gate: ActionAvailability;
  /** The last failure. A refusal is data here, not a thrown surprise: the
   * caller branches with `isCallBusy` / `isCallNotAllowed` / … */
  readonly error: unknown;
}

/** The verbs, bound to the runtime's client session id. */
export function useCallActions(): CallActionsBag {
  const api = useVideoApi();
  const runtime = useVideoRuntime();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(undefined);

  const session =
    runtime.clientSessionId !== undefined
      ? { client_session_id: runtime.clientSessionId }
      : {};

  const write = useCallback(
    (next: CallResponse | null): void => {
      queryClient.setQueryData(callQueryKeys.active, { call: next });
    },
    [queryClient]
  );

  const place = useMutation({
    mutationFn: (request: CallCreateRequest) =>
      api.createCall({ ...session, ...request }),
    onSuccess: (answer) => {
      setError(undefined);
      write(answer.call);
    },
    onError: setError,
  });

  const accept = useMutation({
    mutationFn: (callId: string) => api.acceptCall(callId, session),
    onSuccess: (answer) => {
      setError(undefined);
      write(answer.call);
    },
    onError: setError,
  });

  const decline = useMutation({
    mutationFn: (callId: string) => api.declineCall(callId),
    onSuccess: () => {
      setError(undefined);
      write(null);
    },
    onError: setError,
  });

  const hangup = useMutation({
    mutationFn: (callId: string) => api.hangupCall(callId),
    onSuccess: () => {
      setError(undefined);
      write(null);
    },
    onError: setError,
  });

  const remint = useMutation({
    mutationFn: (callId: string) => api.callToken(callId, session),
    onError: setError,
  });

  const busy =
    place.isPending ||
    accept.isPending ||
    decline.isPending ||
    hangup.isPending ||
    remint.isPending;

  return {
    place: (request) => place.mutateAsync(request),
    accept: (callId) => accept.mutateAsync(callId),
    decline: (callId) => decline.mutateAsync(callId),
    hangup: (callId) => hangup.mutateAsync(callId),
    remint: async (callId) => {
      const answer = await remint.mutateAsync(callId);
      return { token: answer.token, url: answer.url };
    },
    gate: busy
      ? actionBlocked(VIDEO_I18N_KEYS.callBlockedPending)
      : actionAvailable(),
    error,
  };
}
