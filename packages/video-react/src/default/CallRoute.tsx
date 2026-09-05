/**
 * `<CallRoute>` — the whole in-call screen, for a host that just wants one.
 *
 * `<CallsProvider>` holds the call and the grant; `<CallStage>` owns the media
 * session; `<CallPanel>` draws it. Wiring those three together is four lines
 * every host would write identically, and getting one of them wrong is a call
 * that connects with no picture. So it is written once, here.
 *
 * ── An overlay, not a route, despite the name ────────────────────────────
 *
 * It renders above whatever page is underneath and renders NOTHING when no
 * call is connected. Someone taking a call about a bicycle should not lose the
 * search results they were reading — a navigation would, and coming back to a
 * list scrolled to the top is the small daily cost of treating a call as a
 * page. The name says "route" because that is the slot in a host's app this
 * fills; the mechanism is deliberately not one.
 *
 * A host that DOES want a dedicated URL renders `<CallPanel>` itself and reads
 * the call from `useCalls()`. Nothing here is load-bearing for that.
 */
import type { ReactElement, ReactNode } from "react";
import { theme } from "antd";
import { useCalls } from "../headless/CallsProvider.js";
import { CallStage } from "./CallStage.js";
import type { CallRoomLike } from "./CallStage.js";
import { CallPanel } from "./CallPanel.js";
import type {
  CallMediaRoom,
  CallConnectionState,
  RemoteMediaContext,
} from "./CallPanel.js";
import type { ThemeModeProp } from "./types.js";

export interface CallRouteProps extends ThemeModeProp {
  /** The other person's name — the host's, since the wire carries only ids. */
  readonly nameFor?: (userId: string) => string;
  /**
   * Draw the remote media from the connected room. The vendor's own track
   * components go here; everything around them is `<CallPanel>`'s.
   *
   * Called on an AUDIO-ONLY call too — the context says so — and what comes
   * back is mounted off-screen behind the audio-only card, because a remote
   * audio track needs an element to attach to. See
   * `CallPanelProps.renderRemote`.
   */
  readonly renderRemote?: (
    room: CallMediaRoom,
    context: RemoteMediaContext
  ) => ReactNode;
  /** Draw the local preview. */
  readonly renderLocal?: (room: CallMediaRoom) => ReactNode;
  /** Video inputs for the camera flip, enumerated by the host (asking for
   * them is a permission prompt, and a library must not spring one). */
  readonly cameras?: readonly { deviceId: string; label: string }[];
  /** The media session's health, from the host's own subscription to the
   * vendor's connection events. */
  readonly connection?: CallConnectionState;
}

export function CallRoute(props: CallRouteProps): ReactElement | null {
  const { token } = theme.useToken();
  const calls = useCalls();
  const { nameFor, renderRemote, renderLocal, cameras, connection } = props;

  const call = calls.call;
  const grant = calls.grant;
  // `connected` AND a grant: the state says the server thinks the call is up,
  // the grant says THIS browser has a credential for it. A tab that learned
  // about the call from a frame has the former and not the latter, and
  // rendering a stage with no token would show it a "no token" screen for
  // somebody else's connection.
  if (!calls.connected || call === undefined || grant === undefined) return null;

  const peerName =
    calls.peerId !== undefined ? nameFor?.(calls.peerId) : undefined;

  return (
    <div
      data-testid="video-call-route"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: token.colorBgContainer,
        padding: token.padding,
        overflow: "auto",
      }}
    >
      <CallStage
        token={grant.token}
        serverUrl={grant.url}
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        // `<CallStage>`'s own Leave disconnects this browser. A call has to end
        // on the SERVER — the other person's screen closes, the meter stops,
        // the thread gets its line — so both paths go through the provider's
        // hangup rather than through the stage's local disconnect.
        onLeave={() => void calls.hangup()}
        renderMedia={(room: CallRoomLike) => (
          <CallPanel
            room={room as CallMediaRoom}
            call={call}
            {...(peerName !== undefined ? { peerName } : {})}
            {...(props.mode !== undefined ? { mode: props.mode } : {})}
            {...(cameras !== undefined ? { cameras } : {})}
            {...(connection !== undefined ? { connection } : {})}
            onHangup={() => void calls.hangup()}
            onReconnect={() => void calls.remint()}
            {...(renderRemote !== undefined
              ? {
                  renderRemote: (context: RemoteMediaContext) => (
                    <>{renderRemote(room as CallMediaRoom, context)}</>
                  ),
                }
              : {})}
            {...(renderLocal !== undefined
              ? { renderLocal: () => <>{renderLocal(room as CallMediaRoom)}</> }
              : {})}
          />
        )}
      />
    </div>
  );
}
