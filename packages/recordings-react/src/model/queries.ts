import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  MediaUrl,
  Recording,
  RecordingListParams,
  ShareAccessOptions,
  SharedRecording,
  TranscriptPage,
  TranscriptParams,
} from "../api/types.js";
import { useRecordingsApi } from "./context.js";
import { mediaRefreshMs, pollIntervalMs } from "./polling.js";
import { recordingsQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the recordings API (frontend-standard §2 — read hooks).
 * Staleness follows core's query defaults; override per call site via a page
 * that needs fresher data. Keys are namespaced (see `recordingsQueryKeys`).
 *
 * POLLING is read off the payload, never guessed — see `model/polling.ts`.
 * Every hook below whose resource can be mid-pipeline schedules its next read
 * from `poll_after_seconds` and stops the moment the field is absent.
 */

/**
 * Recordings newest-first as the backend orders them — what `RECORDING_POLICY`
 * makes visible to the caller (default: their own). `params.workspaceId`
 * narrows that to one workspace they are a member of (a non-member read fails
 * `error.403.recording_workspace_forbidden`); what comes back INSIDE the
 * workspace is still policy-filtered, so this is not "every recording in the
 * workspace" unless the deployment set `WORKSPACE_LISTING_MEMBERS_SEE_ALL`.
 *
 * Gated on {@link useActiveSessionReady} (owner-diagnosed live incident,
 * 2026-07-17): this top-level list hook has no natural `enabled` condition
 * of its own — exactly the shape that raced a still-bootstrapping session
 * and read a live one as "expired". Zero manual `enabled` wiring needed at
 * the call site by design.
 */
export function useRecordings(
  params?: RecordingListParams
): UseQueryResult<Recording[], StapelApiError> {
  const api = useRecordingsApi();
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: recordingsQueryKeys.list(p),
    queryFn: () => api.listRecordings(p),
    enabled: sessionReady,
    // A list holding one processing recording is itself stale on a schedule.
    // The interval is the SHORTEST any row asks for, and `false` the moment no
    // row is mid-pipeline — a finished list stops costing requests.
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (rows === undefined) return false;
      const hints = rows
        .map((recording) => pollIntervalMs(recording))
        .filter((ms): ms is number => ms !== false);
      return hints.length === 0 ? false : Math.min(...hints);
    },
  });
}

/**
 * A single recording by id — the read behind a detail view, which POLLS a
 * processing recording until its transcription outputs land. The interval is
 * the payload's own `poll_after_seconds`; when the backend stops sending it
 * (terminal, or waiting on the client's upload) the polling stops with it.
 *
 * `enabled` is gated on a non-empty id (so the hook stays inert until a
 * selection exists) AND session readiness — an id can be known synchronously
 * (e.g. a URL param) before the session has finished bootstrapping.
 */
export function useRecording(
  recordingId: string
): UseQueryResult<Recording, StapelApiError> {
  const api = useRecordingsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: recordingsQueryKeys.detail(recordingId),
    queryFn: () => api.getRecording(recordingId),
    enabled: sessionReady && recordingId.length > 0,
    refetchInterval: (query) => pollIntervalMs(query.state.data),
  });
}

/**
 * A short-lived authorized URL to the recording's media object — the ONLY path
 * to the bytes (the bucket is deliberately not anonymously readable, audit
 * STORE-01).
 *
 * Re-mints itself at 80 % of `expires_in` (see `mediaRefreshMs`) so a player
 * never holds a dead link mid-listen, and does not retry on failure: `409
 * recording_media_not_stored` and `503 recording_media_unavailable` are stable
 * refusals, and hammering them turns a named arm into a spinner.
 */
export function useRecordingMedia(
  recordingId: string,
  options?: { readonly enabled?: boolean }
): UseQueryResult<MediaUrl, StapelApiError> {
  const api = useRecordingsApi();
  const sessionReady = useActiveSessionReady();
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: recordingsQueryKeys.media(recordingId),
    queryFn: () => api.getMediaUrl(recordingId),
    enabled: sessionReady && enabled && recordingId.length > 0,
    retry: false,
    refetchInterval: (query) => mediaRefreshMs(query.state.data?.expires_in),
  });
}

/**
 * The owner's own speaker-attributed transcript, page by page (backend 0.20.0).
 *
 * Anchor pagination, not offset: a meeting-length transcript is thousands of
 * segments and the pipeline may still be appending to the end, so pages are
 * anchored on `sequence_num` and stay stable while it does. `fetchNextPage`
 * walks forward in reading order; `hasNextPage` is the wire's `has_next`, not
 * a guess from page length.
 *
 * Polls while the page says the pipeline is still working — a transcript that
 * fills in while you watch is the point.
 */
export function useTranscript(
  recordingId: string,
  params?: TranscriptParams,
  options?: { readonly enabled?: boolean }
): UseInfiniteQueryResult<
  InfiniteData<TranscriptPage, number | undefined>,
  StapelApiError
> {
  const api = useRecordingsApi();
  const sessionReady = useActiveSessionReady();
  const enabled = options?.enabled ?? true;
  const p = params ?? {};
  return useInfiniteQuery({
    queryKey: recordingsQueryKeys.transcript(recordingId, p),
    queryFn: ({ pageParam }) =>
      api.getTranscript(recordingId, {
        ...p,
        ...(pageParam !== undefined ? { anchor: pageParam } : {}),
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_next && lastPage.next_anchor !== null
        ? Number(lastPage.next_anchor)
        : undefined,
    enabled: sessionReady && enabled && recordingId.length > 0,
    refetchInterval: (query) => {
      const pages = query.state.data?.pages;
      if (pages === undefined) return false;
      const last = pages[pages.length - 1];
      return pollIntervalMs(last as { poll_after_seconds?: number | null });
    },
  });
}

/**
 * A recording through a public share link.
 *
 * **Anonymous by design** — no `useActiveSessionReady` gate, because there is
 * no session to wait for: the link token in the path IS the credential and the
 * page must work for a visitor who has never signed in. `unlockToken` is the
 * verified token a passcode-protected share hands back; while the share needs
 * one and none is held, the read fails `401 share_passcode_required`, which is
 * the gate's cue, not an error to swallow.
 */
export function useSharedRecording(
  linkToken: string,
  options?: ShareAccessOptions & { readonly enabled?: boolean }
): UseQueryResult<SharedRecording, StapelApiError> {
  const api = useRecordingsApi();
  const enabled = options?.enabled ?? true;
  const unlockToken = options?.unlockToken;
  return useQuery({
    queryKey: recordingsQueryKeys.share(linkToken, unlockToken ?? null),
    queryFn: () =>
      api.getSharedRecording(
        linkToken,
        unlockToken !== undefined ? { unlockToken } : undefined
      ),
    enabled: enabled && linkToken.length > 0,
    retry: false,
  });
}

/**
 * Media URL for a share link carrying the `media` grant. Shorter TTL than the
 * owner's by design — this URL leaves the trust boundary — so it refreshes on
 * its own `expires_in`, same rule, different number. Anonymous, like its
 * sibling above.
 */
export function useSharedMedia(
  linkToken: string,
  options?: ShareAccessOptions & { readonly enabled?: boolean }
): UseQueryResult<MediaUrl, StapelApiError> {
  const api = useRecordingsApi();
  const enabled = options?.enabled ?? true;
  const unlockToken = options?.unlockToken;
  return useQuery({
    queryKey: recordingsQueryKeys.shareMedia(linkToken, unlockToken ?? null),
    queryFn: () =>
      api.getSharedMediaUrl(
        linkToken,
        unlockToken !== undefined ? { unlockToken } : {}
      ),
    enabled: enabled && linkToken.length > 0,
    retry: false,
    refetchInterval: (query) => mediaRefreshMs(query.state.data?.expires_in),
  });
}
