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
 *
 * ── THE SESSION IS LATCHED, and that is the whole point of this file ──────
 *
 * This component used to mount the stage off a live conjunction —
 * `connected && call !== undefined && grant !== undefined` — evaluated on
 * every render. Unmounting the stage DISCONNECTS THE ROOM (that is its
 * cleanup, and rightly so), so any single frame in which one of those three
 * went momentarily false tore down a working call: an in-flight
 * `GET /calls/active` answering `{call: null}` between two truths, a sibling
 * tab posting `resolved` for the ring this browser had just answered, a
 * `connected` that follows the row rather than the socket. None of those is an
 * END. They are blips in a read, and a media session is far too expensive to
 * spend on one.
 *
 * So the session is LATCHED BY `call.id`: it opens the first frame the
 * conjunction is true, holds the token, the url and the last call row it saw
 * for that id, and survives every later frame that merely fails to confirm
 * it. What closes it is an END — the provider withdrawing the grant, which is
 * exactly `decline` / `hangup` / `call.ended` — or a DIFFERENT call becoming
 * this browser's live one. The grant is the credential for one call and the
 * provider now binds it to that call's id, so "the grant is gone" is a
 * statement about this session and nothing else.
 */
import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { theme } from "antd";
import type { CallResponse } from "../api/types.js";
import { useCalls } from "../headless/CallsProvider.js";
import { CallStage } from "./CallStage.js";
import type { CallPeerLoader, CallRoomLike } from "./CallStage.js";
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
  /**
   * Publish this browser's microphone (and camera) when the panel mounts —
   * `<CallPanel autoPublish>`, forwarded. Default `true`, there and here.
   *
   * It is here for the same reason `loadPeer` is: this route MOUNTS the
   * panel, so a host that publishes from its own pre-call device picker could
   * set `autoPublish={false}` on a `<CallPanel>` it does not render and had no
   * way to reach the one this component does. A prop that exists only on the
   * component nobody mounts is a prop nobody has.
   */
  readonly autoPublish?: boolean;
  /**
   * Replace the built-in `import("livekit-client")` — `<CallStage loadPeer>`,
   * forwarded.
   *
   * It is here because this route MOUNTS the stage: a host whose build must
   * not see the specifier, or whose tests drive the arms without the SDK,
   * could set it on `<CallStage>` and had no way to reach the one this
   * component renders. A prop that exists only on the component nobody mounts
   * is a prop nobody has.
   */
  readonly loadPeer?: CallPeerLoader;
}

/**
 * The call this browser is IN, held across the frames that fail to confirm it.
 *
 * `call` is the last row seen for `id` rather than the live one, so the panel
 * keeps its clock and its audio-only flag through a blip instead of being
 * handed `undefined` and unmounting.
 */
interface LatchedSession {
  readonly id: string;
  readonly token: string;
  readonly url: string;
  readonly call: CallResponse;
  readonly peerId: string | undefined;
}

export function CallRoute(props: CallRouteProps): ReactElement | null {
  const { token } = theme.useToken();
  const calls = useCalls();
  const { nameFor, renderRemote, renderLocal, cameras, connection } = props;

  const [session, setSession] = useState<LatchedSession | undefined>(undefined);

  const live = calls.call;
  const grant = calls.grant;
  const connected = calls.connected;
  const peerId = calls.peerId;

  useEffect(() => {
    // WITHDRAWN. The provider clears the grant on decline, on hangup, and on
    // the server's `call.ended` — and, since it binds a grant to the call it
    // was minted for, on nothing else. That is the end of this session.
    if (grant === undefined) {
      setSession(undefined);
      return;
    }
    if (connected && live !== undefined) {
      const id = String(live.id);
      setSession((current) =>
        current !== undefined &&
        current.id === id &&
        current.call === live &&
        current.token === grant.token &&
        current.url === grant.url &&
        current.peerId === peerId
          ? current
          : { id, token: grant.token, url: grant.url, call: live, peerId }
      );
      return;
    }
    if (live !== undefined) {
      // A live call that is NOT the latched one: this browser moved on, so
      // the old session is over whatever the old row still says.
      setSession((current) =>
        current !== undefined && current.id !== String(live.id)
          ? undefined
          : current
      );
      return;
    }
    // No call in hand and the grant still held: a read in flight, a frame not
    // yet arrived. A blip, not an end — hold what we have.
  }, [connected, live, grant, peerId]);

  if (session === undefined) return null;

  const call = session.call;
  const peerName =
    session.peerId !== undefined ? nameFor?.(session.peerId) : undefined;

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
        token={session.token}
        serverUrl={session.url}
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        {...(props.loadPeer !== undefined ? { loadPeer: props.loadPeer } : {})}
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
            {...(props.autoPublish !== undefined
              ? { autoPublish: props.autoPublish }
              : {})}
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
