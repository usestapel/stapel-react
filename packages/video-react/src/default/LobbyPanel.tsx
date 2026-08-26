/**
 * `<LobbyPanel>` — who is knocking, and the host's two answers.
 *
 * ── The socket is the substrate's, and its state is on the screen ─────────
 *
 * stapel-video relays `lobby.waiting` / `lobby.admitted` / `lobby.denied` on
 * `ws/video/lobby/<join_code>` and closes 4401 (unauthenticated) / 4403 (not a
 * member) — the two codes §83.1 records the chat client mistreating: it read
 * 4401 as final and slid into a silent 15-second poll, so a product looked
 * live for months while it was not. Nothing in this file decides what a close
 * code means. `@stapel/realtime` owns that table once for the fleet, and this
 * panel renders the answer: `connecting` / `live` / `reconnecting` / a NAMED
 * refusal / `offline`.
 *
 * `offline` is a visible state with a visible "Check again" beside it, not a
 * hidden timer. A host with no `wsOrigin` configured, or no
 * `<RealtimeProvider>` mounted, gets a lobby that works and says it is not
 * live — which is the honest version of what chat did quietly.
 *
 * ── The verdicts ─────────────────────────────────────────────────────────
 *
 * Both go over REST (the socket is read-only for clients by design,
 * `consumers.py:65-68`). "Turn away" is sticky for the room, so it asks first —
 * through `SkinConfirm`, which is a bottom sheet on a phone and a modal above
 * the tablet edge. A viewer who is not the host sees the list with the reason
 * beside the controls rather than buttons the backend answers 403 to.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Flex, List, Tag, Typography, theme } from "antd";
import { matchList, useT, useTPlural } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  useOptionalRealtimeClient,
  useStream,
} from "@stapel/realtime/react";
import type { RealtimeFrame } from "@stapel/realtime";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import {
  decodeLobbyEvent,
  lobbyLiveness,
  lobbyStreamKey,
  lobbySocketUrl,
} from "../model/lobby.js";
import type { LobbyEvent, LobbyLiveness } from "../model/lobby.js";
import { useVideoRuntime } from "../model/context.js";
import type { LobbyBag, WaitingPerson } from "../model/meetingQueries.js";
import type { ThemeModeProp } from "./types.js";

export interface LobbyPanelProps extends ThemeModeProp {
  /** The room whose lobby this is. */
  readonly joinCode: string;
  /** The lobby's state and verdicts (`useLobby`). */
  readonly lobby: LobbyBag;
  /** Turn a `user_id` into a name. The waiting frame carries one; the REST row
   * does not, so a host with a roster fills the gap. */
  readonly nameFor?: (userId: string) => ReactNode;
  /** Every decoded lobby frame, after the lobby has taken it — how a guest's
   * own verdict reaches the meeting bag. */
  readonly onEvent?: (event: LobbyEvent) => void;
  /** Override the runtime's WebSocket origin (tests, a second deployment). */
  readonly wsOrigin?: string;
  /** `false` renders the lobby read-only with the reason beside the controls. */
  readonly isHost?: boolean;
  /**
   * `"host"` (default) is the queue and its two verdicts. `"guest"` is the
   * same socket with nothing to answer: the person is IN the lobby, and what
   * they need is to be told they are waiting and that the page will tell them
   * when that changes. One component, because it is one channel — a second
   * subscription for the guest would be a second close-code table.
   */
  readonly variant?: "host" | "guest";
}

/** The refusal's own sentence — a deployment misconfiguration and a dead
 * session are different problems with different owners. */
function refusalKey(refusal: string | undefined): string {
  switch (refusal) {
    case "session":
      return VIDEO_I18N_KEYS.lobbyRefusedSession;
    case "origin":
      return VIDEO_I18N_KEYS.lobbyRefusedOrigin;
    case "forbidden":
    case "revoked":
      return VIDEO_I18N_KEYS.lobbyRefusedForbidden;
    default:
      return VIDEO_I18N_KEYS.lobbyRefusedUnknown;
  }
}

function livenessKey(liveness: LobbyLiveness): string {
  switch (liveness) {
    case "live":
      return VIDEO_I18N_KEYS.lobbyLive;
    case "connecting":
      return VIDEO_I18N_KEYS.lobbyConnecting;
    case "reconnecting":
      return VIDEO_I18N_KEYS.lobbyReconnecting;
    case "refused":
      return VIDEO_I18N_KEYS.lobbyRefusedUnknown;
    default:
      return VIDEO_I18N_KEYS.lobbyOffline;
  }
}

function livenessColor(liveness: LobbyLiveness): string {
  switch (liveness) {
    case "live":
      return "success";
    case "connecting":
    case "reconnecting":
      return "processing";
    case "refused":
      return "error";
    default:
      return "default";
  }
}

/** The freshness row: what the channel is doing, and the two things a person
 * can do about it. */
function LivenessBar(props: {
  liveness: LobbyLiveness;
  refusal: string | undefined;
  onReconnect: (() => void) | undefined;
  onRefresh: () => void;
}): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const { liveness, refusal, onReconnect, onRefresh } = props;
  return (
    <Flex vertical gap={token.paddingXXS} data-testid="video-lobby-liveness">
      <Flex align="center" gap={token.paddingXS} wrap>
        {/* A status tag holds a STATE, not a sentence: antd's tag is one
            unbreakable line with an 8px trailing margin, so the paragraph that
            used to live in here set the width of the page (390px viewport,
            392px document — visual pass M-4). The advice moved to the hint
            below, where it is also no longer the same string printed twice. */}
        <Tag
          color={livenessColor(liveness)}
          data-testid={`video-lobby-liveness-${liveness}`}
          style={{ whiteSpace: "normal", marginInlineEnd: 0, maxWidth: "100%" }}
        >
          {t(livenessKey(liveness))}
        </Tag>
        <Button
          size="small"
          onClick={onRefresh}
          data-analytics="none"
          data-analytics-reason="re-reads the participant page; the read hook reports its own outcome"
        >
          {t(VIDEO_I18N_KEYS.lobbyRefresh)}
        </Button>
        {liveness === "refused" && onReconnect !== undefined && (
          <Button
            size="small"
            onClick={onReconnect}
            data-analytics="none"
            data-analytics-reason="clears the refusal and reconnects the shared socket"
          >
            {t(VIDEO_I18N_KEYS.lobbyReconnect)}
          </Button>
        )}
      </Flex>
      {liveness === "refused" && (
        <Typography.Text
          type="secondary"
          data-testid="video-lobby-refusal"
          style={{ fontSize: token.fontSizeSM }}
        >
          {t(refusalKey(refusal))}
        </Typography.Text>
      )}
      {liveness === "offline" && (
        <Typography.Text
          type="secondary"
          data-testid="video-lobby-not-live"
          style={{ fontSize: token.fontSizeSM }}
        >
          {t(VIDEO_I18N_KEYS.lobbyOfflineHint)}
        </Typography.Text>
      )}
    </Flex>
  );
}

/**
 * The live half. Mounted ONLY when a `<RealtimeProvider>` is present and a
 * socket origin is known — `useStream` needs a client, and a panel that
 * demanded one would make the lobby unusable for a host that has not wired the
 * socket yet.
 */
function LobbyLive(props: {
  joinCode: string;
  url: string;
  onEvent: (event: LobbyEvent) => void;
  onRefresh: () => void;
}): ReactElement {
  const { joinCode, url, onEvent, onRefresh } = props;
  const { status, reconnect } = useStream(lobbyStreamKey(joinCode), {
    url,
    onFrame: (frame: RealtimeFrame) => {
      const event = decodeLobbyEvent(frame);
      if (event !== undefined) onEvent(event);
    },
  });
  return (
    <LivenessBar
      liveness={lobbyLiveness(status.state)}
      refusal={status.refusal}
      onReconnect={reconnect}
      onRefresh={onRefresh}
    />
  );
}

export function LobbyPanel(props: LobbyPanelProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { token } = theme.useToken();
  const runtime = useVideoRuntime();
  const client = useOptionalRealtimeClient();
  const [denying, setDenying] = useState<WaitingPerson | undefined>(undefined);
  const { joinCode, lobby, nameFor, onEvent, isHost } = props;

  const wsOrigin = props.wsOrigin ?? runtime.wsOrigin;
  const url =
    wsOrigin !== undefined && wsOrigin.length > 0
      ? lobbySocketUrl(wsOrigin, joinCode)
      : undefined;

  const handleEvent = (event: LobbyEvent): void => {
    lobby.apply(event);
    onEvent?.(event);
  };

  const nameOf = (person: WaitingPerson): ReactNode =>
    person.name ?? nameFor?.(person.userId) ?? person.userId;

  const guest = props.variant === "guest";

  return (
    <SkinTheme surface="bare" {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Flex vertical gap={token.paddingXS} data-testid="video-lobby">
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t(guest ? VIDEO_I18N_KEYS.joinWaiting : VIDEO_I18N_KEYS.lobbyHeading)}
        </Typography.Title>

        {guest && (
          <Typography.Text type="secondary" data-testid="video-lobby-waiting-hint">
            {t(VIDEO_I18N_KEYS.joinWaitingHint)}
          </Typography.Text>
        )}

        {client !== null && url !== undefined ? (
          <LobbyLive
            joinCode={joinCode}
            url={url}
            onEvent={handleEvent}
            onRefresh={lobby.refresh}
          />
        ) : (
          <LivenessBar
            liveness="offline"
            refusal={undefined}
            onReconnect={undefined}
            onRefresh={lobby.refresh}
          />
        )}

        <ErrorAlert testId="video-lobby-failed" thrown={lobby.error} />

        {!guest && matchList(lobby.waiting, {
          loading: () => (
            <Typography.Text
              type="secondary"
              role="status"
              aria-busy
              data-testid="video-lobby-loading"
            >
              {t(VIDEO_I18N_KEYS.lobbyConnecting)}
            </Typography.Text>
          ),
          failed: (error) => (
            <ErrorAlert
              testId="video-lobby-list-failed"
              thrown={error}
              onRetry={lobby.refresh}
              retryLabel={t(VIDEO_I18N_KEYS.lobbyRefresh)}
            />
          ),
          empty: () => (
            <EmptyState
              compact
              testId="video-lobby-empty"
              title={t(VIDEO_I18N_KEYS.lobbyEmpty)}
              hint={t(VIDEO_I18N_KEYS.lobbyEmptyHint)}
            />
          ),
          ready: (people) => (
            <Flex vertical gap={token.paddingXS}>
              <Typography.Text
                type="secondary"
                data-testid="video-lobby-count"
                style={{ fontSize: token.fontSizeSM }}
              >
                {tPlural(VIDEO_I18N_KEYS.lobbyWaitingCount, {
                  count: people.length,
                })}
              </Typography.Text>
              <List
                size="small"
                data-testid="video-lobby-rows"
                dataSource={[...people]}
                renderItem={(person: WaitingPerson) => (
                  <List.Item data-testid="video-lobby-row">
                    <Flex
                      vertical
                      gap={token.paddingXXS}
                      style={{ width: "100%" }}
                    >
                      <Flex align="baseline" gap={token.paddingXS} wrap>
                        <Typography.Text>{nameOf(person)}</Typography.Text>
                        {person.live && (
                          <Tag color="processing" data-testid="video-lobby-row-live">
                            {t(VIDEO_I18N_KEYS.lobbyLive)}
                          </Tag>
                        )}
                      </Flex>
                      <Flex gap={token.paddingXS} wrap>
                        <GatedButton
                          gate={lobby.verdictGate}
                          type="primary"
                          size="small"
                          testId={`video-lobby-admit-${person.participantId}`}
                          loading={
                            lobby.pendingParticipantId === person.participantId
                          }
                          onClick={() => {
                            lobby.admit(person.participantId);
                          }}
                          data-analytics="none"
                          data-analytics-reason="host verdict over REST; the host app wraps this with its own tracked()"
                        >
                          {t(VIDEO_I18N_KEYS.lobbyAdmit)}
                        </GatedButton>
                        <GatedButton
                          gate={lobby.verdictGate}
                          danger
                          size="small"
                          testId={`video-lobby-deny-${person.participantId}`}
                          onClick={() => {
                            setDenying(person);
                          }}
                          data-analytics="none"
                          data-analytics-reason="opens the confirmation; the verdict is sent from there"
                        >
                          {t(VIDEO_I18N_KEYS.lobbyDeny)}
                        </GatedButton>
                      </Flex>
                    </Flex>
                  </List.Item>
                )}
              />
            </Flex>
          ),
        })}

        {/* ONE confirm for the list, keyed by the person being answered — not
            one per row. Never mounted for a guest: there is nothing to answer. */}
        {!guest && (
        <SkinConfirm
          open={denying !== undefined}
          danger
          title={t(VIDEO_I18N_KEYS.lobbyDenyTitle)}
          body={t(VIDEO_I18N_KEYS.lobbyDenyBody)}
          confirmLabel={t(VIDEO_I18N_KEYS.lobbyDeny)}
          data-testid="video-lobby-deny-confirm"
          onConfirm={() => {
            if (denying !== undefined) lobby.deny(denying.participantId);
            setDenying(undefined);
          }}
          onCancel={() => {
            setDenying(undefined);
          }}
        />
        )}

        {!guest && isHost === false && (
          <Typography.Text
            type="secondary"
            data-testid="video-lobby-read-only"
            style={{ fontSize: token.fontSizeSM }}
          >
            {t(VIDEO_I18N_KEYS.lobbyBlockedNotHost)}
          </Typography.Text>
        )}
      </Flex>
    </SkinTheme>
  );
}
