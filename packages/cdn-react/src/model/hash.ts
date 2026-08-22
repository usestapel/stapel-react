/**
 * SHA-256 of a file's bytes — the key the dedup pre-check is asked with.
 *
 * The backend computes the same digest over the same bytes
 * (`Image.calculate_file_hash`, `hashlib.sha256(...).hexdigest()`), so the two
 * agree by construction: 64 lowercase hex characters of the ORIGINAL upload,
 * before any variant exists.
 *
 * ── Why this can be unavailable, and why that is not an error ──────────────
 *
 * `crypto.subtle` exists only in a SECURE CONTEXT. On `http://` (a LAN test
 * box, an old staging host) it is simply not there, and neither is the
 * pre-check. That is a lost optimisation, not a lost upload: the server
 * deduplicates on its own side regardless, so the POST is still correct — it
 * just costs the bytes. {@link canHashLocally} lets the flow say which of the
 * two paths it took instead of failing, and `UploadItem.dedupSkipped` carries
 * the reason all the way to a skin that wants to explain it.
 *
 * ── Why there is no progress here ──────────────────────────────────────────
 *
 * `SubtleCrypto.digest` takes the whole buffer and returns one promise; it
 * reports nothing in between and cannot be chunked without hand-rolling
 * SHA-256, which is not a thing to hand-roll. Hashing is therefore a PHASE
 * with a duration, not a percentage — see `model/upload.ts` on why the whole
 * bag is phase-shaped.
 */

/** Whether this context can compute the digest at all (see the header). */
export function canHashLocally(): boolean {
  return (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.subtle?.digest === "function"
  );
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/**
 * `digest` is handed a `Uint8Array` VIEW rather than the raw `ArrayBuffer`.
 * Both are valid `BufferSource`, but a buffer that crossed a realm boundary
 * fails a strict `instanceof ArrayBuffer` check in some implementations (jsdom
 * is one, which is where this surfaced), while a typed-array view is accepted
 * everywhere. The view costs nothing — no copy — and removes a portability
 * hazard that would otherwise only show up in somebody else's environment.
 */
const bufferSource = (buffer: ArrayBuffer): Uint8Array<ArrayBuffer> =>
  new Uint8Array(buffer);

/**
 * The 64-character lowercase hex SHA-256 of `blob`'s bytes.
 *
 * Throws whatever the platform throws when there is no `crypto.subtle` — call
 * {@link canHashLocally} first; the upload flow does.
 */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    bufferSource(buffer)
  );
  return toHex(digest);
}
