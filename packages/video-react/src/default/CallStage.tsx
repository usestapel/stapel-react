/**
 * `<CallStage>` — the media session, behind an OPTIONAL peer.
 *
 * Everything else in this pair is JSON a browser can always make: the room,
 * the lobby, the verdicts, the token. The call itself is a vendor SDK with a
 * WebRTC stack inside it, and forcing every host that wants a usage report to
 * carry it would be the wrong trade. So `livekit-client` is declared as an
 * OPTIONAL peer, loaded by `import()` at the moment a token exists, and its
 * ABSENCE is a designed screen — a sentence naming the package and the slot,
 * not a stack trace and not a blank rectangle.
 *
 * The specifier is held in a `string`-typed constant on purpose: a literal
 * would make TypeScript resolve a module that is deliberately not installed,
 * and the point of an optional peer is that the build works without it.
 *
 * ── What this component does NOT decide ──────────────────────────────────
 *
 * How a call LOOKS — tiles, speaker view, the mute row — is a product's
 * design, not a library's. This component owns the session (connect, report,
 * disconnect) and hands the drawing to `renderMedia`; unfilled, that is a
 * `SlotPlaceholder`, so a developer sees a named gap in dev and a host's
 * customers see the session state rather than a mystery. A host that wants to
 * own the whole thing replaces this component through `<MeetingPane
 * renderCallStage>`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Flex, Typography, theme } from "antd";
import { SlotPlaceholder, useT } from "@stapel/core";
import { EmptyState, ErrorAlert, SkinTheme } from "@stapel/tokens-antd/skin";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

/** The optional peer this stage draws a call with. */
export const LIVEKIT_PEER = "livekit-client";

/** Typed as `string` so TypeScript treats the `import()` below as dynamic and
 * does not try to resolve a package that may not be installed. */
const LIVEKIT_SPECIFIER: string = LIVEKIT_PEER;

/** The sliver of the vendor SDK this component touches. */
export interface CallRoomLike {
  connect(serverUrl: string, token: string): Promise<unknown>;
  disconnect(): unknown;
}

interface CallModuleLike {
  readonly Room?: new () => CallRoomLike;
}

/** Load the optional peer. Injectable so a test drives every arm — including
 * the one where the package is not there — without installing it. */
export type CallPeerLoader = () => Promise<unknown>;

const defaultLoader: CallPeerLoader = () => import(LIVEKIT_SPECIFIER);

/** Where the session got to. `missing` is a first-class arm, not an error. */
export type CallStageState =
  | "idle"
  | "loading"
  | "missing"
  | "connecting"
  | "connected"
  | "failed";

export interface CallStageProps extends ThemeModeProp {
  /** The provider token from the join grant. Absent means "not admitted yet",
   * which is a sentence, not a failure. */
  readonly token?: string | undefined;
  /** The media server the token is for. Host-supplied: a library cannot guess
   * a deployment's SFU address. */
  readonly serverUrl?: string | undefined;
  /** Draw the call. Unfilled, a `SlotPlaceholder` names the gap in dev. */
  readonly renderMedia?: (room: CallRoomLike) => ReactNode;
  /** Called when the person leaves the call from here. */
  readonly onLeave?: () => void;
  /** Test seam: replaces the `import("livekit-client")`. */
  readonly loadPeer?: CallPeerLoader;
}

/** Is this thrown value "the optional peer is not installed"? Bundlers and
 * runtimes each phrase it differently; all of them say the specifier. */
function isPeerMissing(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes(LIVEKIT_PEER) &&
    /cannot find|not resolve|failed to resolve|not found/i.test(message)
  );
}

export function CallStage(props: CallStageProps): ReactElement {
  const t = useT();
  const { token: themeToken } = theme.useToken();
  const { token, serverUrl, renderMedia, onLeave } = props;
  const loadPeer = props.loadPeer ?? defaultLoader;

  const [state, setState] = useState<CallStageState>("idle");
  const [error, setError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  const roomRef = useRef<CallRoomLike | null>(null);
  const [room, setRoom] = useState<CallRoomLike | null>(null);

  const ready = token !== undefined && token.length > 0 && serverUrl !== undefined && serverUrl.length > 0;

  useEffect(() => {
    if (!ready) {
      setState("idle");
      return undefined;
    }
    let cancelled = false;
    setError(undefined);
    setState("loading");
    void (async (): Promise<void> => {
      try {
        const loaded = (await loadPeer()) as CallModuleLike | undefined;
        const RoomCtor = loaded?.Room;
        if (typeof RoomCtor !== "function") {
          if (!cancelled) setState("missing");
          return;
        }
        const next = new RoomCtor();
        roomRef.current = next;
        if (!cancelled) {
          setRoom(next);
          setState("connecting");
        }
        await next.connect(serverUrl as string, token as string);
        if (!cancelled) setState("connected");
      } catch (thrown) {
        if (cancelled) return;
        if (isPeerMissing(thrown)) {
          setState("missing");
          return;
        }
        setError(thrown);
        setState("failed");
      }
    })();
    return () => {
      cancelled = true;
      const held = roomRef.current;
      roomRef.current = null;
      if (held !== null) held.disconnect();
    };
  }, [ready, token, serverUrl, loadPeer, attempt]);

  const retry = useCallback((): void => {
    setAttempt((n) => n + 1);
  }, []);

  const leave = useCallback((): void => {
    const held = roomRef.current;
    roomRef.current = null;
    if (held !== null) held.disconnect();
    setRoom(null);
    setState("idle");
    onLeave?.();
  }, [onLeave]);

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={themeToken.paddingXS} data-testid="video-stage">
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t(VIDEO_I18N_KEYS.stageHeading)}
        </Typography.Title>
        {renderBody()}
      </Flex>
    </SkinTheme>
  );

  function renderBody(): ReactElement {
    if (token === undefined || token.length === 0) {
      return (
        <EmptyState
          compact
          testId="video-stage-no-token"
          title={t(VIDEO_I18N_KEYS.stageNoToken)}
          hint={t(VIDEO_I18N_KEYS.stageNoTokenHint)}
        />
      );
    }
    if (serverUrl === undefined || serverUrl.length === 0) {
      return (
        <EmptyState
          compact
          testId="video-stage-no-server"
          title={t(VIDEO_I18N_KEYS.stageNoServer)}
        />
      );
    }
    if (state === "missing") {
      return (
        <EmptyState
          testId="video-stage-no-peer"
          title={t(VIDEO_I18N_KEYS.stageNoPeer)}
          hint={t(VIDEO_I18N_KEYS.stageNoPeerHint)}
        />
      );
    }
    if (state === "failed") {
      return (
        <ErrorAlert
          testId="video-stage-failed"
          thrown={error}
          message={t(VIDEO_I18N_KEYS.stageFailed)}
          onRetry={retry}
          retryLabel={t(VIDEO_I18N_KEYS.stageRetry)}
        />
      );
    }
    if (state === "connected") {
      return (
        <Flex vertical gap={themeToken.paddingXS} data-testid="video-stage-connected">
          <Typography.Text>{t(VIDEO_I18N_KEYS.stageConnected)}</Typography.Text>
          {room !== null && renderMedia !== undefined ? (
            renderMedia(room)
          ) : (
            <SlotPlaceholder name="renderMedia" data-testid="video-stage-media-slot" />
          )}
          <Button
            danger
            onClick={leave}
            data-analytics="none"
            data-analytics-reason="leaving the media session is a client-side disconnect; the host app wraps this with its own tracked()"
          >
            {t(VIDEO_I18N_KEYS.stageLeave)}
          </Button>
        </Flex>
      );
    }
    return (
      <Typography.Text
        type="secondary"
        role="status"
        aria-busy
        data-testid="video-stage-connecting"
      >
        {t(VIDEO_I18N_KEYS.stageConnecting)}
      </Typography.Text>
    );
  }
}
