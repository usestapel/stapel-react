/**
 * Resumable, checksum-verified multipart upload (fingerprint sessions).
 *
 * The server's manifest (built from the store's own ListParts) is the source
 * of truth for what is already uploaded; this module only sends what it says
 * is missing. Every part URL is minted bound to that part's SHA-256, so the
 * store refuses corrupted bytes and the refused part is simply sent again.
 */
import { partCount, partRange, sha256Hex } from "./fingerprint.js";
import {
  ChunkedTransportError,
  UPLOAD_ERROR_KEYS,
  toTransportError,
  type ChunkedUploadTransport,
  type CompletedPart,
  type MultipartPartUrl,
  type StoredPart,
  type UploadedRecording,
  hasUploadErrorCode,
  uploadErrorParam,
  uploadErrorStatus,
} from "./transport.js";
import { xhrPutPart } from "./storage-client.js";

const MINT_BATCH = 100;

export interface ChunkedUploadProgress {
  /** Bytes the store holds or is receiving, across all parts. */
  readonly loaded: number;
  readonly total: number;
  readonly partsDone: number;
  readonly partsTotal: number;
}

/** The upload stopped; the session stays open and can be resumed. */
export class UploadInterruptedError extends Error {
  readonly partsDone: number;
  readonly partsTotal: number;
  readonly uploadId: string | undefined;

  constructor(
    partsDone: number,
    partsTotal: number,
    uploadId: string | undefined,
    options?: { cause?: unknown }
  ) {
    super(`upload interrupted after ${partsDone}/${partsTotal} parts`, options);
    this.name = "UploadInterruptedError";
    this.partsDone = partsDone;
    this.partsTotal = partsTotal;
    this.uploadId = uploadId;
  }
}

export type UploadRestartReason =
  /** The session expired server-side (`error.409.recording_upload_expired`). */
  | "expired"
  /** The session was cut with another part size / part count. */
  | "layout_mismatch"
  /** The store's checksums do not add up to this fingerprint. */
  | "fingerprint_mismatch"
  /** The source bytes no longer hash to the given part hashes. */
  | "source_changed";

/**
 * Resuming cannot work: start a new session (and, for `source_changed` or
 * `fingerprint_mismatch`, re-hash the file and drop any cached hashes).
 */
export class UploadRestartRequiredError extends Error {
  readonly reason: UploadRestartReason;
  readonly partNumber: number | undefined;

  constructor(reason: UploadRestartReason, partNumber?: number, options?: { cause?: unknown }) {
    super(`upload must restart: ${reason}${partNumber ? ` (part ${partNumber})` : ""}`, options);
    this.name = "UploadRestartRequiredError";
    this.reason = reason;
    this.partNumber = partNumber;
  }
}

/** Result of one part PUT. `status` 0 = the request never got a response. */
export interface PartPutResult {
  readonly status: number;
  readonly etag: string | null;
  readonly body: string;
}

export type PartPutter = (args: {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Blob;
  readonly signal: AbortSignal;
  readonly onProgress: (loaded: number) => void;
}) => Promise<PartPutResult>;

export interface RetryPolicy {
  /** Attempts per part (and for `complete`), first try included. Default 6. */
  readonly attempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  /** Re-sends of a part the store refused for its checksum. Default 3. */
  readonly checksumResends?: number;
}

export interface RunChunkedUploadOptions {
  readonly transport: ChunkedUploadTransport;
  readonly source: Blob;
  readonly name: string;
  readonly contentType: string;
  readonly partSize: number;
  /** Per-part SHA-256 hex from `hashParts`. */
  readonly hashes: readonly string[];
  readonly fingerprint: string;
  readonly recordingId: string;
  /** Resume this session instead of starting one. */
  readonly uploadId?: string;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: ChunkedUploadProgress) => void;
  /** Called once the session id is known (to persist it for a later resume). */
  readonly onSession?: (uploadId: string) => void;
  /** Parallel part PUTs. Default 4. */
  readonly concurrency?: number;
  readonly retry?: RetryPolicy;
  /** Part PUT implementation. Default: XHR (upload progress events). */
  readonly putPart?: PartPutter;
  /** Resolves when retrying makes sense. Default: online and tab visible. */
  readonly waitUntilReady?: (signal: AbortSignal) => Promise<void>;
  /** Backoff sleep. Default: setTimeout. */
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

export interface ChunkedUploadResult {
  readonly uploadId: string;
  readonly recording: UploadedRecording;
  /** Parts actually PUT by this run (resumed parts excluded). */
  readonly partsSent: number;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortReason(signal));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function ready(): boolean {
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const visible = typeof document === "undefined" || document.visibilityState !== "hidden";
  return online && visible;
}

/** Waits for `online` + `visible` without polling. */
export function waitUntilOnlineAndVisible(signal: AbortSignal): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const check = (): void => {
      if (!ready()) return;
      cleanup();
      resolve();
    };
    const onAbort = (): void => {
      cleanup();
      reject(abortReason(signal));
    };
    const cleanup = (): void => {
      globalThis.removeEventListener?.("online", check);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", check);
      signal.removeEventListener("abort", onAbort);
    };
    globalThis.addEventListener?.("online", check);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", check);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isTransient(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/**
 * The store refused the part's bytes (`XAmzContentChecksumMismatch`,
 * `BadDigest`, …). S3-compatible stores answer 400 for all of them, and a
 * bound part URL has nothing else a 400 could be about.
 */
function isChecksumRefusal(r: PartPutResult): boolean {
  return r.status === 400;
}

class PartFailure extends Error {
  constructor(
    readonly partNumber: number,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
  }
}

/**
 * Upload `source` as a verified multipart session and complete it.
 *
 * Throws `UploadInterruptedError` when it gives up (retries exhausted, network
 * gone, aborted) — resume later with `uploadId`; `UploadRestartRequiredError`
 * when resuming cannot work; a `ChunkedTransportError` for any other refusal.
 */
export async function runChunkedUpload(
  options: RunChunkedUploadOptions
): Promise<ChunkedUploadResult> {
  const {
    transport,
    source,
    name,
    contentType,
    partSize,
    hashes,
    fingerprint,
    recordingId,
    onProgress,
    onSession,
  } = options;
  const attempts = Math.max(1, options.retry?.attempts ?? 6);
  const baseDelay = options.retry?.baseDelayMs ?? 500;
  const maxDelay = options.retry?.maxDelayMs ?? 30_000;
  const checksumResends = options.retry?.checksumResends ?? 3;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const putPart = options.putPart ?? xhrPutPart;
  const waitReady = options.waitUntilReady ?? waitUntilOnlineAndVisible;
  const sleep = options.sleep ?? defaultSleep;

  const size = source.size;
  const total = partCount(size, partSize);
  if (hashes.length !== total) {
    throw new RangeError(`expected ${total} part hashes, got ${hashes.length}`);
  }

  // Internal controller: the caller's signal, or our own stop on fatal errors.
  const ctl = new AbortController();
  const outer = options.signal;
  const onOuterAbort = (): void => ctl.abort(outer?.reason);
  if (outer?.aborted) ctl.abort(outer.reason);
  else outer?.addEventListener("abort", onOuterAbort, { once: true });
  const signal = ctl.signal;

  const etags = new Map<number, string>();
  const inFlight = new Map<number, number>();
  let uploadId = options.uploadId;
  let partsSent = 0;

  const partBytes = (n: number): number => {
    const [a, b] = partRange(n, size, partSize);
    return b - a;
  };
  const report = (): void => {
    if (!onProgress) return;
    let loaded = 0;
    for (const n of etags.keys()) loaded += partBytes(n);
    for (const v of inFlight.values()) loaded += v;
    onProgress({ loaded: Math.min(loaded, size), total: size, partsDone: etags.size, partsTotal: total });
  };
  const interrupted = (cause: unknown): UploadInterruptedError =>
    new UploadInterruptedError(etags.size, total, uploadId, { cause });

  const backoff = async (attempt: number): Promise<void> => {
    const cap = Math.min(maxDelay, baseDelay * 2 ** attempt);
    await sleep(Math.random() * cap, signal);
    await waitReady(signal);
  };

  const checkLayout = (ps: number | null | undefined, tp: number | null | undefined): void => {
    if (ps !== partSize || tp !== total) throw new UploadRestartRequiredError("layout_mismatch");
  };

  /** Fold a transport failure into this module's error vocabulary. */
  const classify = (e: unknown): unknown => {
    if (signal.aborted) return interrupted(abortReason(signal));
    if (e instanceof UploadRestartRequiredError || e instanceof UploadInterruptedError) return e;
    const err = e instanceof ChunkedTransportError ? e : toTransportError(e);
    if (err.code === UPLOAD_ERROR_KEYS.expired) return new UploadRestartRequiredError("expired", undefined, { cause: err });
    return err;
  };

  /** A control-plane call with transient retries. */
  const control = async <T>(fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        const c = classify(e);
        if (!(c instanceof ChunkedTransportError)) throw c;
        const retryable = isTransient(c.status) || c.code === UPLOAD_ERROR_KEYS.unverifiable;
        if (!retryable) throw c;
        if (attempt + 1 >= attempts) throw interrupted(c);
        try {
          await backoff(attempt);
        } catch {
          throw interrupted(abortReason(signal));
        }
      }
    }
  };

  /** Adopt the store's view: which parts are there and match their hash. */
  const adopt = (uploaded: readonly StoredPart[]): number[] => {
    etags.clear();
    for (const p of uploaded) {
      const n = p.part_number;
      if (n < 1 || n > total) continue;
      if (p.size !== partBytes(n)) continue;
      if (p.sha256 != null && p.sha256 !== hashes[n - 1]) continue;
      etags.set(n, p.etag);
    }
    const missing: number[] = [];
    for (let n = 1; n <= total; n++) if (!etags.has(n)) missing.push(n);
    return missing;
  };

  const relist = async (): Promise<number[]> => {
    const id = uploadId as string;
    const m = await control(() => transport.manifest(recordingId, id, signal));
    checkLayout(m.part_size_bytes, m.total_parts);
    return adopt(m.uploaded_parts);
  };

  /** PUT a set of parts through a bounded worker pool. */
  const sendParts = async (numbers: readonly number[]): Promise<void> => {
    const id = uploadId as string;
    const urls = new Map<number, MultipartPartUrl>();
    let minting: Promise<void> | null = null;
    const queue = [...numbers];

    const mint = async (want: readonly number[]): Promise<void> => {
      const minted = await control(() =>
        transport.mint(
          recordingId,
          id,
          want.map((n) => ({ part_number: n, sha256: hashes[n - 1] as string })),
          signal
        )
      );
      for (const p of minted.parts) urls.set(p.part_number, p);
    };

    const urlFor = async (n: number): Promise<MultipartPartUrl> => {
      for (;;) {
        const have = urls.get(n);
        if (have) return have;
        if (minting) {
          await minting;
          continue;
        }
        // Mint this part plus the next queued ones without a URL.
        const want = [n, ...queue.filter((q) => !urls.has(q))].slice(0, MINT_BATCH);
        minting = mint(want).finally(() => {
          minting = null;
        });
        await minting;
        if (!urls.has(n)) throw new PartFailure(n, "server minted no URL for this part");
      }
    };

    const sendOne = async (n: number): Promise<void> => {
      const [start, end] = partRange(n, size, partSize);
      let checksumLeft = checksumResends;
      for (let attempt = 0; ; ) {
        if (signal.aborted) throw abortReason(signal);
        const u = await urlFor(n);
        inFlight.set(n, 0);
        let r: PartPutResult;
        try {
          r = await putPart({
            url: u.presigned_url,
            headers: u.headers,
            body: source.slice(start, end),
            signal,
            onProgress: (loaded) => {
              inFlight.set(n, Math.min(loaded, end - start));
              report();
            },
          });
        } finally {
          inFlight.delete(n);
        }
        if (r.status >= 200 && r.status < 300 && r.etag) {
          etags.set(n, r.etag);
          partsSent++;
          report();
          return;
        }
        if (isChecksumRefusal(r)) {
          // The bytes that left did not match the hash the URL is bound to.
          // If the source itself changed, resending cannot help.
          const actual = await sha256Hex(await source.slice(start, end).arrayBuffer());
          if (actual !== hashes[n - 1]) throw new UploadRestartRequiredError("source_changed", n);
          if (checksumLeft-- <= 0) throw new PartFailure(n, "checksum refused repeatedly");
          continue;
        }
        if (r.status === 403) urls.delete(n); // expired signature: mint again
        const retryable =
          isTransient(r.status) || r.status === 403 || (r.status >= 200 && r.status < 300);
        attempt++;
        if (!retryable || attempt >= attempts) {
          throw new PartFailure(n, `part ${n} failed with HTTP ${r.status}${r.etag ? "" : " (no ETag)"}`);
        }
        await backoff(attempt - 1);
      }
    };

    let firstError: unknown;
    const worker = async (): Promise<void> => {
      while (queue.length > 0 && firstError === undefined) {
        const n = queue.shift() as number;
        try {
          await sendOne(n);
        } catch (e) {
          if (firstError === undefined) firstError = e;
          ctl.abort(e);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, numbers.length) }, worker));
    if (firstError !== undefined) throw firstError;
  };

  try {
    let missing: number[];
    if (uploadId) {
      missing = await relist();
    } else {
      const started = await control(() =>
        transport.start(
          recordingId,
          { file_size_bytes: size, content_type: contentType, fingerprint, filename: name },
          signal
        )
      );
      uploadId = started.upload_id;
      checkLayout(started.part_size_bytes, started.total_parts);
      missing = [];
      for (let n = 1; n <= total; n++) missing.push(n);
    }
    onSession?.(uploadId);
    report();

    for (let round = 0; ; round++) {
      if (missing.length > 0) await sendParts(missing);
      const parts: CompletedPart[] = [];
      for (let n = 1; n <= total; n++) {
        parts.push({ part_number: n, etag: etags.get(n) ?? "", sha256: hashes[n - 1] as string });
      }
      try {
        const id = uploadId;
        const recording = await control(() => transport.complete(recordingId, id, parts, signal));
        return { uploadId, recording, partsSent };
      } catch (e) {
        if (round >= 3) throw e;
        if (hasUploadErrorCode(e, UPLOAD_ERROR_KEYS.partsMissing)) {
          missing = await relist();
          continue;
        }
        if (hasUploadErrorCode(e, UPLOAD_ERROR_KEYS.partMismatch)) {
          const pn = Number(uploadErrorParam(e, "part_number") ?? 0);
          if (!(pn >= 1 && pn <= total)) {
            throw new UploadRestartRequiredError("fingerprint_mismatch", undefined, { cause: e });
          }
          missing = await relist();
          if (!missing.includes(pn)) missing.push(pn);
          etags.delete(pn);
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    if (outer?.aborted) throw interrupted(abortReason(outer));
    if (e instanceof PartFailure) throw interrupted(e);
    if (e instanceof DOMException && e.name === "AbortError") throw interrupted(e);
    if (isTransient(uploadErrorStatus(e) ?? -1)) throw interrupted(e);
    throw e;
  } finally {
    outer?.removeEventListener("abort", onOuterAbort);
  }
}
