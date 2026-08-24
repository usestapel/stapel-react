/**
 * `<JoinGate>` — the code field, the ask, and the three answers.
 *
 * `POST /rooms/{code}/join` resolves to admitted / waiting / denied, and the
 * denial arrives as a **403**, not as a body. `model/meeting.ts` folds both
 * shapes into one outcome, so this component branches on the outcome and never
 * on a status code — which is what keeps a host's refusal from rendering as a
 * generic failure with a retry button beside it. A denial is sticky for the
 * room: re-asking cannot change it, so no arm here offers to.
 *
 * The button is a `GatedButton`: an empty field and a request already in
 * flight are two different reasons, both stated as text beside the control,
 * neither of them a lit primary with a grey excuse underneath (the visual
 * pass's M-8).
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Input, Typography, theme } from "antd";
import { actionAvailable, actionBlocked, firstBlock, useT } from "@stapel/core";
import { ErrorAlert, GatedButton, SkinTheme } from "@stapel/tokens-antd/skin";
import { VIDEO_I18N_KEYS } from "../i18n/keys.js";
import { normalizeJoinCode } from "../model/meeting.js";
import type { MeetingBag } from "../model/meetingQueries.js";
import type { ThemeModeProp } from "./types.js";

export interface JoinGateProps extends ThemeModeProp {
  /** The joiner's bag (`useMeeting`). */
  readonly meeting: MeetingBag;
  /** Pre-fill the field — a host routing `/meeting/:code` passes the code it
   * already has. */
  readonly initialCode?: string;
}

export function JoinGate(props: JoinGateProps): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const { meeting } = props;
  const [code, setCode] = useState(props.initialCode ?? "");
  const normalized = normalizeJoinCode(code);

  const gate = firstBlock(
    meeting.joinGate,
    normalized.length === 0
      ? actionBlocked(VIDEO_I18N_KEYS.roomsJoinBlockedEmpty)
      : actionAvailable()
  );

  const submit = (): void => {
    if (normalized.length === 0) return;
    meeting.join(normalized);
  };

  return (
    <SkinTheme surface="bare" {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Flex vertical gap={token.paddingXS} data-testid="video-join">
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t(VIDEO_I18N_KEYS.roomsJoinHeading)}
        </Typography.Title>

        <label>
          <Typography.Text type="secondary">
            {t(VIDEO_I18N_KEYS.roomsCodeLabel)}
          </Typography.Text>
          <Input
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            onPressEnter={submit}
            placeholder={t(VIDEO_I18N_KEYS.roomsCodePlaceholder)}
            data-testid="video-join-code"
            data-analytics="none"
            data-analytics-reason="typing is not an outcome; the join button carries the tracked action"
          />
        </label>

        <GatedButton
          gate={gate}
          type="primary"
          testId="video-join-submit"
          onClick={submit}
          data-analytics="none"
          data-analytics-reason="the join mutation reports its own outcome; the host app wraps this with its own tracked()"
        >
          {t(VIDEO_I18N_KEYS.roomsJoin)}
        </GatedButton>

        <ErrorAlert testId="video-join-failed" thrown={meeting.error} />

        {meeting.outcome?.kind === "denied" && (
          <Flex vertical gap={token.paddingXXS} data-testid="video-join-denied">
            <Typography.Text strong>
              {t(VIDEO_I18N_KEYS.joinDenied)}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t(VIDEO_I18N_KEYS.joinDeniedHint)}
            </Typography.Text>
          </Flex>
        )}
      </Flex>
    </SkinTheme>
  );
}
