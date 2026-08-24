/**
 * `<ParticipantsList>` — who is in this room, with their state.
 *
 * The wire carries ids and never names (`ParticipantResponse.user_id`), the
 * same rule the usage table lives under, so the display name is the host's
 * (`nameFor`) and the id is what a room without a roster shows. A blank cell
 * would be worse than an ugly one in a list of people.
 *
 * `status` and `role` are open strings on the wire. They are mapped to i18n
 * keys in `model/meeting.ts` and rendered as a coloured tag, because
 * `admitted` printed as `admitted` is a machine value on a person's screen —
 * the class the visual pass named M-2 across six packages.
 *
 * `has_next` is stated rather than swallowed: an anchored page is not the
 * room, and a roster that quietly showed the first hundred people as if they
 * were everyone is a claim this component cannot support.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex, List, Tag, Typography, theme } from "antd";
import { matchList, useT } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { EmptyState, ErrorAlert, SkinTheme } from "@stapel/tokens-antd/skin";
import type { ParticipantResponse } from "../api/types.js";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import {
  PARTICIPANT_ADMITTED,
  PARTICIPANT_DENIED,
  PARTICIPANT_LEFT,
  PARTICIPANT_WAITING,
  participantRoleKey,
  participantStatusKey,
} from "../model/meeting.js";
import type { ThemeModeProp } from "./types.js";

export interface ParticipantsListProps extends ThemeModeProp {
  /** The room's people. A `LoadState`, so "we could not ask" never renders as
   * "the room is empty". */
  readonly participants: LoadState<readonly ParticipantResponse[]>;
  /** Turn a `user_id` into a name the reader recognises. */
  readonly nameFor?: (userId: string) => ReactNode;
  /** The page did not carry everyone. */
  readonly hasMore?: boolean;
  /** Re-read the page. Absent renders no retry on the failed arm. */
  readonly onRefresh?: () => void;
}

/** antd's semantic tag presets — a status colour that follows the theme
 * instead of a hex this file would have to re-decide in dark mode. */
function statusColor(status: string): string {
  switch (status) {
    case PARTICIPANT_ADMITTED:
      return "success";
    case PARTICIPANT_WAITING:
      return "processing";
    case PARTICIPANT_DENIED:
      return "error";
    case PARTICIPANT_LEFT:
      return "default";
    default:
      return "default";
  }
}

export function ParticipantsList(props: ParticipantsListProps): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const { mode, participants, nameFor, hasMore, onRefresh } = props;

  return (
    <SkinTheme surface="bare" {...(mode !== undefined ? { mode } : {})}>
      <Flex vertical gap={token.paddingXS} data-testid="video-participants">
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t(VIDEO_I18N_KEYS.participantsHeading)}
        </Typography.Title>

        {matchList(participants, {
          loading: () => (
            <Typography.Text
              type="secondary"
              role="status"
              aria-busy
              data-testid="video-participants-loading"
            >
              {t(VIDEO_I18N_KEYS.lobbyConnecting)}
            </Typography.Text>
          ),
          failed: (error) => (
            <ErrorAlert
              testId="video-participants-failed"
              thrown={error}
              {...(onRefresh !== undefined ? { onRetry: onRefresh } : {})}
              retryLabel={t(VIDEO_I18N_KEYS.lobbyRefresh)}
            />
          ),
          empty: () => (
            <EmptyState
              compact
              testId="video-participants-empty"
              title={t(VIDEO_I18N_KEYS.participantsEmpty)}
            />
          ),
          ready: (rows) => (
            <List
              size="small"
              data-testid="video-participants-rows"
              dataSource={[...rows]}
              renderItem={(row: ParticipantResponse) => (
                <List.Item data-testid="video-participant-row">
                  <Flex
                    align="center"
                    justify="space-between"
                    gap={token.paddingXS}
                    wrap
                    style={{ width: "100%" }}
                  >
                    <Flex align="baseline" gap={token.paddingXS} wrap>
                      <Typography.Text>
                        {nameFor?.(row.user_id) ?? row.user_id}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: token.fontSizeSM }}
                      >
                        {t(participantRoleKey(row.role))}
                      </Typography.Text>
                    </Flex>
                    <Tag color={statusColor(row.status)}>
                      {t(participantStatusKey(row.status))}
                    </Tag>
                  </Flex>
                </List.Item>
              )}
            />
          ),
        })}

        {hasMore === true && (
          <Typography.Text
            type="secondary"
            data-testid="video-participants-more"
            style={{ fontSize: token.fontSizeSM }}
          >
            {t(VIDEO_I18N_KEYS.participantsMore)}
          </Typography.Text>
        )}
      </Flex>
    </SkinTheme>
  );
}
