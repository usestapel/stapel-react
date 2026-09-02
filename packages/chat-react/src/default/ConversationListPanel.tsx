/**
 * `<ConversationListPanel/>` — the default skin for the inbox, and the screen
 * this pair's nav manifest mounts (`chat.conversations`, member surface).
 *
 * ── What a row says now, and what it used to say ──────────────────────────
 *
 * It used to say the conversation's KIND. A seller with ten buyers therefore
 * read ten rows headed "Direct message", told apart only by a timestamp — an
 * inbox in which nothing is addressed to anybody. A row now carries the four
 * things a chat row is made of:
 *
 *   WHO   the counterparty's name and avatar, resolved in ONE batch for the
 *         whole page through the host seam (`model/slots.ts` — names live in
 *         a peer pair this one may not import), and said to be UNAVAILABLE
 *         when nothing answered, never quietly replaced by a category label;
 *   WHAT  the subject the thread is about (stapel-chat 0.6.0), and the last
 *         line when this client holds it (`model/previews.ts` — the list
 *         endpoint serves no preview, and inventing one is worse than none);
 *   WHEN  the clock, as `Intl` renders it for the reader's locale;
 *   NEWS  the server's own unread count, with its accessible sentence.
 *
 * Built entirely on the headless `<ConversationList>`: this file makes visual
 * decisions and nothing else.
 */
import { spacing } from "@stapel/tokens-antd";
import { ListRow } from "@stapel/tokens-antd/skin";
import type { ReactElement } from "react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Flex,
  List,
  Space,
  Spin,
  Typography,
  theme as antdTheme,
} from "antd";
import { matchList, useErrorDisplay, useI18n, useT } from "@stapel/core";
import type { ChatMessage, Conversation } from "../api/types.js";
import { ConversationList } from "../headless/ConversationList.js";
import { useThreadPreviews } from "../model/previews.js";
import type { ChatPeopleDirectory } from "../model/slots.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { TransportTag } from "./TransportTag.js";
import { ChatSkinTheme } from "./theme.js";
import {
  CounterpartyAvatar,
  PeopleScope,
  conversationPeopleIds,
  useCounterpartyLabel,
} from "./people.js";
import { subjectRowLabel } from "./subjectCard.js";

export interface ConversationListPanelProps {
  /**
   * WHO IS READING. The inbox stream is `chat:user:<id>` and the server
   * derives that key from the authenticated scope, so it cannot be guessed —
   * a client subscribed under the wrong id gets a socket that delivers
   * nothing, silently. Without it this screen polls, and the tag says so.
   *
   * It is also what makes a row name the OTHER person rather than everyone in
   * the thread, and what marks a preview as the reader's own line.
   */
  viewerId?: string | number | null;
  /** Page size for the underlying list. */
  limit?: number;
  /**
   * Where a row leads, as an href — the SSR-friendly half. A storefront
   * renders real links so a conversation is right-clickable and indexable by
   * the browser's own history, not only by a click handler.
   */
  openHref?: (conversationId: string) => string;
  /** Where a row leads, in a SPA. Used when `openHref` is not given. */
  onOpen?: (conversationId: string) => void;
  /**
   * The conversation that is OPEN, when this list is rendered beside its
   * thread (`<ConversationSplitPanel/>`). The matching row is painted with
   * the theme's selected-item background and carries `aria-current="page"` —
   * the same fact stated once for the eye and once for the reader. Default
   * undefined: the standalone inbox screen has no open thread beside it and
   * renders exactly as before.
   */
  selectedId?: string | null;
}

function relativeTime(locale: string, iso: string): string {
  // A timestamp is data, not copy: `Intl` localizes it from the host's own
  // locale, so it needs no i18n key and cannot go stale in a catalogue.
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

/**
 * One row of the inbox. A COMPONENT, not a callback: it reads the i18n
 * engine, and hooks called from inside a `renderItem` lambda would be ordered
 * by how many rows the page happens to have.
 */
function ConversationRow(props: {
  readonly row: Conversation;
  readonly viewerId: string | null;
  readonly directory: ChatPeopleDirectory;
  readonly preview: ChatMessage | undefined;
  readonly locale: string;
  readonly openHref: ((conversationId: string) => string) | undefined;
  readonly onOpen: ((conversationId: string) => void) | undefined;
}): ReactElement {
  const t = useT();
  const { row, viewerId, directory, openHref, onOpen } = props;
  const label = useCounterpartyLabel(row, viewerId, directory);
  const subject = row.subject ?? null;
  const subjectLabel =
    subject === null ? "" : subjectRowLabel(subject, props.locale);

  const title = openHref ? (
    <Typography.Link href={openHref(row.id)}>{label}</Typography.Link>
  ) : onOpen ? (
    <Button
      type="link"
      style={{ padding: 0 }}
      onClick={() => onOpen(row.id)}
      data-analytics="none"
      data-analytics-reason="navigation into a thread — the host app wraps this with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
    >
      {label}
    </Button>
  ) : (
    // Neither route given: a title, not a control that goes nowhere. A dead
    // affordance is worse than none.
    label
  );

  const preview = props.preview;
  const previewText =
    preview === undefined
      ? ""
      : preview.deleted === true
        ? t(CHAT_I18N_KEYS.listPreviewDeleted)
        : preview.kind === "system"
          ? t(CHAT_I18N_KEYS.threadSystem)
          : viewerId !== null && preview.sender_id === viewerId
            ? t(CHAT_I18N_KEYS.listPreviewOwn, { text: preview.body })
            : preview.body;

  const meta =
    subjectLabel === "" && previewText === "" ? undefined : (
      <>
        {subjectLabel !== "" ? (
          <span style={{ display: "block" }} data-testid="chat-row-subject">
            {subjectLabel}
          </span>
        ) : null}
        {previewText !== "" ? (
          <span style={{ display: "block" }} data-testid="chat-row-preview">
            {previewText}
          </span>
        ) : null}
      </>
    );

  return (
    <ListRow
      testId="chat-conversation-row"
      leading={
        <CounterpartyAvatar
          conversation={row}
          viewerId={viewerId}
          directory={directory}
          label={label}
        />
      }
      title={title}
      truncate
      {...(meta !== undefined ? { meta } : {})}
      {...(row.unread_count > 0
        ? {
            badge: (
              <Badge
                count={row.unread_count}
                // A bare number is not information: read aloud, this row was
                // "Direct, 2". The sentence used to travel in `title=`, which
                // is a browser hover — absent on every phone, unreachable by
                // keyboard, and announced inconsistently (some readers say it
                // INSTEAD of the label). So it is the badge's accessible NAME
                // instead. `role="img"` is what makes the name computable: an
                // `aria-label` on a bare `<span>` names nothing, because a
                // span has no role for a name to attach to. `img` is the right
                // one — a graphic standing in for a sentence, opaque to the
                // reader, with a text alternative — and it is not `status`,
                // which would make every refetch announce itself over
                // whatever is being read.
                role="img"
                aria-label={t(CHAT_I18N_KEYS.listUnread, {
                  count: row.unread_count,
                })}
              />
            ),
          }
        : {})}
      trailing={
        <Typography.Text type="secondary" style={{ whiteSpace: "nowrap" }}>
          {relativeTime(props.locale, row.updated_at)}
        </Typography.Text>
      }
    />
  );
}

/** The rows, once the names for the whole page have been asked for once. */
function InboxRows(props: {
  readonly rows: readonly Conversation[];
  readonly viewerId: string | null;
  readonly locale: string;
  readonly openHref: ((conversationId: string) => string) | undefined;
  readonly onOpen: ((conversationId: string) => void) | undefined;
  readonly selectedId: string | null;
}): ReactElement {
  const { rows, viewerId, selectedId } = props;
  const previews = useThreadPreviews(rows.map((row) => row.id));
  // The selected-item background comes from the token bag, never a literal:
  // a hex here would be right in exactly one of the two theme modes.
  const { token } = antdTheme.useToken();
  return (
    <PeopleScope userIds={conversationPeopleIds(rows, viewerId)}>
      {(directory) => (
        <List<Conversation>
          style={{ marginTop: spacing[4] }}
          dataSource={[...rows]}
          rowKey={(row) => row.id}
          renderItem={(row) => (
            <List.Item
              // The selection is the LIST ITEM's, not the title link's: the
              // whole row is what the eye finds again after reading the
              // thread, so the whole row is what gets the paint and the
              // `aria-current="page"` that says the same thing out loud.
              {...(selectedId !== null && row.id === selectedId
                ? {
                    "aria-current": "page" as const,
                    "data-chat-row-selected": "",
                    style: { background: token.colorPrimaryBg },
                  }
                : {})}
            >
              <ConversationRow
                row={row}
                viewerId={viewerId}
                directory={directory}
                preview={previews(row.id)}
                locale={props.locale}
                openHref={props.openHref}
                onOpen={props.onOpen}
              />
            </List.Item>
          )}
        />
      )}
    </PeopleScope>
  );
}

export function ConversationListPanel(
  props: ConversationListPanelProps = {}
): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  // Never the raw `.message` — for a response with no error envelope that is
  // the transport's own "Request failed with status 500".
  const errorDisplay = useErrorDisplay(CHAT_I18N_KEYS.unknownError);
  const { openHref, onOpen } = props;
  const selectedId = props.selectedId ?? null;
  const viewerId =
    props.viewerId === null || props.viewerId === undefined
      ? null
      : String(props.viewerId);

  return (
    <ConversationList
      {...(props.limit !== undefined ? { limit: props.limit } : {})}
      {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
    >
      {({
        state,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        refetch,
        transport,
        degraded,
        status,
      }) => (
        <ChatSkinTheme>
          <Card data-testid="chat-conversation-list">
          {/* The list has a socket of its own now (`ws/chat/inbox`), so it
              gets the same sentence the thread does. A conversation list that
              refreshes on a timer forever is a polling chat however live the
              open thread is — and until this cutover nobody was told. */}
          <Flex justify="space-between" align="center" wrap="wrap" gap={spacing[2]}>
            <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
              {t(CHAT_I18N_KEYS.listTitle)}
            </Typography.Title>
            <TransportTag transport={transport} degraded={degraded} status={status} />
          </Flex>

          {matchList(state, {
            loading: () => <Spin style={{ marginTop: spacing[4] }} />,
            // One arm owns the failure; the empty copy is unreachable from
            // here, so an outage can never render as "no conversations yet".
            failed: (error) => (
              <div style={{ marginTop: spacing[4] }} data-testid="chat-conversation-list-error">
                <ErrorAlert error={errorDisplay(error)} />
                <Button
                  style={{ marginTop: spacing[3] }}
                  onClick={refetch}
                  data-analytics="none"
                  data-analytics-reason="recovery affordance for a failed read — host app wraps with its own tracked()"
                >
                  {t(CHAT_I18N_KEYS.listRetry)}
                </Button>
              </div>
            ),
            empty: () => (
              <Empty
                style={{ marginTop: spacing[4] }}
                data-testid="chat-conversation-list-empty"
                description={t(CHAT_I18N_KEYS.listEmpty)}
              />
            ),
            ready: (rows) => (
              <Space direction="vertical" style={{ width: "100%" }}>
                <InboxRows
                  rows={rows}
                  viewerId={viewerId}
                  locale={locale}
                  openHref={openHref}
                  onOpen={onOpen}
                  selectedId={selectedId}
                />
                {hasNextPage ? (
                  <Button
                    loading={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                    data-analytics="none"
                    data-analytics-reason="business action — host app wraps with its own tracked()"
                  >
                    {t(CHAT_I18N_KEYS.listLoadMore)}
                  </Button>
                ) : (
                  <Typography.Text type="secondary">
                    {t(CHAT_I18N_KEYS.listEnd)}
                  </Typography.Text>
                )}
              </Space>
            ),
          })}
          </Card>
        </ChatSkinTheme>
      )}
    </ConversationList>
  );
}
