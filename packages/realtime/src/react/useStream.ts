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
import { useRealtimeClient } from "./RealtimeProvider.js";

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

export function useStream(stream: string, options?: UseStreamOptions): UseStreamResult {
  const client = useRealtimeClient();
  const enabled = options?.enabled ?? true;
  const url = options?.url;

  const handlers = useRef<UseStreamOptions | undefined>(options);
  handlers.current = options;

  const subscription = useRef<RealtimeSubscription | null>(null);
  const [status, setStatus] = useState<RealtimeStreamStatus>(() =>
    client.streamStatus(stream) ?? idleStatus(stream)
  );

  useEffect(() => {
    if (!enabled) {
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
    client.reconnect();
  }, [client]);

  return { status, send, reconnect };
}
