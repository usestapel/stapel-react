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
 * ── The specifier is a LITERAL, and that is the fix ──────────────────────
 *
 * It used to be held in a `string`-typed constant, so TypeScript would not
 * resolve a module a host may not have installed. What that actually bought
 * was a call that could never connect anywhere: `import(someString)` is
 * invisible to every bundler, so no chunk was ever emitted for it and the
 * browser was left to resolve a BARE specifier at runtime — which browsers do
 * not do. Hosts that HAD `livekit-client` installed, and had done nothing
 * wrong, got the `missing` screen on every call ("video is not available").
 * A designed absence arm is only honest if the presence arm can happen.
 *
 * So the import is `import("livekit-client")`, written out, and bundlers
 * split it into its own chunk fetched at the moment a token exists. A host
 * that does not install the peer, or whose build must not see the specifier
 * at all, passes {@link CallStageProps.loadPeer} — the same seam the tests
 * use — and the `missing` arm still catches a load that fails at runtime.
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

/**
 * The default loader, and the whole reason this file carries the note above:
 * the specifier is written out so a bundler can SEE it and emit the chunk. A
 * dynamic string here is a call that never connects.
 */
const defaultLoader: CallPeerLoader = () => import("livekit-client");

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
  /**
   * Replaces the built-in `import("livekit-client")`.
   *
   * Two callers: a test driving the arms without the SDK, and a host whose
   * build must not see the specifier at all — an optional peer it does not
   * install, or a vendored copy of its own.
   */
  readonly loadPeer?: CallPeerLoader;
}

/**
 * HOW MANY TIMES ONE CALL MAY BE DIALLED, and how long it waits between.
 *
 * A stand walk (PASS-17) caught a single call issuing **129** signalling
 * requests, one after another with no gap, each a `GET …/rtc/v1?access_token=`
 * answered 404 — a misconfigured media URL turned into a request flood, on
 * both parties' phones, behind a screen that said "connecting" and offered no
 * way out. Five attempts is enough to ride out a media server restarting; the
 * sixth is a fact about the deployment, not about this call, and belongs on
 * screen rather than in the network log.
 *
 * The backoff doubles from {@link CALL_DIAL_BACKOFF_MS} and is what makes the
 * five attempts a diagnosis instead of a burst: 0.4s, 0.8s, 1.6s, 3.2s.
 */
export const CALL_DIAL_ATTEMPTS = 5;
export const CALL_DIAL_BACKOFF_MS = 400;

/**
 * A refusal that will refuse again — no number of retries makes a 404 into a
 * room.
 *
 * 404 is "there is no media server at this address" and 403 is "this token is
 * not welcome here"; both are the deployment's configuration answering, and
 * both were being retried on a timer. Anything else (a dropped socket, a
 * timeout, a 5xx) is worth another attempt.
 */
export function isTerminalDialFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 404 || status === 403) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\b(404|403)\b/.test(message) || /not found|forbidden/i.test(message);
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
  /**
   * The loader, held rather than depended on.
   *
   * A prop function's IDENTITY is not a reason to dial a call again, and it
   * was one: `loadPeer` sat in the effect's dependency list, so a host that
   * passed an inline arrow (which every host did while the built-in loader
   * was broken) got a new identity on every render, and every dial caused a
   * render. That is the loop behind the 129 requests — see
   * {@link CALL_DIAL_ATTEMPTS}. What SHOULD re-dial is a new token, a new
   * server, or a person pressing retry, and those are the deps below.
   */
  const loadPeerRef = useRef<CallPeerLoader>(props.loadPeer ?? defaultLoader);
  loadPeerRef.current = props.loadPeer ?? defaultLoader;

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    setError(undefined);
    setState("loading");

    /**
     * One dial, and the decision about the next one.
     *
     * The whole retry policy is here rather than in the caller: bounded
     * ({@link CALL_DIAL_ATTEMPTS}), spaced (doubling from
     * {@link CALL_DIAL_BACKOFF_MS}) and stopped early for a refusal that will
     * refuse again ({@link isTerminalDialFailure}). What the person gets when
     * it stops is the failed screen, which has both a retry and a way out.
     */
    const dial = async (attemptIndex: number): Promise<void> => {
      try {
        const loaded = (await loadPeerRef.current()) as CallModuleLike | undefined;
        const RoomCtor = loaded?.Room;
        if (typeof RoomCtor !== "function") {
          if (!cancelled) setState("missing");
          return;
        }
        // EVERY step past an await is guarded, and the guard is not decoration
        // (item 18): React StrictMode mounts, cleans up and mounts again, so
        // the first run's `dial` is still in flight when the second run starts
        // its own. Unguarded, the first run's room was created AFTER the
        // second's and overwrote `roomRef` with a room nobody is connected to
        // — the stage sat on "connecting" for the rest of the session, which
        // is every developer's local call.
        if (cancelled) return;
        const next = new RoomCtor();
        if (cancelled) {
          // Created after the effect was torn down: it is nobody's room, and
          // leaving it undisconnected is a socket held open for the tab's
          // lifetime.
          next.disconnect();
          return;
        }
        roomRef.current = next;
        setRoom(next);
        setState("connecting");
        await next.connect(serverUrl as string, token as string);
        if (cancelled) {
          next.disconnect();
          return;
        }
        setState("connected");
      } catch (thrown) {
        if (cancelled) return;
        if (isPeerMissing(thrown)) {
          setState("missing");
          return;
        }
        // A room that half-connected still holds a socket; drop it before the
        // next attempt makes a second one.
        const held = roomRef.current;
        roomRef.current = null;
        if (held !== null) held.disconnect();
        const last = attemptIndex + 1 >= CALL_DIAL_ATTEMPTS;
        if (last || isTerminalDialFailure(thrown)) {
          setError(thrown);
          setState("failed");
          return;
        }
        timer = setTimeout(
          () => {
            if (!cancelled) void dial(attemptIndex + 1);
          },
          CALL_DIAL_BACKOFF_MS * 2 ** attemptIndex
        );
      }
    };

    void dial(0);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
      const held = roomRef.current;
      roomRef.current = null;
      if (held !== null) held.disconnect();
    };
    // PRIMITIVES ONLY, and that is a contract rather than an accident.
    //
    // This effect's cleanup disconnects the room, so anything in this list is
    // something that can ABORT an in-flight connect. A prop function or an
    // options object in here is a fresh identity on every parent render, and
    // the storefront's own page re-renders several times while a call is
    // dialling: the signal socket closed with code 1000 ("Close method called
    // on signal client") 9 ms after "signal connected", before a transport
    // even existed. The loader lives in a ref for exactly this reason; what
    // may legitimately re-dial is a new address, a new token, or a person
    // pressing retry.
  }, [ready, token, serverUrl, attempt]);

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
        <Flex vertical gap={themeToken.paddingXS}>
          <ErrorAlert
            testId="video-stage-failed"
            thrown={error}
            message={t(VIDEO_I18N_KEYS.stageFailed)}
            onRetry={retry}
            retryLabel={t(VIDEO_I18N_KEYS.stageRetry)}
          />
          {/* A retry is not a way OUT. A call that cannot connect still exists
              on the server — it is ringing the other person and the meter is
              running — so the screen that says it failed has to be able to end
              it, not only to try again. */}
          <Button
            danger
            onClick={leave}
            data-testid="video-stage-failed-leave"
            data-analytics="none"
            data-analytics-reason="leaving the media session is a client-side disconnect; the host app wraps this with its own tracked()"
          >
            {t(VIDEO_I18N_KEYS.stageLeave)}
          </Button>
        </Flex>
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
    // Loading the peer, dialling, or waiting out a backoff between attempts.
    //
    // THE ONE CONTROL THIS SCREEN MUST HAVE IS THE WAY OUT. A stand walk
    // (PASS-17) found both parties held on the "connecting to the call" line
    // with no control of any kind while a misconfigured media URL answered
    // 404: the
    // only exit was to close the tab, and the call stayed up on the server
    // for both of them. Hanging up here ends it where it actually lives.
    return (
      <Flex vertical gap={themeToken.paddingXS}>
        <Typography.Text
          type="secondary"
          role="status"
          aria-busy
          data-testid="video-stage-connecting"
        >
          {t(VIDEO_I18N_KEYS.stageConnecting)}
        </Typography.Text>
        <Button
          danger
          onClick={leave}
          data-testid="video-stage-connecting-leave"
          data-analytics="none"
          data-analytics-reason="leaving the media session is a client-side disconnect; the host app wraps this with its own tracked()"
        >
          {t(VIDEO_I18N_KEYS.stageLeave)}
        </Button>
      </Flex>
    );
  }
}
