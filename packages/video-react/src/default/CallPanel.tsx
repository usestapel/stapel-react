/**
 * `<CallPanel>` — the 1:1 call, drawn.
 *
 * This is the `renderMedia` `<CallStage>` has been waiting for: the stage owns
 * the session (load the peer, connect, disconnect) and hands over a connected
 * room; this component draws the two people in it.
 *
 * ── One remote, one local, and no grid ───────────────────────────────────
 *
 * A conference draws N tiles and has to decide which is big. A call has
 * exactly one other person, so the layout is settled: the remote fills the
 * frame and the local view is a corner picture. That is not a simplification
 * of a grid, it is a different component — which is why the meettoday Grid,
 * Stage and Participants panels are NOT ported, and why there is no speaker
 * detection here to get wrong.
 *
 * ── The timer is the SERVER's ────────────────────────────────────────────
 *
 * Anchored on `call.answered_at`, not on the moment this browser decided the
 * call was up. Two consequences that matter: both people's screens say the same
 * thing, and a reconnect does not restart the clock. A locally-started timer
 * disagrees with the "Call - 3:12" line the thread will show, and the
 * disagreement is what somebody eventually files a ticket about.
 *
 * ── What is deliberately absent ──────────────────────────────────────────
 *
 * No chat. Messaging in this fleet is stapel-chat and a call hangs off a chat
 * thread; a data-channel message box would be a second, unpersisted,
 * unmoderated message store inside the media session. The server denies
 * `can_publish_data` in the grant, so this is enforced rather than agreed.
 * Also absent: screen share, hand raise, kick, a participant list.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Typography, theme } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { connectedSeconds, formatCallClock, isAudioOnly } from "../model/calls.js";
import type { CallResponse } from "../api/types.js";
import { useAudioKeepAlive, useMediaSession, useWakeLock } from "./callHooks.js";
import { useNarrow } from "./useNarrow.js";
import type { ThemeModeProp } from "./types.js";

/**
 * The sliver of the vendor SDK this panel touches — structural, so the package
 * compiles with the optional peer absent and a host can hand in its own
 * transport object.
 */
export interface CallMediaRoom {
  readonly localParticipant?: {
    setMicrophoneEnabled?: (enabled: boolean) => Promise<unknown>;
    setCameraEnabled?: (enabled: boolean) => Promise<unknown>;
  };
  switchActiveDevice?: (kind: string, deviceId: string) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => unknown;
  off?: (event: string, handler: (...args: unknown[]) => void) => unknown;
  disconnect?: () => unknown;
}

/** How the media session is doing, as this panel reports it. */
export type CallConnectionState = "connected" | "reconnecting" | "lost";

export interface CallPanelProps extends ThemeModeProp {
  /** The connected room, from `<CallStage renderMedia>`. */
  readonly room: CallMediaRoom;
  /** The call row — the timer's anchor and the audio-only flag. */
  readonly call: CallResponse;
  /** The other person's display name. Resolved by the HOST: the wire carries
   * user ids and never names, on purpose, so erasure can pseudonymize them. */
  readonly peerName?: string;
  /** Hang up. Ends the call on the SERVER — not merely this browser's
   * connection — so the other person's screen closes too and the thread gets
   * its line. A panel that only disconnected would leave a call the meter
   * keeps counting. */
  readonly onHangup: () => void;
  /** Draw the remote media. The vendor's own track components go here; this
   * panel owns the frame, the controls and the clock. */
  readonly renderRemote?: () => ReactElement | null;
  /** Draw the local preview (the corner picture). */
  readonly renderLocal?: () => ReactElement | null;
  /** The media session's health, from the host's own subscription to the
   * vendor's connection events. Defaults to `connected`. */
  readonly connection?: CallConnectionState;
  /** Ask for a fresh media grant and reconnect — `POST /calls/{id}/token`.
   * Offered only while `connection` is not `connected`. */
  readonly onReconnect?: () => void;
  /** Video inputs, for the phone's camera flip. Two or more shows the
   * control; fewer hides it, because a button that cannot do anything is
   * worse than an absent one. */
  readonly cameras?: readonly { deviceId: string; label: string }[];
  /** Injectable clock, so the timer is testable without waiting. */
  readonly now?: () => number;
}

export function CallPanel(props: CallPanelProps): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const { ref: frameRef, narrow } = useNarrow<HTMLDivElement>();
  const {
    room,
    call,
    peerName,
    onHangup,
    renderRemote,
    renderLocal,
    connection = "connected",
    onReconnect,
    cameras = [],
  } = props;

  const audioOnly = isAudioOnly(call);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(!audioOnly);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [cameraIndex, setCameraIndex] = useState(0);

  // The three phone hooks. Active for the whole time the panel is mounted,
  // which is the whole time the call is up — every one of them protects
  // against something that happens when the person stops looking.
  const title = peerName ?? t(VIDEO_I18N_KEYS.callPeerUnknown);
  useMediaSession(true, title, t(VIDEO_I18N_KEYS.callMediaSessionArtist));
  useWakeLock(true);
  useAudioKeepAlive(narrow);

  // ── the server-anchored clock ────────────────────────────────────────────
  const now = props.now ?? Date.now;
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      tick((n) => n + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const elapsed = connectedSeconds(call, now());
  const clock = elapsed === undefined ? undefined : formatCallClock(elapsed);

  // ── the controls ────────────────────────────────────────────────────────
  //
  // Both toggles are guarded by a ref rather than by the state they set: a
  // double tap fires two handlers off the SAME stale value, and the second one
  // sets the device back to where it started while the UI says otherwise.
  const micBusy = useRef(false);
  const camBusy = useRef(false);

  const toggleMic = useCallback(async (): Promise<void> => {
    if (micBusy.current) return;
    micBusy.current = true;
    const next = !micOn;
    try {
      await room.localParticipant?.setMicrophoneEnabled?.(next);
      setMicOn(next);
      setNotice(undefined);
    } catch (thrown) {
      // Only turning something ON can be refused; turning it off cannot fail
      // in a way a person needs to hear about.
      if (next) setNotice(deviceNoticeKey(thrown, "mic"));
    } finally {
      micBusy.current = false;
    }
  }, [room, micOn]);

  const toggleCam = useCallback(async (): Promise<void> => {
    if (camBusy.current) return;
    camBusy.current = true;
    const next = !camOn;
    try {
      await room.localParticipant?.setCameraEnabled?.(next);
      setCamOn(next);
      setNotice(undefined);
    } catch (thrown) {
      if (next) setNotice(deviceNoticeKey(thrown, "cam"));
    } finally {
      camBusy.current = false;
    }
  }, [room, camOn]);

  /**
   * Flip the camera by CYCLING THE DEVICE LIST, not by swapping a
   * `facingMode` constraint.
   *
   * A constraint swap asks for a new stream and renegotiates; cycling
   * `videoinput` devices switches the one already published, which is what
   * `switchActiveDevice` is for and what meettoday does. It also degrades
   * honestly on a laptop with two webcams, where "front/back" means nothing.
   */
  const flipCamera = useCallback(async (): Promise<void> => {
    if (cameras.length < 2) return;
    const next = (cameraIndex + 1) % cameras.length;
    const device = cameras[next];
    if (device === undefined) return;
    try {
      await room.switchActiveDevice?.("videoinput", device.deviceId);
      setCameraIndex(next);
    } catch {
      setNotice(VIDEO_I18N_KEYS.callCameraSwitchFailed);
    }
  }, [cameras, cameraIndex, room]);

  const controls = useMemo(
    () => ({ toggleMic, toggleCam, flipCamera }),
    [toggleMic, toggleCam, flipCamera]
  );

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={token.paddingXS} data-testid="video-call-panel">
        <Flex
          align="center"
          justify="space-between"
          gap={token.paddingXS}
          data-testid="video-call-header"
        >
          <Typography.Text strong>{title}</Typography.Text>
          {clock !== undefined && (
            <Typography.Text
              type="secondary"
              // A clock is digits, and a screen reader announcing every tick
              // is a screen reader nobody leaves on.
              aria-hidden
              data-testid="video-call-clock"
            >
              {clock}
            </Typography.Text>
          )}
        </Flex>

        {connection !== "connected" && (
          <Flex
            align="center"
            gap={token.paddingXS}
            role="status"
            data-testid="video-call-connection"
          >
            <Typography.Text type="warning">
              {t(
                connection === "reconnecting"
                  ? VIDEO_I18N_KEYS.callReconnecting
                  : VIDEO_I18N_KEYS.callConnectionLost
              )}
            </Typography.Text>
            {onReconnect !== undefined && (
              <Button
                size="small"
                onClick={onReconnect}
                data-testid="video-call-reconnect"
                data-analytics="none"
                data-analytics-reason="re-minting a media grant is a server write the host app wraps with its own tracked()"
              >
                {t(VIDEO_I18N_KEYS.callReconnect)}
              </Button>
            )}
          </Flex>
        )}

        <div
          ref={frameRef}
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: narrow ? "3 / 4" : "16 / 9",
            background: token.colorBgLayout,
            borderRadius: token.borderRadiusLG,
            overflow: "hidden",
          }}
          data-testid="video-call-frame"
        >
          {audioOnly ? (
            // The audio-only fallback is a STATE, not a broken video. A person
            // on a bad connection who turned the camera off should see the
            // call working, not an empty rectangle they read as a failure.
            <Flex
              vertical
              align="center"
              justify="center"
              style={{ height: "100%" }}
              data-testid="video-call-audio-only"
            >
              <Typography.Text strong>{title}</Typography.Text>
              <Typography.Text type="secondary">
                {t(VIDEO_I18N_KEYS.callAudioOnly)}
              </Typography.Text>
            </Flex>
          ) : (
            renderRemote?.() ?? (
              <Flex
                align="center"
                justify="center"
                style={{ height: "100%" }}
                data-testid="video-call-remote-empty"
              >
                <Typography.Text type="secondary">
                  {t(VIDEO_I18N_KEYS.callWaitingForVideo)}
                </Typography.Text>
              </Flex>
            )
          )}

          {!audioOnly && camOn && (
            <div
              style={{
                position: "absolute",
                right: token.paddingXS,
                bottom: token.paddingXS,
                width: narrow ? 96 : 160,
                aspectRatio: "3 / 4",
                borderRadius: token.borderRadius,
                overflow: "hidden",
                background: token.colorBgContainer,
              }}
              data-testid="video-call-pip"
            >
              {renderLocal?.() ?? null}
            </div>
          )}
        </div>

        {notice !== undefined && (
          <Typography.Text
            type="warning"
            role="alert"
            data-testid="video-call-device-notice"
          >
            {t(notice)}
          </Typography.Text>
        )}

        {/* Icon controls with `aria-label` and NO tooltip. Touch has no
            hover, so a tooltip on a phone — which is where a call mostly
            happens — never appears at all; and on a disabled antd button it
            never appears anywhere, because a disabled control swallows the
            pointer events a tooltip listens for. The label is the accessible
            name; anything a person needs to READ is on the page (the device
            notice above). */}
        <Flex
          align="center"
          justify="center"
          gap={token.paddingSM}
          data-testid="video-call-controls"
        >
                      <Button
              shape="circle"
              size="large"
              type={micOn ? "default" : "primary"}
              danger={!micOn}
              aria-pressed={!micOn}
              aria-label={t(micOn ? VIDEO_I18N_KEYS.callMute : VIDEO_I18N_KEYS.callUnmute)}
              onClick={() => void controls.toggleMic()}
              data-testid="video-call-mic"
              data-analytics="none"
              data-analytics-reason="a device toggle is a client-side media action; the host app wraps it with its own tracked()"
            >
              {micOn ? "🎙" : "🔇"}
            </Button>

          {!audioOnly && (
                          <Button
                shape="circle"
                size="large"
                type={camOn ? "default" : "primary"}
                danger={!camOn}
                aria-pressed={!camOn}
                aria-label={t(
                  camOn ? VIDEO_I18N_KEYS.callCameraOff : VIDEO_I18N_KEYS.callCameraOn
                )}
                onClick={() => void controls.toggleCam()}
                data-testid="video-call-camera"
                data-analytics="none"
                data-analytics-reason="a device toggle is a client-side media action"
              >
                {camOn ? "📷" : "🚫"}
              </Button>
          )}

          {!audioOnly && cameras.length > 1 && (
                          <Button
                shape="circle"
                size="large"
                aria-label={t(VIDEO_I18N_KEYS.callFlipCamera)}
                onClick={() => void controls.flipCamera()}
                data-testid="video-call-flip"
                data-analytics="none"
                data-analytics-reason="a device switch is a client-side media action"
              >
                🔄
              </Button>
          )}

                      <Button
              shape="circle"
              size="large"
              danger
              type="primary"
              aria-label={t(VIDEO_I18N_KEYS.callHangUp)}
              onClick={onHangup}
              data-testid="video-call-hangup"
              data-analytics="none"
              data-analytics-reason="ending a call is a server write the host wraps with its own tracked()"
            >
              📵
            </Button>
        </Flex>
      </Flex>
    </SkinTheme>
  );
}

/**
 * Which sentence a refused device gets.
 *
 * A permission denial and a device that is simply unavailable need different
 * copy: one is fixed in the browser's site settings and the other is fixed by
 * plugging something in or closing the app that holds it. Read off the
 * DOMException's `name`, the way `livekit-client`'s own `MediaDeviceFailure`
 * classifier does, because the message text is not stable across engines.
 */
function deviceNoticeKey(thrown: unknown, kind: "mic" | "cam"): string {
  const name = (thrown as { name?: unknown } | null | undefined)?.name;
  const denied = name === "NotAllowedError" || name === "SecurityError";
  if (kind === "mic") {
    return denied ? VIDEO_I18N_KEYS.callMicBlocked : VIDEO_I18N_KEYS.callMicFailed;
  }
  return denied ? VIDEO_I18N_KEYS.callCameraBlocked : VIDEO_I18N_KEYS.callCameraFailed;
}
