/**
 * `<RoomsPane>` — the meeting client's front door, and what the nav manifest
 * mounts at `video.rooms`.
 *
 * ── There is no list of rooms, and the screen says so ────────────────────
 *
 * stapel-video answers no room collection: `POST /video/api/v1/rooms` opens
 * one and `GET /rooms/{join_code}` reads one. A room is reached by its code,
 * full stop. A pane that drew an empty "your meetings" list would be inventing
 * a collection the contract cannot fill and would look broken forever, so this
 * one names the fact once, in a sentence, and offers the two things that DO
 * exist: open a room, or enter a code.
 *
 * Once a room is held the whole screen becomes `<MeetingPane>` — the room, the
 * lobby and the call — because there is nothing else on this page worth
 * keeping beside it.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography, theme } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert, GatedButton, SkinTheme } from "@stapel/tokens-antd/skin";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { useMeeting } from "../model/meetingQueries.js";
import { JoinGate } from "./JoinGate.js";
import { MeetingPane } from "./MeetingPane.js";
import type { CallStageSlotContext } from "./MeetingPane.js";
import type { ThemeModeProp } from "./types.js";

export interface RoomsPaneProps extends ThemeModeProp {
  /** The viewer's user id, so the pane can tell a host from a guest. */
  readonly viewerUserId?: string;
  /** Turn a `user_id` into a name. */
  readonly nameFor?: (userId: string) => ReactNode;
  /** The media server the provider token is for. */
  readonly serverUrl?: string;
  /** Pre-fill the code — a host routing `/meetings/:code` passes it through. */
  readonly initialCode?: string;
  /** Replace the call surface (see `<MeetingPane renderCallStage>`). */
  readonly renderCallStage?: (context: CallStageSlotContext) => ReactNode;
}

export function RoomsPane(props: RoomsPaneProps): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const meeting = useMeeting();
  const { mode, viewerUserId, nameFor, serverUrl, renderCallStage } = props;

  const joinCode = meeting.room?.join_code ?? props.initialCode;

  if (meeting.outcome !== undefined && joinCode !== undefined) {
    return (
      <MeetingPane
        {...(mode !== undefined ? { mode } : {})}
        joinCode={joinCode}
        meeting={meeting}
        {...(viewerUserId !== undefined ? { viewerUserId } : {})}
        {...(nameFor !== undefined ? { nameFor } : {})}
        {...(serverUrl !== undefined ? { serverUrl } : {})}
        {...(renderCallStage !== undefined ? { renderCallStage } : {})}
      />
    );
  }

  return (
    <SkinTheme surface="base" {...(mode !== undefined ? { mode } : {})}>
      <Flex vertical gap={token.padding} data-testid="video-rooms">
        <Flex vertical gap={token.paddingXXS}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t(VIDEO_I18N_KEYS.roomsHeading)}
          </Typography.Title>
          <Typography.Text>{t(VIDEO_I18N_KEYS.roomsIntro)}</Typography.Text>
          <Typography.Text
            type="secondary"
            data-testid="video-rooms-no-directory"
            style={{ fontSize: token.fontSizeSM }}
          >
            {t(VIDEO_I18N_KEYS.roomsNoDirectory)}
          </Typography.Text>
        </Flex>

        <Flex vertical gap={token.paddingXXS}>
          <GatedButton
            gate={meeting.startGate}
            type="primary"
            testId="video-rooms-start"
            onClick={() => {
              meeting.start();
            }}
            data-analytics="none"
            data-analytics-reason="the create mutation reports its own outcome; the host app wraps this with its own tracked()"
          >
            {t(VIDEO_I18N_KEYS.roomsStart)}
          </GatedButton>
          <Typography.Text
            type="secondary"
            style={{ fontSize: token.fontSizeSM }}
          >
            {t(VIDEO_I18N_KEYS.roomsStartHint)}
          </Typography.Text>
        </Flex>

        <ErrorAlert testId="video-rooms-failed" thrown={meeting.error} />

        <JoinGate
          meeting={meeting}
          {...(props.initialCode !== undefined
            ? { initialCode: props.initialCode }
            : {})}
        />
      </Flex>
    </SkinTheme>
  );
}
