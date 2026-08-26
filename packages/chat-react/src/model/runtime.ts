import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { canOpenWebSocket } from "@stapel/realtime";
import type { RealtimeClientOptions } from "@stapel/realtime";
import { createChatApi } from "../api/chatApi.js";
import type { ChatApi } from "../api/chatApi.js";
import { deriveChatSocketOrigin } from "../realtime/streams.js";

/**
 * Everything the substrate's client takes except where it points and who
 * listens — chat resolves the URL from its own stream keys, and the pair owns
 * the state subscription.
 *
 * Passing these through rather than restating them is the point of the
 * cutover: `reconnect`, `heartbeat`, `webSocket`, `schedule`, `random`, `now`
 * and the `degradation` thresholds are `@stapel/realtime`'s, tested there
 * once for the fleet, and chat gains them by not having an opinion.
 */
export type ChatRealtimeClientOptions = Omit<RealtimeClientOptions, "url" | "onState">;

/**
 * Host-side realtime configuration.
 *
 * ── What changed in 0.4.0 ──────────────────────────────────────────────────
 *
 * `credential` and `renewCredential` are GONE, and their absence is the fix,
 * not a regression. A browser cannot put a header on `new WebSocket()`; what
 * it can do is send its httpOnly cookie, which it does by itself, and that is
 * what `@stapel/realtime`'s transport opens with — one argument, nothing
 * added. A bearer host passes `protocols` (the `Sec-WebSocket-Protocol` pair
 * core's channel 2 reads). The `?token=` channel is deliberately not offered:
 * query strings land in every proxy access log.
 *
 * A rejected credential is likewise no longer this pair's problem to model.
 * 4401 goes to `session` — core's `SessionManager`, single-flight, the same
 * refresh the HTTP client already coalesces its 401s into — and the pair sees
 * only the three outcomes: a reconnect, a backoff, or a visible
 * `sign_in_required`.
 */
export interface ChatRealtimeOptions extends ChatRealtimeClientOptions {
  /**
   * The socket ORIGIN (`wss://shop.example`), not a path: the mounts are the
   * stream's (`ws/chat/<id>`, `ws/chat/inbox`) and they sit at the host root.
   * Omit to derive it from `baseUrl`. Pass `null` to turn the socket
   * transport OFF explicitly — a host that knows its backend runs under WSGI
   * says so here instead of letting every tab fail a handshake first, and the
   * seam then says `no_socket` out loud rather than polling in silence.
   */
  readonly socketUrl?: string | null;
  /**
   * Origin used to resolve a relative `baseUrl`. Defaults to the browser's
   * own; irrelevant when `baseUrl` is absolute.
   */
  readonly origin?: string | null;
}

/** The realtime configuration as the transport seam reads it. */
export interface ChatRealtimeConfig {
  /** `null` — this build will not open sockets; the seam polls and says so. */
  readonly socketOrigin: string | null;
  /** Pass-through options for the substrate's client. */
  readonly client: ChatRealtimeClientOptions;
}

/**
 * The wired chat runtime — core's `ModuleRuntime` bound to this pair's API,
 * PLUS the one thing chat has and a plain REST pair does not: where its
 * sockets live. That is runtime configuration, not module state, so it rides
 * here rather than through a second provider.
 */
export type ChatRuntime = ModuleRuntime<ChatApi> & {
  readonly realtime: ChatRealtimeConfig;
};

export interface CreateChatRuntimeOptions extends CreateModuleRuntimeOptions {
  readonly realtime?: ChatRealtimeOptions;
}

function currentOrigin(): string | null {
  return typeof location !== "undefined" ? location.origin : null;
}

function resolveRealtime(
  baseUrl: string,
  options: ChatRealtimeOptions | undefined
): ChatRealtimeConfig {
  const explicit = options?.socketUrl;
  const socketOrigin =
    explicit === null
      ? null
      : explicit !== undefined
        ? explicit
        : // A host that injects a transport has one even where the DOM does
          // not (React Native, a node runner), so the environment probe is
          // only asked when the default browser transport would be used.
          options?.webSocket !== undefined || canOpenWebSocket()
          ? deriveChatSocketOrigin(baseUrl, options?.origin ?? currentOrigin())
          : null;
  const {
    socketUrl: _socketUrl,
    origin: _origin,
    ...client
  } = options ?? ({} as ChatRealtimeOptions);
  return { socketOrigin, client };
}

export function createChatRuntime(
  options: CreateChatRuntimeOptions
): ChatRuntime {
  const runtime = createModuleRuntime(createChatApi, options);
  return { ...runtime, realtime: resolveRealtime(options.baseUrl, options.realtime) };
}
