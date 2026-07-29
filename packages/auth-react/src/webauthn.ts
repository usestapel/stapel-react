/**
 * The DEFAULT browser WebAuthn binding (auth-sa.md §17).
 *
 * The passkey machines model the whole begin→ceremony→complete journey; the
 * one step that must happen in the browser is
 * `navigator.credentials.create()` / `.get()`. That step used to be the
 * host's job entirely ("Thin-WebAuthn TODO"), and every host that did not
 * write it got a passkey flow wedged forever in
 * `awaitingCredential`/`awaitingAssertion`. So the ordinary browser binding
 * lives HERE, and the thin seam stays open for the hosts that need it:
 *
 * - **Default** — nothing to inject: `createAuthRuntime` / the passkey flows /
 *   the `<Passkey*>` components drive `navigator.credentials.*` themselves.
 * - **Override** — an injected `webauthnCreate` / `webauthnGet` still WINS
 *   (native bridges, react-native-passkeys, tests, conditional-UI hosts).
 * - **No API** (SSR, an old browser, a non-secure context) — the default
 *   resolves to *nothing* and the flow behaves exactly as it did before this
 *   existed: it stops in `awaitingCredential`/`awaitingAssertion` and the
 *   host (or the /default skin) shows the honest "can't use passkeys here"
 *   copy. Never a crash, never a hang inside a rejected promise.
 *
 * ## Wire format
 *
 * stapel-auth speaks the JSON projection of the WebAuthn structs that
 * py_webauthn's `options_to_json()` emits and its
 * `RegistrationCredential`/`AuthenticationCredential` parsers read
 * (`stapel-auth/mfa/services.py`): every binary field is **base64url,
 * unpadded**. The browser API speaks `ArrayBuffer`. The conversion in both
 * directions is this module's entire job — done by hand, with no runtime
 * dependency (no @simplewebauthn): the fields are few and fixed.
 *
 * Decoded on the way IN (server → browser): `challenge`, `user.id`,
 * `excludeCredentials[].id` (creation) / `allowCredentials[].id` (request).
 * Encoded on the way OUT (browser → server): `rawId`, `response.*` buffers
 * (`clientDataJSON`, `attestationObject` / `authenticatorData`, `signature`,
 * `userHandle`).
 */

/**
 * A WebAuthn ceremony binding: takes the server's `options` JSON, returns the
 * credential JSON the `complete` endpoint expects.
 */
export type WebauthnBinding = (
  options: Record<string, unknown>
) => Promise<unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** base64url (padded or not) → `ArrayBuffer`. */
export function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  // Tolerate both alphabets and both padding conventions: the server emits
  // unpadded base64url, but a host-supplied or hand-written option blob may
  // carry `=` padding (or even standard base64), and `atob` rejects a wrong
  // padding length outright.
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** `ArrayBuffer` (or any view over one) → unpadded base64url. */
export function arrayBufferToBase64Url(value: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    value instanceof Uint8Array
      ? value
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : new Uint8Array(value);
  let binary = "";
  // Chunked: `String.fromCharCode(...bytes)` blows the argument limit on a
  // large attestationObject.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** `{ publicKey: {...} }` and a bare options object are both accepted. */
function unwrap(options: Record<string, unknown>): Record<string, unknown> {
  const inner = options["publicKey"];
  return isRecord(inner) ? inner : options;
}

function decodeDescriptors(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) =>
    isRecord(entry) && typeof entry["id"] === "string"
      ? { ...entry, id: base64UrlToArrayBuffer(entry["id"]) }
      : entry
  );
}

function decodeChallenge(
  source: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...source };
  const challenge = source["challenge"];
  if (typeof challenge === "string") {
    out["challenge"] = base64UrlToArrayBuffer(challenge);
  }
  return out;
}

/**
 * Server creation-options JSON → `PublicKeyCredentialCreationOptions`.
 * Unknown members (`timeout`, `attestation`, `extensions`, …) pass through
 * untouched — the browser, not this module, owns that vocabulary.
 */
export function toCreationOptions(
  options: Record<string, unknown>
): PublicKeyCredentialCreationOptions {
  const source = unwrap(options);
  const out = decodeChallenge(source);
  const user = source["user"];
  if (isRecord(user) && typeof user["id"] === "string") {
    out["user"] = { ...user, id: base64UrlToArrayBuffer(user["id"]) };
  }
  if (source["excludeCredentials"] !== undefined) {
    out["excludeCredentials"] = decodeDescriptors(source["excludeCredentials"]);
  }
  return out as unknown as PublicKeyCredentialCreationOptions;
}

/** Server request-options JSON → `PublicKeyCredentialRequestOptions`. */
export function toRequestOptions(
  options: Record<string, unknown>
): PublicKeyCredentialRequestOptions {
  const source = unwrap(options);
  const out = decodeChallenge(source);
  if (source["allowCredentials"] !== undefined) {
    out["allowCredentials"] = decodeDescriptors(source["allowCredentials"]);
  }
  return out as unknown as PublicKeyCredentialRequestOptions;
}

/** The shape both `complete` endpoints parse (base64url everywhere). */
type CredentialJson = Record<string, unknown>;

function credentialEnvelope(credential: PublicKeyCredential): CredentialJson {
  const out: CredentialJson = {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
  };
  // Optional in the DOM API AND absent on older authenticators; the server
  // treats a missing/empty value as "unknown", but chokes on `null` being
  // fed to its enum. Emit the key only when there is a value.
  const attachment = credential.authenticatorAttachment;
  if (typeof attachment === "string" && attachment !== "") {
    out["authenticatorAttachment"] = attachment;
  }
  if (typeof credential.getClientExtensionResults === "function") {
    out["clientExtensionResults"] = credential.getClientExtensionResults();
  }
  return out;
}

/** `PublicKeyCredential` (attestation) → the register/complete JSON body. */
export function encodeAttestation(credential: PublicKeyCredential): CredentialJson {
  const response = credential.response as AuthenticatorAttestationResponse;
  const inner: CredentialJson = {
    clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
    attestationObject: arrayBufferToBase64Url(response.attestationObject),
  };
  // `getTransports` is optional (and absent in some webviews); the server
  // reads `transports` only when present.
  if (typeof response.getTransports === "function") {
    inner["transports"] = response.getTransports();
  }
  return { ...credentialEnvelope(credential), response: inner };
}

/** `PublicKeyCredential` (assertion) → the authenticate/complete JSON body. */
export function encodeAssertion(credential: PublicKeyCredential): CredentialJson {
  const response = credential.response as AuthenticatorAssertionResponse;
  const inner: CredentialJson = {
    clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
    authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
    signature: arrayBufferToBase64Url(response.signature),
  };
  // Discoverable-credential ("usernameless") logins carry it; an
  // allowCredentials login usually does not. The server treats a falsy value
  // as absent either way.
  if (response.userHandle) {
    inner["userHandle"] = arrayBufferToBase64Url(response.userHandle);
  }
  return { ...credentialEnvelope(credential), response: inner };
}

/**
 * Is the browser WebAuthn API reachable *right now*? False under SSR, in a
 * non-secure context that strips `credentials`, and in browsers old enough to
 * lack the API. Checked per ceremony, never memoized at module load — a
 * server-rendered module graph is imported long before the browser one runs.
 */
export function isWebauthnSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials.get === "function" &&
    typeof PublicKeyCredential !== "undefined"
  );
}

function unsupported(): Error {
  return new Error("webauthn_unsupported");
}

function noCredential(): Error {
  // The ceremony resolved without a credential — spec-legal (`null`), and
  // nothing downstream can be built from it.
  return new Error("webauthn_no_credential");
}

/** Default `webauthnCreate`: registration ceremony via the browser. */
export async function defaultWebauthnCreate(
  options: Record<string, unknown>
): Promise<unknown> {
  if (!isWebauthnSupported()) throw unsupported();
  const credential = await navigator.credentials.create({
    publicKey: toCreationOptions(options),
  });
  if (credential === null) throw noCredential();
  return encodeAttestation(credential as PublicKeyCredential);
}

/** Default `webauthnGet`: authentication/assertion ceremony via the browser. */
export async function defaultWebauthnGet(
  options: Record<string, unknown>
): Promise<unknown> {
  if (!isWebauthnSupported()) throw unsupported();
  const credential = await navigator.credentials.get({
    publicKey: toRequestOptions(options),
  });
  if (credential === null) throw noCredential();
  return encodeAssertion(credential as PublicKeyCredential);
}

/**
 * The binding a flow should actually drive: an injected one wins; otherwise
 * the browser default — and `undefined` where no browser API exists, which is
 * what keeps the pre-default thin behaviour (stop at `awaiting*`, host drives
 * or shows copy) intact instead of turning an unsupported environment into a
 * flow `error`.
 */
export function resolveWebauthnCreate(
  injected?: WebauthnBinding
): WebauthnBinding | undefined {
  if (injected !== undefined) return injected;
  return isWebauthnSupported() ? defaultWebauthnCreate : undefined;
}

/** {@link resolveWebauthnCreate}'s assertion-side twin. */
export function resolveWebauthnGet(
  injected?: WebauthnBinding
): WebauthnBinding | undefined {
  if (injected !== undefined) return injected;
  return isWebauthnSupported() ? defaultWebauthnGet : undefined;
}
