/**
 * `<MeetingPane>` — one room, from the code in your hand to the call.
 *
 * The four states a person is actually in, each with its own screen:
 *
 *   no outcome yet  — the room's details and the ask (`<JoinGate>`)
 *   denied          — the host's answer, with no retry (a denial is sticky)
 *   waiting         — the lobby, live, telling you when that changes
 *   admitted        — the roster, the host's queue, and the call
 *
 * The bag is a PROP, not a hook call, so a host can mount this screen beside
 * its own chrome and keep one meeting across routes — and so the demos can
 * photograph every one of those four states without a server.
 */
import type { ReactElement, ReactNode } from "react";
import { Button, Descriptions, Flex, Tag, Typography, theme } from "antd";
import { matchLoad, useT } from "@stapel/core";
import { ErrorAlert, SkinTheme } from "@stapel/tokens-antd/skin";
import type { RoomResponse } from "../api/types.js";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { accessLevelKey, isRoomHost } from "../model/meeting.js";
import { useLobby, useRoom } from "../model/meetingQueries.js";
import type { MeetingBag } from "../model/meetingQueries.js";
import { useVideoRuntime } from "../model/context.js";
import { CallStage } from "./CallStage.js";
import { JoinGate } from "./JoinGate.js";
import { LobbyPanel } from "./LobbyPanel.js";
import { ParticipantsList } from "./ParticipantsList.js";
import type { ThemeModeProp } from "./types.js";

/** What a host's replacement stage is handed. */
export interface CallStageSlotContext {
  readonly token: string | undefined;
  readonly serverUrl: string | undefined;
  readonly room: RoomResponse | undefined;
}

export interface MeetingPaneProps extends ThemeModeProp {
  /** The room. A person arriving on a link holds this and nothing else. */
  readonly joinCode: string;
  /** The joiner's bag (`useMeeting`). */
  readonly meeting: MeetingBag;
  /** The viewer's user id — the only way to know whether they are this room's
   * host (`RoomResponse.created_by_id`). Absent, the lobby is read-only: a
   * screen that guessed would offer verdicts the backend answers 403 to. */
  readonly viewerUserId?: string;
  /** Turn a `user_id` into a name. */
  readonly nameFor?: (userId: string) => ReactNode;
  /** The media server the provider token is for. */
  readonly serverUrl?: string;
  /** Replace the whole call surface. Unfilled, the default `<CallStage>`
   * renders — including its designed refusal when the optional media peer is
   * not installed. */
  readonly renderCallStage?: (context: CallStageSlotContext) => ReactNode;
}

function RoomSummary(props: {
  room: RoomResponse;
  isHost: boolean;
}): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const { room, isHost } = props;
  return (
    <Flex vertical gap={token.paddingXXS} data-testid="video-room">
      <Flex align="center" gap={token.paddingXS} wrap>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t(VIDEO_I18N_KEYS.roomHeading)}
        </Typography.Title>
        {isHost && (
          <Tag color="success" data-testid="video-room-host">
            {t(VIDEO_I18N_KEYS.roomHostBadge)}
          </Tag>
        )}
      </Flex>
      <Descriptions
        size="small"
        column={1}
        data-testid="video-room-details"
        items={[
          {
            key: "code",
            label: t(VIDEO_I18N_KEYS.roomCodeLabel),
            children: (
              <Typography.Text copyable data-testid="video-room-code">
                {room.join_code}
              </Typography.Text>
            ),
          },
          {
            key: "access",
            label: t(VIDEO_I18N_KEYS.roomAccessLabel),
            children: t(accessLevelKey(room.access_level)),
          },
          {
            key: "lobby",
            label: t(VIDEO_I18N_KEYS.lobbyHeading),
            children: t(
              room.admit_required
                ? VIDEO_I18N_KEYS.roomLobbyOn
                : VIDEO_I18N_KEYS.roomLobbyOff
            ),
          },
        ]}
      />
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {t(VIDEO_I18N_KEYS.roomShareHint)}
      </Typography.Text>
    </Flex>
  );
}

export function MeetingPane(props: MeetingPaneProps): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const runtime = useVideoRuntime();
  const {
    joinCode,
    meeting,
    viewerUserId,
    nameFor,
    renderCallStage,
    mode,
  } = props;

  const held = meeting.room;
  const outcome = meeting.outcome;
  const inRoom = outcome !== undefined && outcome.kind !== "denied";
  const host = isRoomHost(held, viewerUserId);
  const serverUrl = props.serverUrl;

  // The room read is the door for someone who arrived on a link: it names the
  // room, its access level and its lobby BEFORE they ask to join. Held back
  // once a join answered, because that answer carries the room already.
  const roomRead = useRoom(joinCode, { enabled: held === undefined });
  const lobby = useLobby(joinCode, {
    enabled: inRoom,
    isHost: host,
  });

  return (
    <SkinTheme surface="base" {...(mode !== undefined ? { mode } : {})}>
      <Flex vertical gap={token.padding} data-testid="video-meeting">
        {held !== undefined ? (
          <RoomSummary room={held} isHost={host} />
        ) : (
          matchLoad(roomRead, {
            loading: () => (
              <Typography.Text
                type="secondary"
                role="status"
                aria-busy
                data-testid="video-room-loading"
              >
                {t(VIDEO_I18N_KEYS.lobbyConnecting)}
              </Typography.Text>
            ),
            failed: (error) => (
              <ErrorAlert testId="video-room-failed" thrown={error} />
            ),
            ready: (room) => <RoomSummary room={room} isHost={false} />,
          })
        )}

        {(outcome === undefined || outcome.kind === "denied") && (
          <JoinGate meeting={meeting} initialCode={joinCode} />
        )}

        {outcome?.kind === "waiting" && (
          <LobbyPanel
            variant="guest"
            joinCode={joinCode}
            lobby={lobby}
            onEvent={meeting.applyLobbyEvent}
            {...(nameFor !== undefined ? { nameFor } : {})}
          />
        )}

        {outcome?.kind === "admitted" && (
          <>
            {host && (
              <LobbyPanel
                joinCode={joinCode}
                lobby={lobby}
                isHost
                onEvent={meeting.applyLobbyEvent}
                {...(nameFor !== undefined ? { nameFor } : {})}
              />
            )}
            <ParticipantsList
              participants={lobby.participants}
              hasMore={lobby.hasMore}
              onRefresh={lobby.refresh}
              {...(nameFor !== undefined ? { nameFor } : {})}
            />
            {renderCallStage !== undefined ? (
              renderCallStage({
                token: meeting.token,
                serverUrl: serverUrl ?? runtime.wsOrigin,
                room: held,
              })
            ) : (
              <CallStage
                token={meeting.token}
                serverUrl={serverUrl}
                onLeave={meeting.leave}
              />
            )}
          </>
        )}

        {inRoom && (
          <Button
            onClick={meeting.leave}
            data-testid="video-meeting-leave"
            data-analytics="none"
            data-analytics-reason="drops this app's hold on the room; the server is told nothing, so there is no outcome to count"
          >
            {t(VIDEO_I18N_KEYS.roomsLeave)}
          </Button>
        )}
      </Flex>
    </SkinTheme>
  );
}
