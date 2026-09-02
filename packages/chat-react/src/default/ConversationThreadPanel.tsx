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
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Card, Empty, Flex, Input, Space, Spin, Typography } from "antd";
import {
  isLoadReady,
  matchList,
  useActionGate,
  useErrorDisplay,
  useI18n,
  useT,
} from "@stapel/core";
import type { ChatMessage, Conversation } from "../api/types.js";
import { ConversationThread } from "../headless/ConversationThread.js";
import { MessageComposer } from "../headless/MessageComposer.js";
import { useChatNotifications } from "../model/notifications.js";
import { useConversation } from "../model/queries.js";
import type { ChatPeopleDirectory } from "../model/slots.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { TransportTag } from "./TransportTag.js";
import { ChatSkinTheme } from "./theme.js";
import { ThreadActionsMenu } from "./ThreadActionsMenu.js";
import { ChatNotificationsPrompt } from "./ChatNotificationsPrompt.js";
import { PresenceLine } from "./PresenceLine.js";
import { SubjectCard } from "./subjectCard.js";
import {
  CounterpartyAvatar,
  PeopleScope,
  counterpartyIds,
  useCounterpartyLabel,
} from "./people.js";

export interface ConversationThreadPanelProps {
  conversationId: string;
  /**
   * The reader, when the host knows them — used to align their own lines, to
   * name the OTHER side in the header, and to tell report/block which person
   * they are about. Absent, every message is rendered the same way rather
   * than guessed at.
   */
  viewerId?: string | null;
  limit?: number;
  maxLength?: number;
  /**
   * Offer browser notifications for messages that arrive while this tab is
   * hidden, and ask for the permission at the first message exchanged.
   * Default `true`; `false` turns the whole offer off for deployments that do
   * not want it, rather than leaving a skin to hide the prompt.
   */
  notifications?: boolean;
}

/** A stable empty list — a fresh `[]` per render would re-run a host's batch. */
const NO_PEOPLE: readonly string[] = [];

/**
 * WHO this is with, WHAT it is about, and the two verbs a conversation needs.
 *
 * The conversation row is read here (`useConversation`) rather than demanded
 * from the host: it carries the participants, the subject, and the server's
 * own `stream_key`/`socket_path`, and it is the same cache entry the inbox
 * and "message the seller" already seed. A failed read costs the header, not
 * the thread — the messages are the screen, and they have their own arm.
 */
function ThreadHeader(props: {
  readonly conversation: Conversation | undefined;
  readonly viewerId: string | null;
  readonly directory: ChatPeopleDirectory;
  readonly conversationId: string;
  readonly transportTag: ReactNode;
}): ReactElement {
  const t = useT();
  const { conversation, viewerId } = props;
  // With no row there is nobody to name and nothing to be wrong about: the
  // screen keeps its plain title rather than announcing a failure that is
  // the header's, not the person's.
  const fallback = t(CHAT_I18N_KEYS.listTitle);
  const others = conversation === undefined ? [] : counterpartyIds(conversation, viewerId);
  return (
    <Flex
      justify="space-between"
      align="center"
      wrap="wrap"
      gap={spacing[2]}
      style={{ marginBottom: spacing[3] }}
    >
      <Flex align="center" gap={spacing[3]} style={{ minWidth: 0 }}>
        {conversation !== undefined ? (
          <CounterpartyAvatar
            conversation={conversation}
            viewerId={viewerId}
            directory={props.directory}
            label={fallback}
          />
        ) : null}
        {/* The name, and UNDER it the one sentence that is actually about
            the other person. It is deliberately not a tag beside the title:
            the tag slot on the right belongs to this client's own transport,
            and the two facts sharing one control is the defect. */}
        <Flex vertical gap={0} style={{ minWidth: 0 }}>
          <Typography.Title
            level={4}
            style={{ margin: 0, minWidth: 0 }}
            data-testid="chat-thread-title"
          >
            {conversation === undefined ? (
              fallback
            ) : (
              <ThreadTitle
                conversation={conversation}
                viewerId={viewerId}
                directory={props.directory}
              />
            )}
          </Typography.Title>
          <PresenceLine conversation={conversation} viewerId={viewerId} />
        </Flex>
      </Flex>
      <Flex align="center" gap={spacing[2]}>
        {/* When the socket is not carrying this thread, the label says WHY —
            a degraded transport that renders as a plain "refreshing every few
            seconds" is the thing that made this pair's broken handshake look
            like a design decision for months. */}
        {props.transportTag}
        <ThreadActionsMenu
          conversationId={props.conversationId}
          counterpartyId={others.length === 1 ? (others[0] ?? null) : null}
          viewerId={viewerId}
        />
      </Flex>
    </Flex>
  );
}

/** Split out so the label hook is called from a component, not a branch. */
function ThreadTitle(props: {
  readonly conversation: Conversation;
  readonly viewerId: string | null;
  readonly directory: ChatPeopleDirectory;
}): ReactElement {
  const label = useCounterpartyLabel(
    props.conversation,
    props.viewerId,
    props.directory
  );
  return <>{label}</>;
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
      {(bag) => (
        <ComposerBody
          value={bag.value}
          setValue={bag.setValue}
          isSending={bag.isSending}
          send={bag.send}
          maxLength={bag.maxLength}
          length={bag.length}
          availability={bag.availability}
          visibleAvailability={bag.visibleAvailability}
          pristine={bag.pristine}
          errorNode={<ErrorAlert error={errorDisplay(bag.error)} />}
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
  visibleAvailability: Parameters<typeof useActionGate>[0];
  pristine: boolean;
  errorNode: ReactElement | null;
  t: (key: string, params?: Readonly<Record<string, unknown>>) => string;
}): ReactElement {
  // Two readings of the same verdict: `gate` switches the control off,
  // `earned` decides whether the reason is on screen. An untouched box has
  // failed nothing, so it stays neutral — a disabled send button is not an
  // error state, and after a successful send the composer is untouched again.
  const gate = useActionGate(props.availability);
  const earned = useActionGate(props.visibleAvailability);
  const { t } = props;
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      {props.errorNode}
      <Input.TextArea
        value={props.value}
        onChange={(event) => props.setValue(event.target.value)}
        /* Enter SENDS (D35). On a hardware keyboard Enter in a message box is
           "send" in every messenger a person has met; without this the walker
           typed, hit Enter, and watched the draft sit in the field with a
           newline in it. Shift+Enter keeps the newline — the same split every
           desktop messenger draws — and a phone's soft keyboard is untouched:
           its return key inserts the newline without a keydown this handler
           acts on being distinguishable, and the send button sits beside the
           field either way. `isComposing` guards an IME mid-composition,
           where Enter commits the candidate and must never post it. `send()`
           enforces the same gate the button obeys, so Enter can never post
           what the button refuses — and pressing it over an empty box asks
           the question, which is what puts the reason on screen. */
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          if (event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (props.isSending) return;
          props.send();
        }}
        placeholder={t(CHAT_I18N_KEYS.composerPlaceholder)}
        autoSize={{ minRows: 2, maxRows: 6 }}
        data-testid="chat-composer-input"
        /* Measurable neutrality: an untouched box carries no validation
           state, so a suite asserts the absence rather than a colour. */
        data-pristine={String(props.pristine)}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
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
            nobody can read. From the EARNED gate, so a composer nobody has
            written in yet says nothing at all. */}
        {earned.reason ? (
          <Typography.Text type="secondary" data-testid="chat-composer-blocked">
            {earned.reason}
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
  // The row behind the header. Its failure is deliberately NOT surfaced: a
  // header that could not be built must not take the messages down with it.
  const conversation = useConversation(props.conversationId).data;
  const viewerId = props.viewerId ?? null;
  const subject = conversation?.subject ?? null;
  const notifications = props.notifications ?? true;

  // A notification for a message that arrived while this tab was behind
  // something else. It spends a permission somebody granted and asks for
  // nothing itself — the asking is `<ChatNotificationsPrompt/>` below, at a
  // moment that has earned the question.
  const onSignal = useChatNotifications({
    viewerId,
    enabled: notifications,
    copy: (signal) => {
      const body = signal.message.body.trim();
      if (body === "") return null; // an attachment-only line names nothing yet
      return { title: t(CHAT_I18N_KEYS.notifyFrom), body };
    },
  });

  return (
    <ConversationThread
      conversationId={props.conversationId}
      {...(conversation !== undefined ? { conversation } : {})}
      {...(props.limit !== undefined ? { limit: props.limit } : {})}
      {...(notifications ? { onSignal } : {})}
    >
      {({
        state,
        hasOlder,
        isLoadingOlder,
        loadOlder,
        refetch,
        transport,
        degraded,
        status,
        lastSeq,
      }) => (
        <ChatSkinTheme>
          <Card data-testid="chat-thread">
          {/* The header WRAPS, and the tag's own text wraps inside it. The
              degradation copy is a full sentence ("Live messages stopped —
              sign in again to get them back"), and in a nowrap row at 390px it
              had nowhere to go: the flex line could not shrink below its
              content, so the header pushed the card sideways and the one thing
              on this screen a person can ACT on was the part that went off the
              edge. Mobile first is not a width the desktop layout survives —
              it is the width the layout is decided at. */}
          <PeopleScope
            userIds={
              conversation === undefined
                ? NO_PEOPLE
                : counterpartyIds(conversation, viewerId)
            }
          >
            {(directory) => (
              <ThreadHeader
                conversation={conversation}
                viewerId={viewerId}
                directory={directory}
                conversationId={props.conversationId}
                transportTag={
                  <TransportTag
                    transport={transport}
                    degraded={degraded}
                    status={status}
                  />
                }
              />
            )}
          </PeopleScope>

          {/* WHAT THIS IS ABOUT, pinned. A thread with a subject shows the
              subject owner's own card; a thread without one shows nothing,
              which is exactly the difference between the two threads a
              subject-widened `direct_key` can produce for the same pair. */}
          {subject !== null ? (
            <SubjectCard subject={subject} conversationId={props.conversationId} />
          ) : null}

          {/* The ask, at the first message exchanged — never on arrival.
              `denied` is terminal, so a prompt on page load spends the only
              chance this product gets. */}
          {notifications ? (
            <ChatNotificationsPrompt lastSeq={lastSeq} ready={isLoadReady(state)} />
          ) : null}

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
                description={t(
                  subject === null
                    ? CHAT_I18N_KEYS.threadEmpty
                    : CHAT_I18N_KEYS.threadEmptySubject
                )}
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
        </ChatSkinTheme>
      )}
    </ConversationThread>
  );
}
