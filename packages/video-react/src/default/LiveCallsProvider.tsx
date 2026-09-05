/**
 * `<LiveCallsProvider>` — `<CallsProvider>` with the socket attached.
 *
 * The headless provider imports no socket package, exactly as the lobby model
 * does not: `@stapel/realtime` is the fleet's one reconnect and close-code
 * runtime, and it lives on this side of the entry boundary so a host that
 * only reads usage never carries it. This component is the two halves joined.
 *
 * ── Why the client is used imperatively and not through `useStream` ──────
 *
 * `useStream` is built for a component that RENDERS a stream's status — the
 * lobby's liveness bar is exactly that. This provider renders nothing and
 * needs one thing the hook does not surface as an event: the moment a socket
 * comes BACK. `client.subscribe` gives state transitions directly, so
 * "reconnected" is a transition into `live` from something that was not, which
 * is the signal the whole repair hangs on.
 *
 * ── The reconnect repair, stated once ────────────────────────────────────
 *
 * A socket that was away missed whatever happened while it was away. If the
 * call ended in that window, this browser is showing a ring for a call that is
 * over; if one started, it never rang. Re-reading `GET /calls/active` on every
 * return is the only thing that turns either into a two-second wrongness
 * instead of a permanent one — and it is why the provider takes
 * `onReconnected` rather than only `onFrame`.
 */
import { useCallback } from "react";
import type { ReactElement } from "react";
import { useOptionalRealtimeClient } from "@stapel/realtime/react";
import type { RealtimeFrame, RealtimeStreamStatus } from "@stapel/realtime";
import { CallsProvider } from "../headless/CallsProvider.js";
import type { CallsProviderProps } from "../headless/CallsProvider.js";

export type LiveCallsProviderProps = Omit<CallsProviderProps, "subscribe">;

export function LiveCallsProvider(props: LiveCallsProviderProps): ReactElement {
  const client = useOptionalRealtimeClient();

  const subscribe = useCallback<NonNullable<CallsProviderProps["subscribe"]>>(
    ({ streamKey, url, onFrame, onReconnected }) => {
      // No client and no url are the SAME outcome — REST-only — and it is a
      // supported deployment, not a misconfiguration to warn about: an
      // HTTP-only host still receives calls, just on the next read.
      if (client === null || url === undefined) return () => undefined;

      // "Was live, is live again" is the transition worth reacting to. A
      // subscription that has never been live yet is not reconnecting, it is
      // connecting — and firing the repair for it would put a redundant read
      // on every page load on top of the one the provider already does.
      let everLive = false;
      const handle = client.subscribe(streamKey, {
        url,
        onFrame: (frame: RealtimeFrame) => {
          onFrame({ type: frame.type, payload: frame.payload ?? {} });
        },
        onState: (status: RealtimeStreamStatus) => {
          if (status.state === "live") {
            if (everLive) onReconnected();
            everLive = true;
          }
        },
      });
      return () => {
        handle.close();
      };
    },
    [client]
  );

  return <CallsProvider {...props} subscribe={subscribe} />;
}
