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
 *
 * ── Two destinations, two hit areas (D420) ────────────────────────────────
 *
 * A row leads to its THREAD, and the subject line under it leads to the
 * LISTING. Neither can contain the other — an anchor inside an anchor is not
 * a document, a link inside a `role="button"` is a control inside a control —
 * so the row control covers the identity line and the clock, and the subject
 * strip sits beneath it as a sibling, indented to the same text column. The
 * inbox held zero links to a listing before this: the one move a seller
 * standing in their messages wants to make had to be made by searching for
 * the listing again.
 *
 * ── Finding one of them ───────────────────────────────────────────────────
 *
 * The pane heading carries a toolbar: a search box over the three things a
 * row is made of (WHO / WHAT / the last line) and an "Unread" chip over the
 * server's own `unread_count`. Both narrow the conversations this client has
 * LOADED, because the list endpoint takes anchor/direction/limit and nothing
 * else — so while there is more to load the pane says which conversations it
 * is filtering (`inboxFilter.ts` carries the reasoning and the upstream ask).
 * The two empty states stay different sentences: "no conversations" is the
 * inbox being empty, "nothing found" is the filter finding nothing in it.
 */
import { spacing } from "@stapel/tokens-antd";
import { ListRow } from "@stapel/tokens-antd/skin";
import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  List,
  Space,
  Spin,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import { matchList, useErrorDisplay, useI18n, useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import type { ChatMessage, Conversation, Subject } from "../api/types.js";
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
  counterpartyLabel,
  useCounterpartyLabel,
} from "./people.js";
import { SubjectRowSummary, readSubjectCard, subjectRowLabel } from "./subjectCard.js";
import {
  inboxFilterActive,
  matchesInboxFilter,
  normalizeSearch,
  previewSearchText,
} from "./inboxFilter.js";

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
  /**
   * Where the SUBJECT of a row lives — the listing the thread is about.
   *
   * Absent, the row links to the card's own `url`, which is the field the
   * subject provider already serves (`classified.subject_cards`), so a
   * deployment that resolves subjects at all needs nothing here. Pass it when
   * the app's routes are not the ones the provider knows; return `undefined`
   * for a subject with nowhere to go and the title stays plain text.
   */
  subjectHref?: (subject: Subject) => string | undefined;
  /**
   * The router's link, for the subject title — so that one target is a
   * client-side navigation. A plain `<a href>` otherwise: right-clickable and
   * correct, just a full page load.
   */
  linkComponent?: LinkComponent;

  // ── The toolbar (search + unread) ─────────────────────────────────────────
  //
  // Both controls are CONTROLLED-OR-NOT, the platform's own `value` /
  // `defaultValue` shape: a storefront that passes nothing gets a working
  // toolbar with no wiring at all, and a host that wants the query in its URL
  // passes `search` + `onSearchChange` and owns it. That is the whole reason
  // this is a pair of props rather than one — a screen whose filter survives
  // a reload cannot be built on internal state, and a screen that just wants
  // a search box should not have to build one.

  /**
   * The search text, CONTROLLED. Given, this panel never changes it on its
   * own — pair it with {@link onSearchChange}.
   */
  search?: string;
  /** The search text a self-managing toolbar starts with. Default `""`. */
  defaultSearch?: string;
  /** Fired on every keystroke, in both modes. */
  onSearchChange?: (search: string) => void;
  /** The unread chip, CONTROLLED. Pair with {@link onUnreadOnlyChange}. */
  unreadOnly?: boolean;
  /** What the chip starts as when this panel owns it. Default `false`. */
  defaultUnreadOnly?: boolean;
  /** Fired when the chip is pressed, in both modes. */
  onUnreadOnlyChange?: (unreadOnly: boolean) => void;
  /**
   * Draw the toolbar. Default: yes.
   *
   * `false` hides the CONTROLS, not the filter — a host that drives `search`
   * / `unreadOnly` from chrome of its own (a page-level search field, a tab
   * bar) still gets a filtered list, which is the only reason to switch the
   * built-in one off.
   */
  filters?: boolean;
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
  readonly subjectHref: ((subject: Subject) => string | undefined) | undefined;
  readonly linkComponent: LinkComponent | undefined;
}): ReactElement {
  const t = useT();
  const { row, viewerId, directory, openHref, onOpen } = props;
  const label = useCounterpartyLabel(row, viewerId, directory);
  const subject = row.subject ?? null;
  const subjectView = subject === null ? null : readSubjectCard(subject, props.locale);
  // A card with nothing renderable (no title, price or photo) is the same as
  // no subject at all for this line — the row draws nothing rather than an
  // empty flex gap.
  const hasSubjectSummary =
    subjectView !== null &&
    (subjectView.title !== "" || subjectView.price !== "" || subjectView.imageUrl !== null);

  // The name is TEXT, and the whole row is the control (D65 — see `openRow`
  // below). It used to be the other way round: a link-styled name inside a
  // 300x80 row, so a click on the preview, the subject or the clock did
  // nothing. The person's name leads nowhere the row does not already lead,
  // so it stays text; the one destination that is NOT this row's — the
  // listing — gets its own link, outside the row control (see `strip`).
  const title = label;

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
    previewText === "" ? undefined : (
      <span style={{ display: "block" }} data-testid="chat-row-preview">
        {previewText}
      </span>
    );

  const inside = (
    <ListRow
      testId="chat-row-body"
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
        <Typography.Text
          type="secondary"
          style={{ whiteSpace: "nowrap" }}
          data-chat-row-clock=""
        >
          {relativeTime(props.locale, row.updated_at)}
        </Typography.Text>
      }
    />
  );

  // THE SUBJECT STRIP IS A SIBLING OF THE ROW CONTROL, NOT ITS CHILD (D420).
  //
  // The row is one control that opens the CONVERSATION (D65), and the subject
  // title is a link that opens the LISTING — two destinations, so two hit
  // areas, and there is no arrangement in which one contains the other: an
  // anchor inside an anchor is not a document the browser will parse back,
  // and a link inside a `role="button"` is a control inside a control. So the
  // strip moves out from under the row control and sits beneath it, indented
  // to the text column so the row still reads as one row.
  const strip =
    hasSubjectSummary && subject !== null ? (
      <div
        style={{ paddingInlineStart: SUBJECT_INDENT, minWidth: 0 }}
        data-chat-row-subject-slot=""
      >
        <SubjectRowSummary
          subject={subject}
          locale={props.locale}
          {...(props.subjectHref !== undefined
            ? // An explicit resolver's answer WINS, `undefined` included: a
              // host that says "this subject has nowhere to go" gets plain
              // text, not a quiet fall back to the card's own url.
              { href: props.subjectHref(subject) ?? "" }
            : {})}
          {...(props.linkComponent !== undefined
            ? { linkComponent: props.linkComponent }
            : {})}
        />
      </div>
    ) : null;

  return (
    <div
      data-testid="chat-conversation-row"
      data-chat-conversation-id={row.id}
      style={{ minWidth: 0 }}
    >
      {openRow(inside, row.id, openHref, onOpen)}
      {strip}
    </div>
  );
}

/**
 * How far the subject strip is indented so it lines up with the row's text
 * column instead of starting under the avatar.
 *
 * The avatar's own measure plus the gap `ListRow` puts after it — both steps
 * of the token scale, so a denser skin moves the two together.
 */
const SUBJECT_INDENT = spacing[7] + spacing[4];

/** The class the whole-row control carries, for {@link conversationRowCss}. */
export const ROW_OPEN_CLASS = "stapel-chat-row-open";

/**
 * The `href` the hoisted row stylesheet is deduplicated by. It IS the class
 * name: the key only has to be stable and unique to this sheet, and the class
 * already is both, so a second string bought nothing.
 */
const ROW_STYLE_HREF = ROW_OPEN_CLASS;

/**
 * The one rule an inline style cannot state: `:focus-visible`.
 *
 * The row IS the control, and D65 made it so by wrapping the whole row in an
 * anchor (or a `role="button"` div) styled `color: inherit; text-decoration:
 * none` — a hit area with no chrome of its own. What went with the chrome was
 * the focus ring: a keyboard walk of the live inbox landed on this element
 * and, measured, reported `outline-style: none` and no box-shadow, so a
 * person tabbing through their conversations could not see which one Enter
 * would open. The whole row is also the largest focus target on the screen,
 * which makes an unringed one the most conspicuously missing.
 *
 * `--stapel-focus-ring` is the design system's own role token, the same one
 * every other ringed control in the fleet reads; the radius follows antd's
 * `List.Item` so the ring hugs the row instead of cutting its corners.
 */
export function conversationRowCss(): string {
  return (
    `.${ROW_OPEN_CLASS}:focus-visible{outline:2px solid var(--stapel-focus-ring);` +
    `outline-offset:-2px;border-radius:8px}`
  );
}

/**
 * THE WHOLE ROW IS THE CONTROL (D65).
 *
 * An href row becomes a real anchor around the whole row — right-clickable,
 * middle-clickable, in the browser's own history — and a SPA row becomes a
 * keyboard-operable button with the same hit area. Neither route given: the
 * row is drawn as-is, because a dead affordance is worse than none.
 *
 * `color: inherit` / `textDecoration: none`: the anchor is a hit area, not a
 * link's look — the row already says what it is with an avatar, a name and a
 * clock, and painting all of that link-blue would be a second, worse title.
 */
function openRow(
  inside: ReactElement,
  conversationId: string,
  openHref: ((conversationId: string) => string) | undefined,
  onOpen: ((conversationId: string) => void) | undefined
): ReactElement {
  const cover = { display: "block", color: "inherit", textDecoration: "none" };
  // One element, not one per branch: only one branch ever renders, and React
  // dedupes the hoist by `href` anyway, so writing it twice bought two
  // identical `jsx()` calls in the bundle and nothing else.
  const rowStyle = (
    <style href={ROW_STYLE_HREF} precedence="default">
      {conversationRowCss()}
    </style>
  );
  if (openHref) {
    return (
      <>
      {rowStyle}
      <a
        href={openHref(conversationId)}
        style={cover}
        className={ROW_OPEN_CLASS}
        data-chat-row-open=""
        data-analytics="none"
        data-analytics-reason="navigation into a thread — the host app wraps this with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      >
        {inside}
      </a>
      </>
    );
  }
  if (onOpen) {
    return (
      <>
      {rowStyle}
      <div
        role="button"
        tabIndex={0}
        style={{ ...cover, cursor: "pointer" }}
        className={ROW_OPEN_CLASS}
        data-chat-row-open=""
        data-analytics="none"
        data-analytics-reason="navigation into a thread — the host app wraps this with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        onClick={() => {
          onOpen(conversationId);
        }}
        onKeyDown={(event) => {
          // Enter and Space are what a button answers to; a div claiming the
          // role has to answer to them itself.
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onOpen(conversationId);
        }}
      >
        {inside}
      </div>
      </>
    );
  }
  return inside;
}

/**
 * The rows, once the names for the whole page have been asked for once — and
 * once the toolbar has had its say.
 *
 * THE FILTER RUNS INSIDE THE PEOPLE SCOPE, and it has to: a row is searchable
 * by the counterpart's NAME, and the name only exists once the host's seam has
 * answered. The ids handed to that seam are the whole loaded page's, never the
 * visible subset — narrowing them would re-key the batch on every keystroke
 * and pay a profile request per character typed.
 */
function InboxRows(props: {
  readonly rows: readonly Conversation[];
  readonly viewerId: string | null;
  readonly locale: string;
  readonly openHref: ((conversationId: string) => string) | undefined;
  readonly onOpen: ((conversationId: string) => void) | undefined;
  readonly subjectHref: ((subject: Subject) => string | undefined) | undefined;
  readonly linkComponent: LinkComponent | undefined;
  readonly selectedId: string | null;
  /** Already normalized (`normalizeSearch`); `""` filters nothing. */
  readonly needle: string;
  readonly unreadOnly: boolean;
}): ReactElement {
  const { rows, viewerId, selectedId, needle, unreadOnly, locale } = props;
  const t = useT();
  const previews = useThreadPreviews(rows.map((row) => row.id));
  // The selected-item background comes from the token bag, never a literal:
  // a hex here would be right in exactly one of the two theme modes.
  const { token } = antdTheme.useToken();
  return (
    <PeopleScope userIds={conversationPeopleIds(rows, viewerId)}>
      {(directory) => {
        const visible = rows.filter((row) =>
          matchesInboxFilter(
            row,
            {
              // The same three strings the row draws — see `counterpartyLabel`
              // on why the label's rules are not written twice.
              person: counterpartyLabel(row, viewerId, directory, t),
              subject: row.subject ? subjectRowLabel(row.subject, locale) : "",
              preview: previewSearchText(previews(row.id)),
            },
            { needle, unreadOnly, locale }
          )
        );
        // The filter found nothing — which is NOT "no conversations yet", and
        // saying so with the inbox's own empty copy would tell a person with
        // three hundred threads that they have none.
        if (visible.length === 0) {
          return (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ marginTop: spacing[4] }}
              data-testid="chat-conversation-list-no-matches"
              description={t(CHAT_I18N_KEYS.listNoMatches)}
            />
          );
        }
        return (
        <List<Conversation>
          style={{ marginTop: spacing[4] }}
          dataSource={[...visible]}
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
                subjectHref={props.subjectHref}
                linkComponent={props.linkComponent}
              />
            </List.Item>
          )}
        />
        );
      }}
    </PeopleScope>
  );
}

/**
 * A value this panel owns until a host takes it — the platform's own
 * `value` / `defaultValue` shape, written once for both controls.
 *
 * `onChange` fires in BOTH modes: a host that only wants to observe the query
 * (to put it in the URL, to count it) passes the callback and nothing else,
 * and a host that passes the value owns it completely — this panel then never
 * moves it on its own, which is what makes a filter survive a reload.
 */
function useControlledValue<T>(
  controlled: T | undefined,
  initial: T,
  onChange: ((next: T) => void) | undefined
): readonly [T, (next: T) => void] {
  const [own, setOwn] = useState(initial);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : own;
  const set = useCallback(
    (next: T) => {
      if (!isControlled) setOwn(next);
      onChange?.(next);
    },
    [isControlled, onChange]
  );
  return [value, set] as const;
}

/**
 * The toolbar under the pane heading: one row that wraps.
 *
 * ONE ROW, WRAPPING — not a bar that scrolls and not two rows on a phone. The
 * input takes the width that is left (`flex: 1 1 …`, `minWidth: 0`, so a long
 * placeholder cannot widen the pane it sits in) and the chip keeps its own,
 * so a narrow phone pane drops the chip onto a second line rather than
 * squeezing the field to nothing.
 *
 * Both controls are keyboard-reachable as they stand: the input is an input,
 * and antd's `Tag.CheckableTag` renders `role="checkbox"` with `tabIndex={0}`
 * and answers Space — so the chip is a real toggle to a screen reader, with
 * its state announced, rather than a coloured `<span>` a mouse can press.
 */
function InboxToolbar(props: {
  readonly search: string;
  readonly onSearch: (next: string) => void;
  readonly unreadOnly: boolean;
  readonly onUnreadOnly: (next: boolean) => void;
}): ReactElement {
  const t = useT();
  return (
    <Flex
      gap={spacing[2]}
      align="center"
      wrap="wrap"
      style={{ marginTop: spacing[3] }}
      data-testid="chat-list-toolbar"
    >
      <Input
        allowClear
        value={props.search}
        onChange={(event) => {
          props.onSearch(event.target.value);
        }}
        placeholder={t(CHAT_I18N_KEYS.listSearchPlaceholder)}
        // The label is the accessible NAME, not a placeholder: a placeholder
        // disappears the moment there is text in the field, which is exactly
        // when a reader arriving on it needs to be told what it is.
        aria-label={t(CHAT_I18N_KEYS.listSearchLabel)}
        data-testid="chat-list-search"
        style={{ flex: "1 1 12rem", minWidth: 0 }}
        data-analytics="none"
        data-analytics-reason="a local filter over already-loaded rows — no request, nothing to attribute; the host app wraps its own tracking"
      />
      <Tag.CheckableTag
        checked={props.unreadOnly}
        onChange={props.onUnreadOnly}
        data-testid="chat-list-unread-filter"
        style={{ cursor: "pointer", marginInlineEnd: 0 }}
      >
        {t(CHAT_I18N_KEYS.listUnreadOnly)}
      </Tag.CheckableTag>
    </Flex>
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
  const [search, setSearch] = useControlledValue(
    props.search,
    props.defaultSearch ?? "",
    props.onSearchChange
  );
  const [unreadOnly, setUnreadOnly] = useControlledValue(
    props.unreadOnly,
    props.defaultUnreadOnly ?? false,
    props.onUnreadOnlyChange
  );
  const needle = normalizeSearch(search, locale);
  const filtering = inboxFilterActive({ needle, unreadOnly });

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
              <Space orientation="vertical" style={{ width: "100%" }}>
                {/* Drawn in this arm only. A search box over a loading list
                    filters nothing, and over an EMPTY inbox it invites a
                    person to look for conversations they do not have. */}
                {props.filters === false ? null : (
                  <InboxToolbar
                    search={search}
                    onSearch={setSearch}
                    unreadOnly={unreadOnly}
                    onUnreadOnly={setUnreadOnly}
                  />
                )}
                {/* The scope, stated only while it is TRUE. With every
                    conversation loaded the filter really is over all of them,
                    and a standing caveat nobody can act on is the sentence
                    people learn to stop reading. */}
                {filtering && hasNextPage ? (
                  <Typography.Text
                    type="secondary"
                    data-testid="chat-list-filter-scope"
                  >
                    {t(CHAT_I18N_KEYS.listFilterScope)}
                  </Typography.Text>
                ) : null}
                <InboxRows
                  rows={rows}
                  viewerId={viewerId}
                  locale={locale}
                  openHref={openHref}
                  onOpen={onOpen}
                  subjectHref={props.subjectHref}
                  linkComponent={props.linkComponent}
                  selectedId={selectedId}
                  needle={needle}
                  unreadOnly={unreadOnly}
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
