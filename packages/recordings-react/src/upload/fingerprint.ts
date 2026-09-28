/**
 * Fingerprint v1 — the content identity a large upload is resumed by.
 *
 * ```
 * P = part size, S = total size, n = max(1, ceil(S/P))
 * part_i = bytes[(i-1)P, min(iP, S))            (1-based)
 * h_i    = SHA-256(part_i)
 * fingerprint = hex(SHA-256("stapel-upload-v1\n" + S + "\n" + P + "\n" + h_1 || … || h_n))
 * ```
 *
 * The server recomputes the same value from the store's own part checksums
 * (`stapel_recordings.chunked.fingerprint_of`), so the bytes here must match it
 * exactly. Hashing reads ONE part at a time: a 4 GB file never sits in memory.
 */

const PREFIX = "stapel-upload-v1\n";

export interface HashPartsOptions {
  readonly signal?: AbortSignal;
  /** Bytes hashed so far, and the total. Called after every part. */
  readonly onProgress?: (hashedBytes: number, totalBytes: number) => void;
}

export interface HashPartsResult {
  /** 64 lower-case hex characters. */
  readonly fingerprint: string;
  /** Per-part SHA-256, lower-case hex, part 1 first. */
  readonly partHashes: string[];
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("WebCrypto (crypto.subtle) is not available");
  return s;
}

/** Lower-case hex of raw bytes. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error(`not a lower-case SHA-256 hex digest: ${hex}`);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** The number of parts a file of `size` bytes splits into. Never 0. */
export function partCount(size: number, partSize: number): number {
  return Math.max(1, Math.ceil(size / partSize));
}

/** Byte range `[start, end)` of 1-based part `partNumber`. */
export function partRange(
  partNumber: number,
  size: number,
  partSize: number
): readonly [number, number] {
  const start = (partNumber - 1) * partSize;
  return [start, Math.min(start + partSize, size)];
}

/** SHA-256 of raw bytes, lower-case hex. */
export async function sha256Hex(data: BufferSource): Promise<string> {
  return toHex(new Uint8Array(await subtle().digest("SHA-256", data)));
}

/** Fingerprint from already known per-part hashes (hex). */
export async function fingerprintOf(
  size: number,
  partSize: number,
  hashesHex: readonly string[]
): Promise<string> {
  if (!Number.isInteger(partSize) || partSize <= 0) {
    throw new RangeError(`part size must be a positive integer: ${partSize}`);
  }
  if (hashesHex.length !== partCount(size, partSize)) {
    throw new RangeError(
      `expected ${partCount(size, partSize)} part hashes, got ${hashesHex.length}`
    );
  }
  const head = new TextEncoder().encode(`${PREFIX}${size}\n${partSize}\n`);
  const buf = new Uint8Array(head.length + 32 * hashesHex.length);
  buf.set(head, 0);
  hashesHex.forEach((h, i) => buf.set(fromHex(h), head.length + 32 * i));
  return sha256Hex(buf);
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

/**
 * Hash `blob` part by part (WebCrypto) and derive its fingerprint. Only the
 * current part's bytes are held; each is released before the next is read.
 */
export async function hashParts(
  blob: Blob,
  partSize: number,
  options: HashPartsOptions = {}
): Promise<HashPartsResult> {
  const { signal, onProgress } = options;
  if (!Number.isInteger(partSize) || partSize <= 0) {
    throw new RangeError(`part size must be a positive integer: ${partSize}`);
  }
  const size = blob.size;
  const n = partCount(size, partSize);
  const partHashes: string[] = [];
  let hashed = 0;
  for (let i = 1; i <= n; i++) {
    if (signal?.aborted) throw abortError(signal);
    const [start, end] = partRange(i, size, partSize);
    const bytes = await blob.slice(start, end).arrayBuffer();
    partHashes.push(await sha256Hex(bytes));
    hashed += end - start;
    onProgress?.(hashed, size);
  }
  if (signal?.aborted) throw abortError(signal);
  return { fingerprint: await fingerprintOf(size, partSize, partHashes), partHashes };
}
