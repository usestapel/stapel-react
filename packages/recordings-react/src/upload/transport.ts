/**
 * The six server calls a chunked upload needs, behind one interface, plus an
 * adapter for any openapi-fetch-style client (`client.GET/POST/DELETE`
 * returning `{data, error, response}`). Framework-free: no React, no antd, no
 * runtime import from `@stapel/core` — only types from the generated contract.
 */
import type { components } from "../api/generated/schema.js";

type S = components["schemas"];
export type UploadLookup = S["UploadLookupDTO"];
export type MultipartStartRequest = S["MultipartStartRequest"];
export type MultipartStart = S["MultipartStartDTO"];
export type PartHash = S["PartHash"];
export type MultipartMint = S["MultipartMintDTO"];
export type MultipartManifest = S["MultipartManifestDTO"];
export type MultipartPartUrl = S["MultipartPartURLDTO"];
export type StoredPart = S["StoredPartDTO"];
export type CompletedPart = S["CompletedPart"];
export type UploadedRecording = S["RecordingDTO"];

/** Error keys the chunked flow reacts to. */
export const UPLOAD_ERROR_KEYS = {
  partsMissing: "error.409.recording_upload_parts_missing",
  partMismatch: "error.409.recording_upload_part_mismatch",
  expired: "error.409.recording_upload_expired",
  invalidState: "error.409.recording_invalid_state",
  partsInvalid: "error.400.recording_multipart_parts_invalid",
  unverifiable: "error.503.recording_upload_unverifiable",
} as const;

/**
 * A failed server call. `status` is `0` for a transport fault (no response).
 * `code` is the envelope's `localizable_error` when the server sent one.
 */
export class ChunkedTransportError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly params: Readonly<Record<string, unknown>>;

  constructor(
    status: number,
    code: string | undefined,
    params: Record<string, unknown> = {},
    options?: { cause?: unknown }
  ) {
    super(code ?? (status === 0 ? "transport error" : `HTTP ${status}`), options);
    this.name = "ChunkedTransportError";
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

export interface ChunkedUploadTransport {
  lookup(
    query: { readonly fingerprint: string; readonly workspaceId: string },
    signal?: AbortSignal
  ): Promise<UploadLookup>;
  start(
    recordingId: string,
    body: MultipartStartRequest,
    signal?: AbortSignal
  ): Promise<MultipartStart>;
  mint(
    recordingId: string,
    uploadId: string,
    parts: readonly PartHash[],
    signal?: AbortSignal
  ): Promise<MultipartMint>;
  manifest(
    recordingId: string,
    uploadId: string,
    signal?: AbortSignal
  ): Promise<MultipartManifest>;
  complete(
    recordingId: string,
    uploadId: string,
    parts: readonly CompletedPart[],
    signal?: AbortSignal
  ): Promise<UploadedRecording>;
  abort(recordingId: string, uploadId: string, signal?: AbortSignal): Promise<void>;
}

/** What `createChunkedTransport` needs from a client. */
export interface FetchLikeResult {
  readonly data?: unknown;
  readonly error?: unknown;
  readonly response?: { readonly status: number };
}
export interface FetchLikeInit {
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
}
export interface FetchLikeClient {
  GET(path: string, init?: FetchLikeInit): Promise<FetchLikeResult>;
  POST(path: string, init?: FetchLikeInit): Promise<FetchLikeResult>;
  DELETE(path: string, init?: FetchLikeInit): Promise<FetchLikeResult>;
}

export interface ChunkedTransportOptions {
  /** Path prefix the module is mounted under. Default `/recordings/api/v1/`. */
  readonly prefix?: string;
  /** Extra headers on mutating calls. Default `X-Requested-With: XMLHttpRequest`. */
  readonly mutatingHeaders?: Record<string, string>;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : undefined;
}

/** Fold a thrown value or an error body into a ChunkedTransportError. */
export function toTransportError(
  value: unknown,
  status?: number
): ChunkedTransportError {
  if (value instanceof ChunkedTransportError) return value;
  const rec = asRecord(value);
  const code =
    (typeof rec?.["localizable_error"] === "string" && rec["localizable_error"]) ||
    (typeof rec?.["code"] === "string" && rec["code"]) ||
    undefined;
  const params = asRecord(rec?.["params"]) ?? {};
  const st =
    status ??
    (typeof rec?.["status"] === "number" ? rec["status"] : undefined) ??
    (code ? Number(/^error\.(\d{3})\./.exec(code)?.[1] ?? 0) : 0);
  return new ChunkedTransportError(st, code || undefined, params, { cause: value });
}

/**
 * Adapter for an openapi-fetch-style client. Path parameters and query are
 * substituted here, so the host only casts the path type.
 */
export function createChunkedTransport(
  client: FetchLikeClient,
  options: ChunkedTransportOptions = {}
): ChunkedUploadTransport {
  const raw = options.prefix ?? "/recordings/api/v1/";
  const prefix = raw.endsWith("/") ? raw : `${raw}/`;
  const mutating = options.mutatingHeaders ?? { "X-Requested-With": "XMLHttpRequest" };
  const enc = encodeURIComponent;
  const mp = (rid: string, uid: string): string =>
    `${prefix}recordings/${enc(rid)}/multipart/${enc(uid)}`;

  async function call<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    init: FetchLikeInit
  ): Promise<T> {
    let res: FetchLikeResult;
    try {
      res = await client[method](path, init);
    } catch (e) {
      // An abort is not a transport fault: let the caller see it as-is.
      if (init.signal?.aborted) throw init.signal.reason ?? e;
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw toTransportError(e);
    }
    const status = res.response?.status ?? 0;
    if (res.error !== undefined || status >= 400 || status === 0) {
      throw toTransportError(res.error, status);
    }
    return res.data as T;
  }

  const init = (
    signal: AbortSignal | undefined,
    body?: unknown,
    headers?: Record<string, string>
  ): FetchLikeInit => ({
    ...(body !== undefined ? { body } : {}),
    ...(headers ? { headers } : {}),
    ...(signal ? { signal } : {}),
  });

  return {
    lookup: ({ fingerprint, workspaceId }, signal) =>
      call<UploadLookup>(
        "GET",
        `${prefix}recordings/uploads/lookup?fingerprint=${enc(fingerprint)}&workspace_id=${enc(workspaceId)}`,
        init(signal)
      ),
    start: (rid, body, signal) =>
      call<MultipartStart>(
        "POST",
        `${prefix}recordings/${enc(rid)}/multipart`,
        init(signal, body, mutating)
      ),
    mint: (rid, uid, parts, signal) =>
      call<MultipartMint>("POST", `${mp(rid, uid)}/parts`, init(signal, { parts }, mutating)),
    manifest: (rid, uid, signal) =>
      call<MultipartManifest>("GET", `${mp(rid, uid)}/parts?mint=none`, init(signal)),
    complete: (rid, uid, parts, signal) =>
      call<UploadedRecording>(
        "POST",
        `${mp(rid, uid)}/complete`,
        init(signal, { parts }, mutating)
      ),
    abort: async (rid, uid, signal) => {
      await call<unknown>("DELETE", `${mp(rid, uid)}/abort`, init(signal, undefined, mutating));
    },
  };
}

/** Does this failure carry one of these upload error keys? */
export function hasUploadErrorCode(value: unknown, ...codes: string[]): boolean {
  return (
    value instanceof ChunkedTransportError && value.code !== undefined && codes.includes(value.code)
  );
}

/** A named param of an upload failure's envelope. */
export function uploadErrorParam(value: unknown, key: string): unknown {
  return value instanceof ChunkedTransportError ? value.params[key] : undefined;
}

/** HTTP status of a transport failure (`0` = no response); else undefined. */
export function uploadErrorStatus(value: unknown): number | undefined {
  return value instanceof ChunkedTransportError ? value.status : undefined;
}
