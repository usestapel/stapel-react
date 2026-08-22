/**
 * `<StartChatButton/>` — "message the seller" on a listing card, skinned.
 *
 * The control is either pressable or switched off WITH a sentence beside it
 * (no seller on the listing; the listing is your own). It never renders as a
 * grey rectangle with no explanation.
 */
import type { ReactElement } from "react";
import { Button, Space, Typography } from "antd";
import { useActionGate, useErrorDisplay, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { Conversation } from "../api/types.js";
import { StartDirectChat } from "../headless/StartDirectChat.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface StartChatButtonProps {
  sellerId: string | null | undefined;
  viewerId?: string | null;
  onOpened?: (conversation: Conversation) => void;
  block?: boolean;
}

function StartChatBody(props: {
  availability: ActionAvailability;
  isStarting: boolean;
  error: unknown;
  start: () => void;
  block: boolean | undefined;
}): ReactElement {
  const t = useT();
  const gate = useActionGate(props.availability);
  const errorDisplay = useErrorDisplay(CHAT_I18N_KEYS.unknownError);
  return (
    <Space direction="vertical" style={{ width: props.block ? "100%" : undefined }}>
      <Button
        type="primary"
        block={props.block ?? false}
        disabled={gate.disabled}
        loading={props.isStarting}
        onClick={props.start}
        data-testid="chat-start-button"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {props.isStarting
          ? t(CHAT_I18N_KEYS.startStarting)
          : t(CHAT_I18N_KEYS.startButton)}
      </Button>
      {gate.reason ? (
        <Typography.Text type="secondary" data-testid="chat-start-blocked">
          {gate.reason}
        </Typography.Text>
      ) : null}
      <ErrorAlert error={errorDisplay(props.error)} />
    </Space>
  );
}

export function StartChatButton(props: StartChatButtonProps): ReactElement {
  return (
    <StartDirectChat
      sellerId={props.sellerId}
      {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
      {...(props.onOpened !== undefined ? { onOpened: props.onOpened } : {})}
    >
      {({ availability, isStarting, error, start }) => (
        <StartChatBody
          availability={availability}
          isStarting={isStarting}
          error={error}
          start={start}
          block={props.block}
        />
      )}
    </StartDirectChat>
  );
}
