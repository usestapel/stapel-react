/**
 * How a browser finds its OWN row in `GET /devices/`.
 *
 * The list never echoes a raw push token — it is a bearer credential for that
 * device's push channel, and a response that carried every device's token
 * would hand any XSS the whole account's push surface. What it carries instead
 * is `token_fingerprint`: SHA-256 of the token, hex. The digest is stable and
 * not reversible, so hashing the token this device already holds and matching
 * it against the list is the whole of "is push on for THIS device?".
 *
 * That is the entire reason this file exists, and it is why the toggle no
 * longer keeps a `useState(false)` it cannot justify.
 */

/** Web Crypto's `subtle`, or `null` where there is none (http:// origins, old
 * embedded webviews, a JS runtime with no crypto at all). Read lazily so a
 * module import never touches a global that may not be there. */
function subtle(): SubtleCrypto | null {
  const c: Crypto | undefined = globalThis.crypto;
  return c?.subtle ?? null;
}

/**
 * `true` when this environment can compute a fingerprint at all.
 *
 * Web Crypto is unavailable on insecure origins, so a deployment served over
 * plain http cannot identify its own device — and the skin says so rather than
 * rendering a switch whose position is a guess.
 */
export function canFingerprint(): boolean {
  return subtle() !== null;
}

/** Lowercase hex of a byte buffer — the spelling `token_fingerprint` uses. */
function toHex(buffer: ArrayBuffer): string {
  let out = "";
  for (const byte of new Uint8Array(buffer)) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * SHA-256 of a push token, hex — the value to compare with
 * `DeviceListItem.token_fingerprint`.
 *
 * Rejects (rather than returning a wrong-but-plausible string) where Web
 * Crypto is missing: a fingerprint that cannot be computed must surface as an
 * unknown state, never as "no match" — "no match" is indistinguishable from
 * "push is off", which is the lie this whole mechanism exists to end.
 */
export async function tokenFingerprint(token: string): Promise<string> {
  const crypto = subtle();
  if (crypto === null) {
    throw new Error(
      "Web Crypto is unavailable, so this device's push token cannot be fingerprinted"
    );
  }
  const digest = await crypto.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}
