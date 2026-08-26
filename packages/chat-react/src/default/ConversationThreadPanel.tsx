/**
 * `<ConversationThreadPanel/>` — the default skin for one thread: the messages,
 * the "show earlier" control, a live/polling indicator, and the composer.
 *
 * The transport indicator is the ONLY place a person is told how freshness
 * arrives, and it is a label, never a behaviour: nothing else on this screen
 * branches on it. That is the seam holding — the same component renders a
 * socket-fed thread and a polled one.
 */
import { fontSize, spacing } from "@stapel/tokens-antd";
import type { CSSProperties, ReactElement } from "react";
import { Button, Card, Empty, Flex, Input, Space, Spin, Tag, Typography } from "antd";
import {
  matchList,
  useActionGate,
  useErrorDisplay,
  useI18n,
  useT,
} from "@stapel/core";
import type { ChatMessage } from "../api/types.js";
import { ConversationThread } from "../headless/ConversationThread.js";
import { MessageComposer } from "../headless/MessageComposer.js";
import type { ChatDegradedReason, ChatTransport } from "../flows/freshness.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

const TRANSPORT_KEYS: Record<ChatTransport, string> = {
  socket: CHAT_I18N_KEYS.transportLive,
  polling: CHAT_I18N_KEYS.transportPolling,
  idle: CHAT_I18N_KEYS.transportIdle,
};

/**
 * How loud each degradation is. antd's semantic presets, not colours: a
 * transient reconnect is neutral, something the person must act on is a
 * warning, and a refusal nothing here can undo is an error.
 */
const DEGRADED_TAG_COLORS: Record<ChatDegradedReason, string> = {
  reconnecting: "default",
  renewing_credential: "default",
  no_socket: "default",
  unreachable: "warning",
  sign_in_required: "warning",
  forbidden: "error",
  unsupported: "error",
};

export interface ConversationThreadPanelProps {
  conversationId: string;
  /** The reader, when the host knows them — used only to align their own
   * lines. Absent, every message is rendered the same way rather than
   * guessed at. */
  viewerId?: string | null;
  limit?: number;
  maxLength?: number;
}

function MessageRow(props: {
  message: ChatMessage;
  viewerId: string | null | undefined;
  locale: string;
}): ReactElement {
  const t = useT();
  const { message, viewerId, locale } = props;
  const isSystem = message.kind === "system";
  const isOwn =
    !isSystem && viewerId != null && message.sender_id === viewerId;
  const bubble: CSSProperties = {
    alignSelf: isOwn ? "flex-end" : "flex-start",
    maxWidth: "42rem",
  };
  const stamp = Number.isNaN(Date.parse(message.created_at))
    ? ""
    : new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
        Date.parse(message.created_at)
      );
  return (
    <div style={bubble} data-testid="chat-message" data-seq={message.seq}>
      {isSystem ? (
        <Typography.Text type="secondary">
          {t(CHAT_I18N_KEYS.threadSystem)}
        </Typography.Text>
      ) : null}
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        {message.body}
      </Typography.Paragraph>
      <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
        {stamp}
      </Typography.Text>
    </div>
  );
}

function Composer(props: {
  conversationId: string;
  maxLength: number | undefined;
}): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay(CHAT_I18N_KEYS.unknownError);
  return (
    <MessageComposer
      conversationId={props.conversationId}
      {...(props.maxLength !== undefined ? { maxLength: props.maxLength } : {})}
    >
      {({ value, setValue, availability, isSending, error, send, maxLength, length }) => (
        <ComposerBody
          value={value}
          setValue={setValue}
          isSending={isSending}
          send={send}
          maxLength={maxLength}
          length={length}
          availability={availability}
          errorNode={<ErrorAlert error={errorDisplay(error)} />}
          t={t}
        />
      )}
    </MessageComposer>
  );
}

/** Split out so `useActionGate` is called from a component, not a callback. */
function ComposerBody(props: {
  value: string;
  setValue: (next: string) => void;
  isSending: boolean;
  send: () => void;
  maxLength: number;
  length: number;
  availability: Parameters<typeof useActionGate>[0];
  errorNode: ReactElement | null;
  t: (key: string, params?: Readonly<Record<string, unknown>>) => string;
}): ReactElement {
  const gate = useActionGate(props.availability);
  const { t } = props;
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      {props.errorNode}
      <Input.TextArea
        value={props.value}
        onChange={(event) => props.setValue(event.target.value)}
        placeholder={t(CHAT_I18N_KEYS.composerPlaceholder)}
        autoSize={{ minRows: 2, maxRows: 6 }}
        data-testid="chat-composer-input"
      />
      <Flex align="center" gap={spacing[3]} wrap="wrap">
        <Button
          type="primary"
          disabled={gate.disabled}
          loading={props.isSending}
          onClick={props.send}
          data-testid="chat-composer-send"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {props.isSending
            ? t(CHAT_I18N_KEYS.composerSending)
            : t(CHAT_I18N_KEYS.composerSend)}
        </Button>
        {/* A switched-off control states its reason as TEXT: a disabled
            button takes no pointer events, so a tooltip would be a reason
            nobody can read. */}
        {gate.reason ? (
          <Typography.Text type="secondary" data-testid="chat-composer-blocked">
            {gate.reason}
          </Typography.Text>
        ) : null}
        <Typography.Text type="secondary" style={{ marginLeft: "auto" }}>
          {`${props.length}/${props.maxLength}`}
        </Typography.Text>
      </Flex>
    </Space>
  );
}

export function ConversationThreadPanel(
  props: ConversationThreadPanelProps
): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const errorDisplay = useErrorDisplay(CHAT_I18N_KEYS.unknownError);

  return (
    <ConversationThread
      conversationId={props.conversationId}
      {...(props.limit !== undefined ? { limit: props.limit } : {})}
    >
      {({
        state,
        hasOlder,
        isLoadingOlder,
        loadOlder,
        refetch,
        transport,
        degraded,
      }) => (
        <Card data-testid="chat-thread">
          {/* WRAPS, and the tag's own text wraps inside it. The degradation
              copy is a full sentence ("Live messages stopped — sign in again
              to get them back"), and in a nowrap row at 390px it had nowhere
              to go: the flex line could not shrink below its content, so the
              header pushed the card sideways and the one thing on this screen
              a person can ACT on was the part that went off the edge. Mobile
              first is not a width the desktop layout survives — it is the
              width the layout is decided at. */}
          <Flex
            justify="space-between"
            align="center"
            wrap="wrap"
            gap={spacing[2]}
            style={{ marginBottom: spacing[3] }}
          >
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t(CHAT_I18N_KEYS.listTitle)}
            </Typography.Title>
            {/* When the socket is not carrying this thread, the label says
                WHY — a degraded transport that renders as a plain "refreshing
                every few seconds" is the thing that made this pair's broken
                handshake look like a design decision for months. */}
            <Tag
              data-testid="chat-transport"
              data-transport={transport}
              // antd's Tag is `white-space: nowrap` by default; a degradation
              // is a sentence, not a word, so it is allowed to take two lines
              // instead of one very long one. `marginInlineEnd: 0` because the
              // Flex gap owns the spacing now.
              style={{ whiteSpace: "normal", marginInlineEnd: 0 }}
              {...(degraded
                ? {
                    "data-degraded": degraded.reason,
                    color: DEGRADED_TAG_COLORS[degraded.reason],
                  }
                : {})}
            >
              {degraded ? t(degraded.messageKey) : t(TRANSPORT_KEYS[transport])}
            </Tag>
          </Flex>

          {matchList(state, {
            loading: () => <Spin />,
            failed: (error) => (
              <div data-testid="chat-thread-error">
                <ErrorAlert error={errorDisplay(error)} />
                <Button
                  style={{ marginTop: spacing[3] }}
                  onClick={refetch}
                  data-analytics="none"
                  data-analytics-reason="recovery affordance for a failed read — host app wraps with its own tracked()"
                >
                  {t(CHAT_I18N_KEYS.threadRetry)}
                </Button>
              </div>
            ),
            empty: () => (
              <Empty
                data-testid="chat-thread-empty"
                description={t(CHAT_I18N_KEYS.threadEmpty)}
              />
            ),
            ready: (messages) => (
              <Space direction="vertical" style={{ width: "100%" }}>
                {hasOlder ? (
                  <Button
                    loading={isLoadingOlder}
                    onClick={loadOlder}
                    data-testid="chat-thread-older"
                    data-analytics="none"
                    data-analytics-reason="business action — host app wraps with its own tracked()"
                  >
                    {t(CHAT_I18N_KEYS.threadLoadOlder)}
                  </Button>
                ) : (
                  <Typography.Text type="secondary">
                    {t(CHAT_I18N_KEYS.threadBeginning)}
                  </Typography.Text>
                )}
                <Flex vertical gap={spacing[2]} style={{ width: "100%" }}>
                  {messages.map((message) => (
                    <MessageRow
                      key={message.id}
                      message={message}
                      viewerId={props.viewerId}
                      locale={locale}
                    />
                  ))}
                </Flex>
              </Space>
            ),
          })}

          <div style={{ marginTop: spacing[4] }}>
            <Composer
              conversationId={props.conversationId}
              maxLength={props.maxLength}
            />
          </div>
        </Card>
      )}
    </ConversationThread>
  );
}
