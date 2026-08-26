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
 *  - **`renewing_credential`** — back, and for the first time honestly. The
 *    cutover dropped it because the substrate could not express a refresh in
 *    flight: the stream just read `reconnecting`, and a pair that cannot tell
 *    a credential renewal from a network blip must not name one. The
 *    substrate publishes `RealtimeState.refreshing` now, so the pair can, and
 *    the word is a QUESTION — see {@link withRenewingCredential}.
 *
 * `unreachable` did go the other way, and its absence is a correction: it
 * meant "the retry budget is spent", and the substrate deliberately has no
 * budget. What used to end there now ends in `reconnecting_long`, which says
 * the true thing — it has been down since a time we can name, and it is still
 * trying.
 */
import type {
  RealtimeDegradation,
  RealtimeSessionRefresh,
  RealtimeStreamStatus,
} from "@stapel/realtime";
import type { NoProviderStatus } from "@stapel/realtime/react";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/**
 * Why the socket is NOT carrying this stream. One name per situation, and
 * every one of them reaches the UI.
 *
 *  - `reconnecting` — it dropped; a retry is scheduled. Transient.
 *  - `renewing_credential` — a 4401 sent the session through core's
 *    single-flight refresh and the answer has not landed. The only reason
 *    here that names a QUESTION rather than a state of the socket, and the
 *    only one that is debounced (`RENEWING_CREDENTIAL_DEBOUNCE_MS`).
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
  | "renewing_credential"
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
  renewing_credential: CHAT_I18N_KEYS.transportRenewingCredential,
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

/**
 * HOW LONG A REFRESH HAS TO BE IN FLIGHT BEFORE A PERSON IS TOLD ABOUT IT.
 *
 * This is the whole reason `RealtimeState.refreshing` carries a `since` and
 * not just a flag. A session refresh is one round trip to the session
 * endpoint, and a healthy one lands in well under half a second — so a signal
 * that flipped on the field directly would flash a sentence about the
 * person's credentials at every routine token renewal, several times a day,
 * for a fifth of a second each time. That is not information, it is a twitch,
 * and a twitch about your sign-in is alarming in a way "Reconnecting…" is
 * not. Saying nothing is strictly better than that.
 *
 * 750 ms, chosen from both ends:
 *
 *  - ABOVE a healthy refresh even on a bad link. On a slow mobile connection
 *    the round trip alone can be 300–500 ms, so a 500 ms threshold would
 *    still flash on refreshes that worked perfectly — the exact case the
 *    debounce exists to suppress.
 *  - BELOW the ~1 s at which a stalled screen stops reading as latency and
 *    starts reading as broken. Past that point silence is the worse lie, and
 *    the person deserves the word.
 *
 * ONE constant, read by everything that debounces this signal:
 * `flows/freshness.ts` compares against it AND arms its wake-up timer from it,
 * so "when it appears" and "how long until then" cannot drift apart.
 */
export const RENEWING_CREDENTIAL_DEBOUNCE_MS = 750;

/**
 * The silences a QUESTION is allowed to speak over. All three mean the same
 * thing — the socket is down and something is still trying — which is exactly
 * what a credential renewal sharpens into a specific sentence.
 *
 * Everything not in this list is an ANSWER (`sign_in_required`, `forbidden`,
 * `revoked`, `origin_not_allowed`, `unsupported`) or a statement about the
 * build (`no_socket`), and an answer outranks a question: the substrate lets
 * a verdict win over the refresh window for the same reason, and a refusal
 * held behind a spinner would be a new lie.
 */
const RENEWABLE_SILENCES: readonly ChatDegradedReason[] = [
  "reconnecting",
  "reconnecting_long",
  "never_connected",
];

/**
 * A REFRESH IN FLIGHT IS A QUESTION, NOT AN OUTCOME.
 *
 * Sharpen a still-trying silence into `renewing_credential` when a session
 * refresh has been in flight longer than {@link
 * RENEWING_CREDENTIAL_DEBOUNCE_MS} — and do nothing at all otherwise.
 *
 * The function is PURE and reads only the CURRENT `refreshing`. There is no
 * latch, no "was refreshing", no memory of a question that has been answered:
 * the instant the substrate clears the field this returns `degraded`
 * untouched, which is precisely today's behaviour for all three landings — a
 * renewed credential reconnects, no verdict backs off, a refusal says
 * `sign_in_required`. A renewal that has started is not a renewal that will
 * work, and nothing here may render as if it were.
 *
 * `since` on the result is the refresh's own start, not the socket's: what a
 * skin can honestly say is "we have been asking since 14:02".
 */
export function withRenewingCredential(
  degraded: ChatDegraded | null,
  refreshing: RealtimeSessionRefresh | null,
  now: number
): ChatDegraded | null {
  if (refreshing === null) return degraded;
  // A live stream is not degraded, and a refresh on some OTHER stream of a
  // shared client must not put a sentence on this one.
  if (degraded === null) return null;
  if (!RENEWABLE_SILENCES.includes(degraded.reason)) return degraded;
  if (now - refreshing.since < RENEWING_CREDENTIAL_DEBOUNCE_MS) return degraded;
  return chatDegraded("renewing_credential", degraded.attempt, refreshing.since);
}
