import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createChatApi } from "../api/chatApi.js";
import type { ChatApi } from "../api/chatApi.js";
import { canOpenWebSocket } from "../realtime/chatSocket.js";
import type {
  ChatReconnectOptions,
  ChatWebSocketFactory,
} from "../realtime/chatSocket.js";
import { deriveChatSocketBase } from "../realtime/streams.js";

/**
 * Host-side realtime configuration. Every field is optional and every default
 * degrades to polling rather than to a broken socket — a host that says
 * nothing gets the right behaviour on a WSGI deployment (no sockets at all)
 * and on an ASGI one (sockets, if the origin can be resolved).
 */
export interface ChatRealtimeOptions {
  /**
   * Where this deployment mounts `stapel_chat.routing.websocket_urlpatterns`,
   * e.g. `wss://shop.example/ws/chat/`. Omit to derive it from `baseUrl`
   * (the canonical `/ws/chat/` at the API's own origin). Pass `null` to turn
   * the socket transport OFF explicitly — a host that knows its backend runs
   * under WSGI says so here instead of letting every tab fail a handshake
   * six times first.
   */
  readonly socketUrl?: string | null;
  /** Injectable socket transport (tests, instrumentation, React Native). */
  readonly webSocket?: ChatWebSocketFactory;
  /** Reconnect backoff knobs. */
  readonly reconnect?: ChatReconnectOptions;
  /**
   * Origin used to resolve a relative `baseUrl`. Defaults to the browser's
   * own; irrelevant when `baseUrl` is absolute.
   */
  readonly origin?: string | null;
}

/** The realtime configuration as the transport seam reads it. */
export interface ChatRealtimeConfig {
  /** `null` — this build will not open sockets; the seam polls. */
  readonly socketBase: string | null;
  readonly webSocket: ChatWebSocketFactory | undefined;
  readonly reconnect: ChatReconnectOptions | undefined;
}

/**
 * The wired chat runtime — core's `ModuleRuntime` bound to this pair's API,
 * PLUS the one thing chat has and a plain REST pair does not: where its
 * socket lives. The socket URL is runtime configuration, not module state, so
 * it rides here rather than through a second provider.
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
  const socketBase =
    explicit === null
      ? null
      : explicit !== undefined
        ? explicit
        : canOpenWebSocket()
          ? deriveChatSocketBase(baseUrl, options?.origin ?? currentOrigin())
          : null;
  return {
    socketBase,
    webSocket: options?.webSocket,
    reconnect: options?.reconnect,
  };
}

export function createChatRuntime(
  options: CreateChatRuntimeOptions
): ChatRuntime {
  const runtime = createModuleRuntime(createChatApi, options);
  return { ...runtime, realtime: resolveRealtime(options.baseUrl, options.realtime) };
}
