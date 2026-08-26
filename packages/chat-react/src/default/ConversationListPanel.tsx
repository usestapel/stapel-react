/**
 * `<ConversationListPanel/>` — the default skin for the inbox, and the screen
 * this pair's nav manifest mounts (`chat.conversations`, member surface).
 *
 * Built entirely on the headless `<ConversationList>`: this file makes visual
 * decisions and nothing else.
 */
import { spacing } from "@stapel/tokens-antd";
import type { ReactElement } from "react";
import { Badge, Button, Card, Empty, Flex, List, Space, Spin, Typography } from "antd";
import { matchList, useErrorDisplay, useI18n, useT } from "@stapel/core";
import type { Conversation } from "../api/types.js";
import { ConversationList } from "../headless/ConversationList.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { TransportTag } from "./TransportTag.js";

const KIND_KEYS: Record<string, string> = {
  direct: CHAT_I18N_KEYS.kindDirect,
  group: CHAT_I18N_KEYS.kindGroup,
  support: CHAT_I18N_KEYS.kindSupport,
};

export interface ConversationListPanelProps {
  /**
   * WHO IS READING. The inbox stream is `chat:user:<id>` and the server
   * derives that key from the authenticated scope, so it cannot be guessed —
   * a client subscribed under the wrong id gets a socket that delivers
   * nothing, silently. Without it this screen polls, and the tag says so.
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

export function ConversationListPanel(
  props: ConversationListPanelProps = {}
): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  // Never the raw `.message` — for a response with no error envelope that is
  // the transport's own "Request failed with status 500".
  const errorDisplay = useErrorDisplay(CHAT_I18N_KEYS.unknownError);
  const { openHref, onOpen } = props;

  const renderRow = (row: Conversation): ReactElement => {
    const kindKey = KIND_KEYS[row.kind] ?? CHAT_I18N_KEYS.kindDirect;
    const title = t(kindKey);
    return (
      <List.Item
        data-testid="chat-conversation-row"
        extra={
          row.unread_count > 0 ? (
            <Badge
              count={row.unread_count}
              // A bare number is not information: read aloud, this row was
              // "Direct, 2". The sentence used to travel in `title=`, which is
              // a browser hover — absent on every phone, unreachable by
              // keyboard, and announced inconsistently (some readers say it
              // INSTEAD of the label). So it is the badge's accessible NAME
              // instead. `role="img"` is what makes the name computable: an
              // `aria-label` on a bare `<span>` names nothing, because a span
              // has no role for a name to attach to. `img` is the right one —
              // a graphic standing in for a sentence, opaque to the reader,
              // with a text alternative — and it is not `status`, which would
              // make every refetch announce itself over whatever is being read.
              role="img"
              aria-label={t(CHAT_I18N_KEYS.listUnread, { count: row.unread_count })}
            />
          ) : null
        }
      >
        <List.Item.Meta
          title={
            openHref ? (
              <Typography.Link href={openHref(row.id)}>{title}</Typography.Link>
            ) : onOpen ? (
              <Button
                type="link"
                style={{ padding: 0 }}
                onClick={() => onOpen(row.id)}
                data-analytics="none"
                data-analytics-reason="navigation into a thread — the host app wraps this with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
              >
                {title}
              </Button>
            ) : (
              // Neither route given: a title, not a control that goes
              // nowhere. A dead affordance is worse than none.
              <Typography.Text strong>{title}</Typography.Text>
            )
          }
          description={
            <Typography.Text type="secondary">
              {relativeTime(locale, row.updated_at)}
            </Typography.Text>
          }
        />
      </List.Item>
    );
  };

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
      }) => (
        <Card data-testid="chat-conversation-list">
          {/* The list has a socket of its own now (`ws/chat/inbox`), so it
              gets the same sentence the thread does. A conversation list that
              refreshes on a timer forever is a polling chat however live the
              open thread is — and until this cutover nobody was told. */}
          <Flex justify="space-between" align="center" wrap="wrap" gap={spacing[2]}>
            <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
              {t(CHAT_I18N_KEYS.listTitle)}
            </Typography.Title>
            <TransportTag transport={transport} degraded={degraded} />
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
                <List<Conversation>
                  style={{ marginTop: spacing[4] }}
                  dataSource={[...rows]}
                  rowKey={(row) => row.id}
                  renderItem={renderRow}
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
      )}
    </ConversationList>
  );
}
