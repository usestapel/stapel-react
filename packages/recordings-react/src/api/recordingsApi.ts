import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  CreateRecordingRequest,
  CreateRecordingResponse,
  FinalizeUploadRequest,
  Job,
  MediaUrl,
  MediaUrlOptions,
  Recording,
  RecordingListParams,
  ShareAccessOptions,
  ShareUnlock,
  SharedRecording,
  TranscriptPage,
  TranscriptParams,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors the other pairs):
 * the simplest SPA rule is to always send `X-Requested-With: XMLHttpRequest` on
 * mutating requests. Header-token clients ignore it; it is harmless there, so
 * every mutation carries it. stapel-recordings authenticates via the
 * `stapel_jwt` cookie (see the contract's `JWTCookieAuth`), so a browser host
 * must build its runtime with `credentials: "include"` for a cross-origin API.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

/**
 * The header a client presents after passing a passcode-protected share's
 * unlock endpoint. Named once here because two operations send it.
 */
export const SHARE_UNLOCK_HEADER = "X-Share-Unlock-Token";

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/** The unlock header, when a token was handed to us; `{}` otherwise. */
function shareHeaders(options?: ShareAccessOptions): Record<string, string> {
  return options?.unlockToken !== undefined
    ? { [SHARE_UNLOCK_HEADER]: options.unlockToken }
    : {};
}

/**
 * The pair's typed operation surface — one method per stapel-recordings endpoint
 * a JS client may call, bound to the injected {@link StapelClient} (the
 * per-module override seam of frontend-standard §7.2). Paths are relative to the
 * runtime's `baseUrl` (e.g. `/recordings/api/v1/`).
 *
 * These operations are hand-authored here — the ONE legal home of path strings
 * (`stapel/no-string-paths` §2.3 carve-out) — until gen-api v2 emits typed ops
 * from operationIds (task `core-typed-ops`). The single-PUT media upload targets
 * the session's presigned storage URL (a different origin, no JSON body), so it
 * is NOT a client operation — see `uploadRecordingBlob` in `api/extensions.ts`.
 *
 * The three `/shares/…` operations are ANONYMOUS by design: the link token in
 * the path is the credential, there is no `stapel_jwt`, and a host may reach
 * them with a client that has no session at all.
 */
export interface RecordingsApi {
  readonly client: StapelClient;

  /**
   * List recordings: what `RECORDING_POLICY` makes visible to the caller
   * (default their own), narrowed to one workspace with `workspaceId` (a
   * non-member gets `error.403.recording_workspace_forbidden`) or to a single
   * recording with `resourceKey`. The workspace listing goes through the same
   * object policy as the per-recording endpoints, so it never lists a recording
   * those would refuse — `?workspace_id=` means "what the policy makes visible
   * inside it", not "everything in it".
   */
  listRecordings(params?: RecordingListParams): Promise<Recording[]>;
  /**
   * Create a recording and open its single-PUT upload session; resolves to the
   * 201 body — the {@link Recording} plus the {@link UploadSession} to PUT the
   * media at. Finalize with {@link RecordingsApi.finalizeUpload} once uploaded.
   */
  createRecording(body: CreateRecordingRequest): Promise<CreateRecordingResponse>;
  /** Fetch a single recording by id. */
  getRecording(recordingId: string): Promise<Recording>;
  /**
   * Finalize the upload and enqueue the transcription pipeline; resolves to the
   * updated recording. `file_size_bytes` is optional (the backend can size the
   * stored object itself). Fails `error.400.recording_invalid_state` if the
   * recording is not awaiting finalize.
   */
  finalizeUpload(
    recordingId: string,
    body?: FinalizeUploadRequest
  ): Promise<Recording>;
  /**
   * Mint a short-lived authorized URL to the recording's media object. **This
   * is the only way to reach the bytes** — the bucket is deliberately not
   * anonymously readable (audit STORE-01). Honour `expires_in`: re-mint before
   * the URL dies rather than retrying a dead link. `409
   * recording_media_not_stored` and `503 recording_media_unavailable` are
   * distinct refusals, not one generic failure.
   */
  getMediaUrl(recordingId: string, options?: MediaUrlOptions): Promise<MediaUrl>;
  /**
   * Read the OWNER's own speaker-attributed transcript, anchor-paginated over
   * `sequence_num` (backend 0.20.0 — before it, segments left the module only
   * through a public share link). A recording with no segments yet answers
   * `200` with an empty page: "not transcribed yet" is a normal stage.
   */
  getTranscript(
    recordingId: string,
    params?: TranscriptParams
  ): Promise<TranscriptPage>;
  /**
   * Re-run the whole pipeline for a finished recording (`completed → queued`) —
   * a second transcription and a second bill. Allowed only from `completed`;
   * any other status answers `409 recording_invalid_state`. A policy that
   * refuses with a `PolicyDecision` names its OWN status and key (402 for an
   * unpaid balance), so a client that branches only on 404 tells a paying user
   * their recording does not exist.
   */
  reprocess(recordingId: string): Promise<Recording>;
  /**
   * Regenerate ONE recording's summary — no STT, no diarization. The cheap
   * verb for "the transcript is right, only the summary is stale". `202` with a
   * {@link Job}: accepted, not finished. Idempotent — a second POST while one
   * is in flight answers with the SAME job, so a double-clicked button costs
   * one summary.
   */
  resummarize(recordingId: string): Promise<Job>;
  /**
   * Read a recording through a public share link. Anonymous: the `linkToken` IS
   * the credential. A passcode-protected share needs the verified unlock token
   * from {@link RecordingsApi.unlockShare} in `options`.
   */
  getSharedRecording(
    linkToken: string,
    options?: ShareAccessOptions
  ): Promise<SharedRecording>;
  /**
   * Media URL for a share link that carries the `media` grant (a `view`-only
   * share gets 403). The TTL is shorter than the owner's by design — this one
   * leaves the trust boundary.
   */
  getSharedMediaUrl(
    linkToken: string,
    options?: ShareAccessOptions & MediaUrlOptions
  ): Promise<MediaUrl>;
  /**
   * Exchange a share's passcode for a time-limited unlock token. Guessing is
   * bounded by a persisted lockout — `429 share_unlock_throttled` is a named
   * arm, not a generic error.
   */
  unlockShare(linkToken: string, passcode: string): Promise<ShareUnlock>;
}

export function createRecordingsApi(client: StapelClient): RecordingsApi {
  const recordingPath = (recordingId: string): string =>
    `/recordings/${encodeURIComponent(recordingId)}`;
  const sharePath = (linkToken: string): string =>
    `/shares/${encodeURIComponent(linkToken)}`;

  return {
    client,

    listRecordings: (params) => {
      const query: Record<string, string> = {};
      if (params?.workspaceId !== undefined) {
        query.workspace_id = params.workspaceId;
      }
      if (params?.resourceKey !== undefined) {
        query.resource_key = params.resourceKey;
      }
      return client.get("/recordings", { query });
    },

    createRecording: (body) => client.post("/recordings", body, mutating()),

    getRecording: (recordingId) => client.get(recordingPath(recordingId)),

    finalizeUpload: (recordingId, body) =>
      client.post(`${recordingPath(recordingId)}/finalize`, body ?? {}, mutating()),

    getMediaUrl: (recordingId, options) =>
      client.get(`${recordingPath(recordingId)}/media`, {
        query: options?.redirect === true ? { redirect: 1 } : {},
      }),

    getTranscript: (recordingId, params) => {
      const query: Record<string, string | number> = {};
      if (params?.anchor !== undefined) query.anchor = params.anchor;
      if (params?.direction !== undefined) query.direction = params.direction;
      if (params?.limit !== undefined) query.limit = params.limit;
      return client.get(`${recordingPath(recordingId)}/transcript`, { query });
    },

    reprocess: (recordingId) =>
      client.post(`${recordingPath(recordingId)}/reprocess`, {}, mutating()),

    resummarize: (recordingId) =>
      client.post(`${recordingPath(recordingId)}/resummarize`, {}, mutating()),

    getSharedRecording: (linkToken, options) =>
      client.get(sharePath(linkToken), { headers: shareHeaders(options) }),

    getSharedMediaUrl: (linkToken, options) =>
      client.get(`${sharePath(linkToken)}/media`, {
        headers: shareHeaders(options),
        query: options?.redirect === true ? { redirect: 1 } : {},
      }),

    unlockShare: (linkToken, passcode) =>
      client.post(`${sharePath(linkToken)}/unlock`, { passcode }, mutating()),
  };
}
