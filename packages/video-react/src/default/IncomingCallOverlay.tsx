/**
 * `<IncomingCallOverlay>` — the ring, on every page.
 *
 * Mounted once beside `<CallsProvider>`, at the app root. It draws two states
 * of the same object and nothing else:
 *
 *  - **incoming** — somebody is ringing this person. Full-screen on a phone,
 *    a card on a desktop. Accept / decline.
 *  - **outgoing** — this person is ringing somebody. The same frame in a
 *    "calling" state, with a cancel.
 *
 * One component for both because it is one call: the caller's screen and the
 * callee's screen have to close on the same event, and two components would be
 * two chances for one of them not to.
 *
 * ── Full-screen on a phone is not a size preference ──────────────────────
 *
 * A card on a phone competes with the page under it for the tap that answers
 * the call, and the answer tap is the one that must not miss. Measured on the
 * ELEMENT the way the rest of this package does, so a desktop host that mounts
 * this inside a narrow column gets the phone treatment — which is correct,
 * because the constraint is the width, not the device.
 *
 * ── The countdown is the SERVER's ────────────────────────────────────────
 *
 * `remainingMs` comes from the provider, computed against `expires_at`. This
 * component renders it and never starts its own clock: a ring that begins
 * counting when the frame arrived is late by the delivery latency, and the
 * visible defect is an overlay that outlives the call it announces.
 */
import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { Avatar, Button, Card, Flex, Typography, theme } from "antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { useIncomingCall } from "../headless/CallsProvider.js";
import { isAudioOnly } from "../model/calls.js";
import { useNarrow } from "./useNarrow.js";
import { armAudioPlayback, useRingtone } from "./useRingtone.js";
import type { ThemeModeProp } from "./types.js";

export interface IncomingCallOverlayProps extends ThemeModeProp {
  /** The other person's display name, resolved by the host from the id the
   * provider exposes as `peerId`. The wire never carries a name. */
  readonly nameFor?: (userId: string) => ReactNode;
  /** Their picture, likewise the host's. */
  readonly avatarFor?: (userId: string) => string | undefined;
  /** What the call is ABOUT — the listing, the order, whatever the thread's
   * subject is. A slot rather than a string, because only the host can turn a
   * `thread_key` into a subject, and a ring that says only "Anna is calling"
   * gives a seller no idea which of forty conversations this is. */
  readonly renderSubject?: (threadKey: string) => ReactNode;
  /** The ringtone. Absent = a silent ring, which is a working ring. */
  readonly ringtoneSrc?: string;
  /**
   * Full frame or a corner card. Default `"auto"` — MEASURED, on the element,
   * the way everything else in this package decides a layout: the constraint
   * is the width, not the device, so a desktop host that mounts this inside a
   * narrow column gets the phone treatment and is right to.
   *
   * The override exists for the host that already knows. A shell that renders
   * a phone app in a desktop chrome, a demo that has to show both — those know
   * something the measurement cannot, and forcing them to fake a viewport to
   * get the layout they mean is how a component ends up measured in three
   * places.
   */
  readonly variant?: "auto" | "fullscreen" | "card";
}

export function IncomingCallOverlay(
  props: IncomingCallOverlayProps
): ReactElement | null {
  const t = useT();
  const { token } = theme.useToken();
  const { ref, narrow: measured } = useNarrow<HTMLDivElement>();
  const ring = useIncomingCall();
  const { nameFor, avatarFor, renderSubject, ringtoneSrc } = props;
  const variant = props.variant ?? "auto";
  const narrow = variant === "auto" ? measured : variant === "fullscreen";

  // Only ONE tab makes a sound; every tab shows the overlay. `ringsAloud` is
  // the provider's cross-tab claim, and passing it straight through is what
  // keeps the arbitration in one place instead of in every skin.
  useRingtone(
    ring.incoming && ring.ringsAloud,
    ringtoneSrc !== undefined ? { src: ringtoneSrc } : undefined
  );

  // A ring that ends should stop the sound immediately rather than on the next
  // render, and a browser that was never unlocked should get its one chance at
  // the accept tap. Both are one ref away from being forgotten.
  const armed = useRef(false);
  useEffect(() => {
    if (!ring.incoming) armed.current = false;
  }, [ring.incoming]);

  if (!ring.incoming && !ring.outgoing) return null;
  const call = ring.call;
  if (call === undefined) return null;

  const peerId = ring.peerId;
  const name =
    (peerId !== undefined ? nameFor?.(peerId) : undefined) ??
    peerId ??
    t(VIDEO_I18N_KEYS.callPeerUnknown);
  const avatar = peerId !== undefined ? avatarFor?.(peerId) : undefined;
  const seconds =
    ring.remainingMs === undefined ? undefined : Math.ceil(ring.remainingMs / 1000);

  const body = (
    <Flex vertical gap={token.padding} align="center" data-testid="video-ring-body">
      <Avatar
        size={narrow ? 96 : 64}
        {...(avatar !== undefined ? { src: avatar } : {})}
        data-testid="video-ring-avatar"
      >
        {typeof name === "string" ? name.slice(0, 1).toUpperCase() : null}
      </Avatar>

      <Flex vertical align="center" gap={spacing[1]}>
        <Typography.Title level={narrow ? 3 : 5} style={{ margin: 0 }}>
          {name}
        </Typography.Title>
        <Typography.Text type="secondary" data-testid="video-ring-state">
          {t(
            ring.incoming
              ? isAudioOnly(call)
                ? VIDEO_I18N_KEYS.callIncomingAudio
                : VIDEO_I18N_KEYS.callIncomingVideo
              : VIDEO_I18N_KEYS.callOutgoing
          )}
        </Typography.Text>
        {call.thread_key.length > 0 && renderSubject !== undefined && (
          <div data-testid="video-ring-subject">{renderSubject(call.thread_key)}</div>
        )}
        {seconds !== undefined && (
          <Typography.Text
            type="secondary"
            aria-hidden
            data-testid="video-ring-countdown"
          >
            {String(seconds)}
          </Typography.Text>
        )}
      </Flex>

      <Flex gap={token.padding} data-testid="video-ring-actions">
        {ring.incoming ? (
          <>
            <Button
              danger
              size="large"
              shape={narrow ? "circle" : "default"}
              onClick={() => void ring.decline()}
              data-testid="video-ring-decline"
              data-analytics="none"
              data-analytics-reason="answering a call is a server write the host wraps with its own tracked()"
              aria-label={t(VIDEO_I18N_KEYS.callDecline)}
            >
              {narrow ? "📵" : t(VIDEO_I18N_KEYS.callDecline)}
            </Button>
            <Button
              type="primary"
              size="large"
              shape={narrow ? "circle" : "default"}
              onClick={() => {
                // The accept tap is this page's first real gesture in the
                // common case. Unlock audio inside it, or the call's own
                // remote track can arrive to a muted output on the strictest
                // engines — a call that "connects with no sound".
                if (!armed.current) {
                  armed.current = true;
                  armAudioPlayback();
                }
                void ring.accept();
              }}
              data-testid="video-ring-accept"
              data-analytics="none"
              data-analytics-reason="answering a call is a server write the host wraps with its own tracked()"
              aria-label={t(VIDEO_I18N_KEYS.callAccept)}
            >
              {narrow ? "📞" : t(VIDEO_I18N_KEYS.callAccept)}
            </Button>
          </>
        ) : (
          <Button
            danger
            size="large"
            onClick={() => void ring.cancel()}
            data-testid="video-ring-cancel"
            data-analytics="none"
            data-analytics-reason="cancelling a call is a server write the host wraps with its own tracked()"
          >
            {t(VIDEO_I18N_KEYS.callCancel)}
          </Button>
        )}
      </Flex>
    </Flex>
  );

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-live="assertive"
        aria-label={t(
          ring.incoming
            ? VIDEO_I18N_KEYS.callIncomingTitle
            : VIDEO_I18N_KEYS.callOutgoing
        )}
        data-testid="video-ring-overlay"
        data-variant={narrow ? "fullscreen" : "card"}
        style={
          narrow
            ? {
                position: "fixed",
                inset: 0,
                zIndex: 1200,
                background: token.colorBgContainer,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: token.paddingLG,
              }
            : {
                position: "fixed",
                top: token.paddingLG,
                right: token.paddingLG,
                zIndex: 1200,
                maxWidth: 360,
              }
        }
      >
        {narrow ? body : <Card styles={{ body: { padding: token.paddingLG } }}>{body}</Card>}
      </div>
    </SkinTheme>
  );
}
