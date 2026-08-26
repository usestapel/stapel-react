/**
 * `useRealtimeState` — the shell-level indicator.
 *
 * The point of exporting this is that `reconnecting` and `refused` are things a
 * person must SEE. A socket that quietly drops to polling looks, from the
 * outside, exactly like a working one; the whole product ran that way for
 * months. So the state is first-class, it carries the reason the server gave,
 * and it carries the resume cursors — the exact numbers the next `hello` will
 * send back, which is what turns "is it stuck?" into an answerable question.
 *
 * `degradation` is the same argument taken one step further: a spinner that
 * has been spinning since the deployment went out is not a spinner, and this
 * hook hands a skin the NAME for that — `never_connected`, `reconnecting_long`
 * or `refused` — so it can say "live updates unavailable — polling" instead of
 * "reconnecting…" forever. See {@link RealtimeDegradation}.
 *
 * `refreshing` is the one moment the state is honestly undecided: a 4401 sent
 * the session through core's single-flight refresh and the answer has not
 * landed. It names the question, never an outcome — debounce on its `since`
 * rather than rendering the socket as broken while the answer is on the wire.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { RealtimeState } from "../client.js";
import { useOptionalRealtimeClient } from "./RealtimeProvider.js";

/**
 * No provider and no server render have anything to report: `idle`, not
 * degraded. A shell that has not mounted a provider yet must not accuse the
 * deployment of being broken — the hook that names THAT case is
 * `useStream(stream, { optional: true })`, which says `no_provider`.
 */
const DISCONNECTED: RealtimeState = {
  state: "idle",
  connected: false,
  reconnecting: false,
  refused: false,
  refusal: undefined,
  reason: undefined,
  attempt: 0,
  cursors: {},
  everConnected: false,
  firstAttemptAt: undefined,
  lastOpenAt: undefined,
  degradation: null,
  refreshing: null,
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
