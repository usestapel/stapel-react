import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  CreateRecordingRequest,
  CreateRecordingResponse,
  FinalizeUploadRequest,
  Recording,
  RecordingListParams,
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

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/**
 * The pair's typed operation surface — one method per stapel-recordings endpoint
 * a JS client may call, bound to the injected {@link StapelClient} (the
 * per-module override seam of frontend-standard §7.2). Paths are relative to the
 * runtime's `baseUrl` (e.g. `/recordings/api/`).
 *
 * These operations are hand-authored here — the ONE legal home of path strings
 * (`stapel/no-string-paths` §2.3 carve-out) — until gen-api v2 emits typed ops
 * from operationIds (task `core-typed-ops`). The single-PUT media upload targets
 * the session's presigned storage URL (a different origin, no JSON body), so it
 * is NOT a client operation — see `uploadRecordingBlob` in `api/extensions.ts`.
 */
export interface RecordingsApi {
  readonly client: StapelClient;

  /**
   * List recordings: the caller's own by default, or every recording in a
   * workspace they are a member of when `workspaceId` is passed (a non-member
   * gets `error.403.recording_workspace_forbidden`).
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
}

export function createRecordingsApi(client: StapelClient): RecordingsApi {
  const recordingPath = (recordingId: string): string =>
    `/recordings/${encodeURIComponent(recordingId)}`;

  return {
    client,

    listRecordings: (params) => {
      const query: Record<string, string> = {};
      if (params?.workspaceId !== undefined) {
        query.workspace_id = params.workspaceId;
      }
      return client.get("/recordings", { query });
    },

    createRecording: (body) => client.post("/recordings", body, mutating()),

    getRecording: (recordingId) => client.get(recordingPath(recordingId)),

    finalizeUpload: (recordingId, body) =>
      client.post(`${recordingPath(recordingId)}/finalize`, body ?? {}, mutating()),
  };
}
