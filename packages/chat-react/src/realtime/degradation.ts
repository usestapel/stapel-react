/**
 * A DEGRADED TRANSPORT IS NEVER SILENT — the pair's half of that rule.
 *
 * `transport: "polling"` was true and useless: it read the same whether the
 * deployment has no sockets, the credential was refused, or the socket has
 * never once opened. "Refreshing every few seconds" was read as a product
 * decision for months while every handshake was being refused. So every
 * reason has a NAME, and every name has an i18n key in all three locales.
 *
 * What changed with the substrate is where the names come from. Two of them
 * are now `@stapel/realtime`'s and are sharper than anything this pair could
 * derive on its own:
 *
 *  - **`never_connected`** — this client has never had an open socket. A
 *    deployment can sit in that state for months (an origin allowlist nobody
 *    filled in, an ingress that does not upgrade), and it is NOT the same
 *    sentence as "reconnecting". This is the state the original defect lived
 *    in, and it now has a word.
 *  - **`origin_not_allowed`** — 4403 before the handshake was accepted, which
 *    is core's origin gate, not `authorize()`. An operator fixes it in
 *    deployment config; reading it as "you are not a participant" sends them
 *    hunting for a permissions bug that does not exist.
 *
 * One name went the other way. `renewing_credential` is gone: the substrate
 * runs the 4401 → `SessionManager.refresh()` path itself and reports the
 * stream as `reconnecting` while it is in flight, so a pair cannot honestly
 * claim to know a renewal is happening. Its three OUTCOMES are all still
 * visible — an immediate reconnect, a backoff, or `sign_in_required` — which
 * is the part a person can act on. (Upstream note in MODULE.md.)
 *
 * `unreachable` is gone too, and its absence is a correction: it meant "the
 * retry budget is spent", and the substrate deliberately has no budget. What
 * used to end there now ends in `reconnecting_long`, which says the true
 * thing — it has been down since a time we can name, and it is still trying.
 */
import type { RealtimeDegradation, RealtimeStreamStatus } from "@stapel/realtime";
import type { NoProviderStatus } from "@stapel/realtime/react";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/**
 * Why the socket is NOT carrying this stream. One name per situation, and
 * every one of them reaches the UI.
 *
 *  - `reconnecting` — it dropped; a retry is scheduled. Transient.
 *  - `reconnecting_long` — it worked, went away, and has stayed away. Still
 *    trying (there is no give-up), but long enough that a person staring at a
 *    stale screen deserves to be told.
 *  - `never_connected` — configured, tried, and never once open. Almost
 *    always a deployment fault, and the one a generic spinner hides.
 *  - `sign_in_required` — 4401 survived a session refresh. The person has to
 *    act; say so.
 *  - `forbidden` — `authorize()` said no for this stream.
 *  - `revoked` — access was withdrawn mid-socket (a `kick`, then 4410).
 *  - `origin_not_allowed` — the deployment's `STAPEL_WS_ALLOWED_ORIGINS` does
 *    not list this page's origin. An operator's fix, not the user's.
 *  - `unsupported` — this build or this environment cannot have the socket
 *    (4404 unknown stream, or no `WebSocket` at all).
 *  - `no_socket` — there is no socket for this stream in this build: an
 *    explicit `socketUrl: null`, an origin that cannot be resolved, no
 *    `<RealtimeProvider>` above the surface, or an inbox with no viewer id.
 *    Legitimate, and still named: "always polling" must be a fact someone can
 *    read, not a silence.
 */
export type ChatDegradedReason =
  | "reconnecting"
  | "reconnecting_long"
  | "never_connected"
  | "sign_in_required"
  | "forbidden"
  | "revoked"
  | "origin_not_allowed"
  | "unsupported"
  | "no_socket";

/** The named degradation the UI renders. `null` means the socket is live. */
export interface ChatDegraded {
  readonly reason: ChatDegradedReason;
  /** Consecutive failed connects — 0 when the socket never got to try. */
  readonly attempt: number;
  /**
   * When this degradation began, on the client's clock — what lets a skin say
   * "since 14:02" instead of "for a while". `undefined` when the substrate
   * has not named a degradation (a plain transient reconnect).
   */
  readonly since: number | undefined;
  /**
   * The i18n key for this degradation, carried in the bag so a skin cannot
   * accidentally render a degraded transport as an unlabelled one. A skin may
   * of course use `reason` and its own copy instead.
   */
  readonly messageKey: string;
}

const DEGRADED_KEYS: Readonly<Record<ChatDegradedReason, string>> = {
  reconnecting: CHAT_I18N_KEYS.transportReconnecting,
  reconnecting_long: CHAT_I18N_KEYS.transportReconnectingLong,
  never_connected: CHAT_I18N_KEYS.transportNeverConnected,
  sign_in_required: CHAT_I18N_KEYS.transportSignInRequired,
  forbidden: CHAT_I18N_KEYS.transportForbidden,
  revoked: CHAT_I18N_KEYS.transportRevoked,
  origin_not_allowed: CHAT_I18N_KEYS.transportOriginNotAllowed,
  unsupported: CHAT_I18N_KEYS.transportUnsupported,
  no_socket: CHAT_I18N_KEYS.transportNoSocket,
};

export function chatDegraded(
  reason: ChatDegradedReason,
  attempt: number,
  since?: number | undefined
): ChatDegraded {
  return { reason, attempt, since, messageKey: DEGRADED_KEYS[reason] };
}

/** The substrate's refusal kinds → what a person is told. */
function refusalDegradation(
  status: RealtimeStreamStatus
): ChatDegradedReason {
  switch (status.refusal) {
    case "session":
      return "sign_in_required";
    case "origin":
      return "origin_not_allowed";
    case "forbidden":
      return "forbidden";
    case "revoked":
      return "revoked";
    case "stream_unknown":
    case "unsupported":
      return "unsupported";
    default:
      // A refusal with no kind cannot happen through the substrate, but a
      // stopped socket with no explanation is the one thing this module may
      // never render — so it falls to the honest generic, not to `null`.
      return "reconnecting";
  }
}

/**
 * The whole "is this stream live, and if not why not" question, in one pure
 * function so both the hook and its tests read the same answer.
 *
 * `clientDegradation` is `RealtimeState.degradation` — a CLIENT-wide fact.
 * When a host mounts one `<RealtimeProvider>` for several modules it is
 * shared, so per-stream evidence (`status`) is consulted first and the
 * client's name is used only to sharpen a stream that is already known to be
 * down.
 */
export function chatDegradation(
  status: RealtimeStreamStatus | NoProviderStatus,
  clientDegradation: RealtimeDegradation | null,
  options: { readonly hasSocket: boolean; readonly attempted: boolean }
): ChatDegraded | null {
  if (status.state === "no_provider") {
    // Not a socket state at all: nothing is retrying and nothing was refused.
    return chatDegraded("no_socket", 0);
  }
  if (!options.hasSocket) return chatDegraded("no_socket", 0);
  if (!options.attempted) return null;

  const attempt = status.attempt;
  switch (status.state) {
    case "live":
    case "replaying":
      return null;
    case "resync":
      // Behind the replay window, socket still open, and the store is already
      // re-reading over REST. Healing is not degrading.
      return null;
    case "refused":
      return chatDegraded(
        refusalDegradation(status),
        attempt,
        clientDegradation?.kind === "refused" ? clientDegradation.since : undefined
      );
    case "idle":
      // Subscribed to nothing yet (the thread window is still loading, or the
      // surface is disabled). Nothing has failed.
      return null;
    case "connecting":
      // The substrate says `connecting` only while it has never been up; the
      // first attempt is not a degradation, a repeated one is.
      if (attempt === 0 && clientDegradation === null) return null;
      return named(clientDegradation, attempt);
    case "reconnecting":
    case "closed":
      return named(clientDegradation, attempt);
  }
}

/**
 * A stream that is down: use the substrate's NAME for the silence when it has
 * one, and the honest generic when the silence is still young.
 */
function named(
  clientDegradation: RealtimeDegradation | null,
  attempt: number
): ChatDegraded {
  if (clientDegradation?.kind === "never_connected") {
    return chatDegraded("never_connected", clientDegradation.attempts, clientDegradation.since);
  }
  if (clientDegradation?.kind === "reconnecting_long") {
    return chatDegraded(
      "reconnecting_long",
      clientDegradation.attempts,
      clientDegradation.since
    );
  }
  return chatDegraded("reconnecting", attempt);
}
