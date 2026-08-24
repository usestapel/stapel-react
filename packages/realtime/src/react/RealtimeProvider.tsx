/**
 * `<RealtimeProvider>` — one {@link RealtimeClient} for a subtree, and the
 * place core's session seam gets wired in.
 *
 * The provider is where `@stapel/core` is touched at all: the framework-free
 * entry stays dependency-free, and a pair that never opens a socket never
 * loads this file. By default the provider adopts the host's active
 * `SessionManager`, which is what turns a 4401 close from "the socket is dead"
 * into "the session needs refreshing" — the same single-flight refresh the
 * HTTP client already coalesces its 401s into.
 */
import { createContext, createElement, useContext, useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { getActiveSessionManager } from "@stapel/core";
import type { SessionManager } from "@stapel/core";
import { createRealtimeClient } from "../client.js";
import type {
  RealtimeClient,
  RealtimeClientOptions,
  RealtimeSessionSeam,
  RealtimeUrl,
} from "../client.js";

const RealtimeContext = createContext<RealtimeClient | null>(null);

/** Adapt core's `SessionManager` to the narrow seam the runtime needs. */
export function sessionSeam(manager: SessionManager): RealtimeSessionSeam {
  return {
    refresh: () => manager.refresh(),
    sessionLost: (reason) => manager.sessionLost(reason),
    on: (event, handler) => {
      if (event !== "session:refresh-unavailable") return () => undefined;
      return manager.on("session:refresh-unavailable", () => {
        handler(undefined);
      });
    },
  };
}

export interface RealtimeProviderProps
  extends Omit<RealtimeClientOptions, "url" | "session"> {
  /**
   * A string puts every stream on ONE socket (multiplexed, routed by
   * `envelope.stream`); a function gives each stream its own URL, which is the
   * shipped v1 server's socket-per-stream topology.
   */
  readonly url: RealtimeUrl;
  /**
   * Session seam for the 4401 path. Omit to adopt the host's active
   * `SessionManager`; pass `null` to opt out (a 4401 then surfaces as a
   * visible refusal instead of a refresh attempt).
   */
  readonly session?: RealtimeSessionSeam | null;
  /** Supply a pre-built client (tests, a host that owns its own lifecycle). */
  readonly client?: RealtimeClient;
  readonly children?: ReactNode;
}

export function RealtimeProvider(props: RealtimeProviderProps): ReactElement {
  const {
    url,
    session,
    client: external,
    children,
    protocols,
    reconnect,
    heartbeat,
    webSocket,
    schedule,
    random,
    onState,
  } = props;

  // The client is created lazily and kept across renders. It opens nothing
  // until a `useStream` subscribes, so an instance a concurrent render throws
  // away is inert rather than a leaked socket.
  const key = typeof url === "string" ? url : "resolver";
  const held = useRef<{ key: string; client: RealtimeClient } | null>(null);
  const latest = useRef({
    session,
    protocols,
    reconnect,
    heartbeat,
    webSocket,
    schedule,
    random,
    onState,
  });
  latest.current = {
    session,
    protocols,
    reconnect,
    heartbeat,
    webSocket,
    schedule,
    random,
    onState,
  };

  if (external === undefined && (held.current === null || held.current.key !== key)) {
    held.current?.client.close();
    const options: RealtimeClientOptions = {
      url,
      ...(session !== undefined
        ? { session }
        : { session: resolveDefaultSession() }),
      ...(protocols !== undefined ? { protocols } : {}),
      ...(reconnect !== undefined ? { reconnect } : {}),
      ...(heartbeat !== undefined ? { heartbeat } : {}),
      ...(webSocket !== undefined ? { webSocket } : {}),
      ...(schedule !== undefined ? { schedule } : {}),
      ...(random !== undefined ? { random } : {}),
      ...(onState !== undefined ? { onState } : {}),
    };
    held.current = { key, client: createRealtimeClient(options) };
  }

  const client = external ?? held.current?.client ?? null;

  useEffect(() => {
    if (external !== undefined) return undefined;
    return () => {
      // A teardown, not a tombstone — the client revives on the next
      // subscribe, so StrictMode's cleanup-then-rerun is a no-op.
      held.current?.client.close();
    };
  }, [external]);

  return createElement(RealtimeContext.Provider, { value: client }, children);
}

function resolveDefaultSession(): RealtimeSessionSeam | null {
  const manager = getActiveSessionManager();
  return manager === null ? null : sessionSeam(manager);
}

/**
 * The client from the nearest provider. Throws when there is none — a socket
 * hook that silently does nothing is the failure mode this package exists to
 * end, so it fails at the seam instead.
 */
export function useRealtimeClient(): RealtimeClient {
  const client = useContext(RealtimeContext);
  if (client === null) {
    throw new Error(
      "useRealtimeClient must be used inside <RealtimeProvider url={…}>."
    );
  }
  return client;
}

/** The client, or `null` outside a provider. For optional-realtime surfaces. */
export function useOptionalRealtimeClient(): RealtimeClient | null {
  return useContext(RealtimeContext);
}
