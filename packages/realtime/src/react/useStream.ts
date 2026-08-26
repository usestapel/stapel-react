/**
 * `useStream` — one component's subscription to one stream key.
 *
 * The stream key is the module's own (`chat:conv:<uuid>`,
 * `recordings:ws:<uuid>`), and it is what the server puts in `envelope.stream`,
 * so routing needs no local invention. Chat's REST rows hand you both halves
 * already: `stream_key` and `socket_path`.
 *
 * Callbacks are held in refs and read at delivery time, so passing an inline
 * `onFrame` does NOT tear the subscription down and replay the whole journal on
 * every render — the resubscribe cost of a naive dependency array is a full
 * replay per keystroke.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeFrame } from "../frames.js";
import type { RealtimeStreamStatus, RealtimeSubscription } from "../client.js";
import { useOptionalRealtimeClient } from "./RealtimeProvider.js";

const NO_PROVIDER =
  "useStream must be used inside <RealtimeProvider url={…}>. " +
  "Pass { optional: true } to render `status.state === \"no_provider\"` instead.";

export interface UseStreamOptions {
  /** Override the provider's URL resolution for this stream. */
  readonly url?: string;
  /**
   * The highest ENVELOPE seq the consumer holds, read afresh at every connect.
   * Never a `payload.seq`: a resume filtered on the ordering key silently drops
   * every edit and every tombstone that landed while the socket was down.
   */
  readonly lastSeq?: () => number;
  /** Every frame for this stream, protocol and signal alike, in wire order. */
  readonly onFrame?: (frame: RealtimeFrame) => void;
  /** State transitions (`connecting` → `replaying` → `live`, `resync`, …). */
  readonly onState?: (status: RealtimeStreamStatus) => void;
  /** `false` unsubscribes without unmounting (a closed panel, a hidden tab). */
  readonly enabled?: boolean;
  /**
   * Report a missing `<RealtimeProvider>` as `status.state === "no_provider"`
   * instead of throwing.
   *
   * The throw is the default on purpose — a socket hook that silently does
   * nothing is the failure this package exists to end. But a surface that is
   * *optionally* live (a widget dropped into a host that may not have wired
   * realtime up at all) needs to SAY that, and "no provider" is a different
   * sentence from every socket state: nothing is retrying, nothing is
   * refused, and no amount of waiting will change it. A skin that renders it
   * as `reconnecting` is inventing a socket that does not exist.
   */
  readonly optional?: boolean;
}

/**
 * What `useStream(key, { optional: true })` reports when there is no
 * `<RealtimeProvider>` above it.
 *
 * It is a SEPARATE type from {@link RealtimeStreamStatus}, not an extra member
 * of `RealtimeStreamState`, and the difference is the whole point: nothing is
 * connecting, nothing is retrying, nothing was refused, and no retry button
 * will help. A skin that folded this into a socket state would render
 * "reconnecting…" for a page that never had a socket — which is the exact
 * sentence this package exists to stop people writing. The compiler enforces
 * the distinction: this shape is not assignable to `RealtimeStreamStatus`.
 */
export interface NoProviderStatus {
  readonly stream: string;
  readonly state: "no_provider";
  readonly refusal: undefined;
  readonly reason: undefined;
  readonly attempt: 0;
  readonly cursor: 0;
  readonly gap: undefined;
  readonly serverSeq: undefined;
}

export interface UseStreamResult {
  readonly status: RealtimeStreamStatus;
  /**
   * Send a client frame on this stream — the documented legacy write seam
   * (chat's `send`/`edit`/`delete`/`read`/`delivered`/`activity`). Everything
   * else writes over REST. `false` when no socket is open.
   */
  readonly send: (type: string, payload?: Readonly<Record<string, unknown>>) => boolean;
  /** Retry now: clears refusals and reconnects. The button beside a refusal. */
  readonly reconnect: () => void;
}

/** {@link UseStreamResult} for `{ optional: true }`: the status may be absent. */
export interface UseStreamOptionalResult extends Omit<UseStreamResult, "status"> {
  readonly status: RealtimeStreamStatus | NoProviderStatus;
}

function idleStatus(stream: string): RealtimeStreamStatus {
  return {
    stream,
    state: "idle",
    refusal: undefined,
    reason: undefined,
    attempt: 0,
    cursor: 0,
    gap: undefined,
    serverSeq: undefined,
  };
}

function noProviderStatus(stream: string): NoProviderStatus {
  return {
    stream,
    state: "no_provider",
    refusal: undefined,
    reason: undefined,
    attempt: 0,
    cursor: 0,
    gap: undefined,
    serverSeq: undefined,
  };
}

export function useStream(
  stream: string,
  options: UseStreamOptions & { readonly optional: true }
): UseStreamOptionalResult;
export function useStream(stream: string, options?: UseStreamOptions): UseStreamResult;
export function useStream(
  stream: string,
  options?: UseStreamOptions
): UseStreamOptionalResult {
  const client = useOptionalRealtimeClient();
  // No provider means no subscription to make — the hooks below still all run,
  // in the same order, so the tree stays legal while the surface reports why
  // it is not live.
  const enabled = (options?.enabled ?? true) && client !== null;
  const url = options?.url;

  const handlers = useRef<UseStreamOptions | undefined>(options);
  handlers.current = options;

  const subscription = useRef<RealtimeSubscription | null>(null);
  const [status, setStatus] = useState<RealtimeStreamStatus>(
    () => client?.streamStatus(stream) ?? idleStatus(stream)
  );

  useEffect(() => {
    if (!enabled || client === null) {
      setStatus(idleStatus(stream));
      return undefined;
    }
    const handle = client.subscribe(stream, {
      ...(url !== undefined ? { url } : {}),
      lastSeq: () => handlers.current?.lastSeq?.() ?? 0,
      onFrame: (frame) => {
        handlers.current?.onFrame?.(frame);
      },
      onState: (next) => {
        setStatus(next);
        handlers.current?.onState?.(next);
      },
    });
    subscription.current = handle;
    setStatus(handle.status());
    return () => {
      subscription.current = null;
      handle.close();
    };
  }, [client, stream, url, enabled]);

  const send = useCallback(
    (type: string, payload?: Readonly<Record<string, unknown>>): boolean =>
      subscription.current?.send(type, payload) ?? false,
    []
  );
  const reconnect = useCallback((): void => {
    client?.reconnect();
  }, [client]);

  if (client === null) {
    // After every hook, so the throw cannot change hook order on the render
    // that precedes it.
    if (options?.optional !== true) throw new Error(NO_PROVIDER);
    return { status: noProviderStatus(stream), send: () => false, reconnect };
  }
  return { status, send, reconnect };
}
