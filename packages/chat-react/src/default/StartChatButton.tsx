/**
 * `<StartChatButton/>` — "message the seller" on a listing card, skinned.
 *
 * The control is either pressable or switched off WITH a sentence beside it
 * (no seller on the listing; the listing is your own; you are not signed in).
 * It never renders as a grey rectangle with no explanation — and when the host
 * supplies `signIn`, the sentence comes with the door: a stated reason whose
 * next action is a link the visitor cannot find on their own is only half an
 * answer (storefront Wave D, G-3).
 */
import type { ReactElement } from "react";
import { Button, Space, Typography } from "antd";
import { useActionGate, useErrorDisplay, useT } from "@stapel/core";
import type { ActionAvailability, SignInCta, SignInCtaProp } from "@stapel/core";
import type { Conversation } from "../api/types.js";
import { StartDirectChat } from "../headless/StartDirectChat.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { SignInLink } from "./SignInLink.js";
import { ChatSkinTheme } from "./theme.js";

export interface StartChatButtonProps extends SignInCtaProp {
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
  signIn: SignInCta | undefined;
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
          <SignInLink cta={props.signIn} testId="chat-start-sign-in" />
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
        // `bare` by default: this control is dropped onto a listing card the
        // host already painted, so the wrapper's job is antd's THEME, not a
        // second rectangle behind the button.
        <ChatSkinTheme>
          <StartChatBody
            availability={availability}
            isStarting={isStarting}
            error={error}
            start={start}
            block={props.block}
            signIn={props.signIn}
          />
        </ChatSkinTheme>
      )}
    </StartDirectChat>
  );
}
