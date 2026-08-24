/**
 * `useRealtimeState` — the shell-level indicator.
 *
 * The point of exporting this is that `reconnecting` and `refused` are things a
 * person must SEE. A socket that quietly drops to polling looks, from the
 * outside, exactly like a working one; the whole product ran that way for
 * months. So the state is first-class, it carries the reason the server gave,
 * and it carries the resume cursors — the exact numbers the next `hello` will
 * send back, which is what turns "is it stuck?" into an answerable question.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { RealtimeState } from "../client.js";
import { useOptionalRealtimeClient } from "./RealtimeProvider.js";

const DISCONNECTED: RealtimeState = {
  state: "idle",
  connected: false,
  reconnecting: false,
  refused: false,
  refusal: undefined,
  reason: undefined,
  attempt: 0,
  cursors: {},
};

export function useRealtimeState(): RealtimeState {
  const client = useOptionalRealtimeClient();
  const subscribe = useCallback(
    (listener: () => void): (() => void) =>
      client === null ? () => undefined : client.onState(listener),
    [client]
  );
  const snapshot = useCallback(
    (): RealtimeState => (client === null ? DISCONNECTED : client.getState()),
    [client]
  );
  // Server render: there is no socket, and saying "connected" there would make
  // the first paint lie.
  return useSyncExternalStore(subscribe, snapshot, () => DISCONNECTED);
}
