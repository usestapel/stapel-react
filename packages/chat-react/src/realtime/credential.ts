/**
 * THE CREDENTIAL CHANNEL — how a token reaches a WebSocket handshake.
 *
 * A browser cannot set a request header on `new WebSocket(url)`. There is no
 * options bag, no `headers`, no interceptor: the constructor takes a URL and
 * a subprotocol list, and that is the entire surface. So a pair that
 * authenticates its REST calls with `Authorization: Bearer …` and then opens
 * a socket with `new WebSocket(url)` is not sending a weaker credential — it
 * is sending NO credential, and every handshake closes 4401.
 *
 * That is not a hypothetical. It is the defect that made this pair poll for
 * months while its sockets were reported done.
 *
 * The handshake therefore has exactly three channels a browser can use, and
 * this module names all three. They mirror
 * `stapel_core.django.jwt.channels._extract_credential`, which reads them in
 * this order:
 *
 *  1. `Authorization` header — **not reachable from a browser**. Present in
 *     the backend for service-to-service clients; deliberately absent here.
 *  2. `Sec-WebSocket-Protocol` — `new WebSocket(url, ["bearer", token])`.
 *     Log-safe (subprotocols are not written to access logs the way query
 *     strings are) and not ambient, so the backend does not gate it on
 *     `Origin`.
 *  3. `?token=<jwt>` — the explicit fallback. Query strings routinely land in
 *     proxy and server access logs, so it is offered, not preferred.
 *  4. the httpOnly JWT **cookie**, which the browser attaches to the
 *     handshake by itself. Nothing is constructed for it — which is exactly
 *     why it was invisible, and why it is a NAMED channel here rather than
 *     the absence of one. It is ambient authority, so the backend admits it
 *     only from an allow-listed `Origin` (`STAPEL_WS_ALLOWED_ORIGINS`); an
 *     unlisted origin closes 4403, not 4401.
 */

/**
 * What this build puts on the handshake. `cookie` carries no token by
 * construction: the browser holds it and the JS never sees it.
 */
export type ChatSocketCredential =
  | { readonly channel: "cookie" }
  | { readonly channel: "subprotocol"; readonly token: string }
  | { readonly channel: "query"; readonly token: string };

/**
 * Read at EVERY connect, never once at construction: a token that was valid
 * when the provider mounted is the token a reconnect an hour later must not
 * reuse. Returning `null` means "I have no credential right now" — the
 * handshake still goes out on the cookie channel, because a cookie the JS
 * cannot read is still a credential.
 */
export type ChatCredentialSource = () => ChatSocketCredential | null;

/** The subprotocol scheme name core's extractor recognises for a bearer token. */
export const CHAT_WS_BEARER_SUBPROTOCOL = "bearer";

/** The query parameter core's extractor reads. */
export const CHAT_WS_TOKEN_QUERY_PARAM = "token";

/** Exactly what `new WebSocket(...)` is called with. */
export interface ChatSocketTarget {
  readonly url: string;
  /** Empty on the cookie channel — a browser sends the cookie unasked. */
  readonly protocols: readonly string[];
}

/**
 * Put the credential on the wire.
 *
 * Pure, and separately testable, because "what did the client CONSTRUCT" is
 * the only question that distinguishes a working handshake from the one that
 * shipped: a factory that is handed a URL cannot be asked whether a
 * credential travelled.
 */
export function chatSocketTarget(
  url: string,
  credential: ChatSocketCredential | null
): ChatSocketTarget {
  if (credential === null || credential.channel === "cookie") {
    return { url, protocols: [] };
  }
  if (credential.channel === "subprotocol") {
    // The `["<scheme>", "<token>"]` pair shape (core accepts the dotted
    // `"bearer.<token>"` too). The pair is used because a JWT's own dots
    // survive it untouched.
    return {
      url,
      protocols: [CHAT_WS_BEARER_SUBPROTOCOL, credential.token],
    };
  }
  const separator = url.includes("?") ? "&" : "?";
  const encoded = encodeURIComponent(credential.token);
  return {
    url: `${url}${separator}${CHAT_WS_TOKEN_QUERY_PARAM}=${encoded}`,
    protocols: [],
  };
}

/**
 * The three answers a renewal can give — core's `RefreshOutcome`, in this
 * seam's vocabulary, and for the same reason core has three: collapsing the
 * last two throws a signed-in person out of their session because a proxy
 * answered 502.
 *
 *  - `renewed` — a NEW credential is in place (`SessionManager.refresh()`
 *    resolved true; in cookie mode the refresh response's `Set-Cookie` has
 *    already replaced the jar's copy). Reconnect at once.
 *  - `refused` — the server ANSWERED that the credential is dead. The socket
 *    stops and says `unauthenticated`, and the UI asks the person to sign in.
 *  - `unavailable` — no verdict was obtained (fetch threw, 502/503/504,
 *    timeout). We know nothing new about the credential, so this is a
 *    FAULT: back off and try the whole handshake again, exactly as for a
 *    dropped connection. Reporting "please sign in" here would be a lie.
 */
export type ChatCredentialRenewalOutcome = "renewed" | "refused" | "unavailable";

/**
 * The host's renewal seam: "this credential was refused — can you get a
 * better one?". Wire it to core's `SessionManager.refresh()` (see
 * `ChatRealtimeOptions.renewCredential`), which is the ONE place a 401 is
 * handled and which coalesces concurrent callers into a single refresh.
 */
export type ChatCredentialRenewal = () =>
  | ChatCredentialRenewalOutcome
  | Promise<ChatCredentialRenewalOutcome>;
