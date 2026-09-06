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
 *         line the row itself carries (`last_message`, stapel-chat 0.8.3 —
 *         a projection annotated for the whole page, so the line is there on
 *         FIRST paint and not only for the threads this session has opened);
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
 * server's own `unread_count`. BOTH ARE THE SERVER'S OWN FILTERS since
 * stapel-chat 0.8.2 — they narrow the whole inbox, not the pages this client
 * happens to hold, they apply before the page is taken, and they live in the
 * query key (`model/inboxQuery.ts`, which also says why no client-side
 * predicate runs alongside them and why the "loaded so far" caveat is gone).
 *
 * The two empty states stay different sentences, and now they arrive by two
 * different routes: "no conversations" is an empty answer with no filter on,
 * "nothing found" is an empty answer with one — so the filtered-empty arm has
 * to keep the toolbar on screen, because it is the way back out.
 *
 * ── The threads you left (stapel-chat 0.8.6) ──────────────────────────────
 *
 * The pane has TWO TABS, «Conversations» and «Left», because the endpoint
 * has two lists: `?left=true` is the EXACT COMPLEMENT of the default one, so
 * a thread is on one of them and never on both. That is why it is a tab pair
 * and not a "show left conversations too" switch — a switch says the two can
 * be seen together, and the server cannot produce that answer.
 *
 * A left row is a different row and says so: it carries the date the person
 * walked out («Left <date>», from the row's own `left_at`) and the one
 * control that matters there — «Return to conversation» — instead of the overflow
 * menu whose single entry was the way out they have already taken. Both sit
 * BELOW the row control as its siblings, on the same rule the subject strip
 * moved out under (D420): the row is one control that opens the thread, and a
 * button inside it would be a control inside a control.
 *
 * The toolbar stays, and its search reaches the server the same way — with
 * one honest difference in the FIELD's placeholder, because a left thread's
 * last line is the departure marker and nothing finds an unlabelled marker.
 * See `CHAT_I18N_KEYS.listSearchPlaceholderLeft`.
 */
import { spacing } from "@stapel/tokens-antd";
import { ListRow, SkinDialog } from "@stapel/tokens-antd/skin";
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
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  STAPEL_UI_KEYS,
  isLoadReady,
  matchList,
  useErrorDisplay,
  useI18n,
  useT,
} from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import type { Conversation, Subject } from "../api/types.js";
import { ConversationList } from "../headless/ConversationList.js";
import { inboxPreviewLine } from "../model/previews.js";
import { inboxFilterActive } from "../model/inboxQuery.js";
import type { ChatInboxView } from "../model/inboxQuery.js";
import { conversationLeftAt } from "../model/membership.js";
import type { ChatPeopleDirectory } from "../model/slots.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { RejoinConversationButton } from "./RejoinConversation.js";
import { TransportTag } from "./TransportTag.js";
import { ChatSkinTheme } from "./theme.js";
import {
  CounterpartyAvatar,
  PeopleScope,
  conversationPeopleIds,
  useCounterpartyLabel,
} from "./people.js";
import { SubjectRowSummary, readSubjectCard } from "./subjectCard.js";
import { OverflowGlyph } from "./ThreadActionsMenu.js";
import {
  LeaveConversationDialog,
  LeaveConversationTrigger,
} from "./LeaveConversation.js";

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
  /**
   * A row was LEFT from its own menu (stapel-chat 0.8.5) and the `204` has
   * landed — the row is already out of every cached narrowing of this list.
   *
   * The inbox itself needs nothing: the row is gone on the next paint. This
   * is for a host that is showing that thread SOMEWHERE ELSE on the same
   * screen — the desktop split's right pane, which is why
   * `<ConversationSplitPanel/>` wires it.
   */
  onLeft?: (conversationId: string) => void;
  /**
   * A row was RETURNED to from the «Left» tab (stapel-chat 0.8.6) and
   * the `204` has landed — the row is already out of the left list's cache and
   * the inbox has been asked to re-read.
   *
   * The mirror of {@link onLeft}, and it exists for the same host: one showing
   * that thread somewhere else on the same screen.
   */
  onRejoined?: (conversationId: string) => void;

  // ── The two lists (stapel-chat 0.8.6) ─────────────────────────────────────
  //
  // CONTROLLED-OR-NOT, the same shape as the toolbar below: a storefront that
  // passes nothing gets working tabs, and a host that wants the tab in its URL
  // passes `view` + `onViewChange` and owns it.

  /** Which list is showing, CONTROLLED. Pair with {@link onViewChange}. */
  view?: ChatInboxView;
  /** Which list a self-managing pane starts on. Default `"inbox"`. */
  defaultView?: ChatInboxView;
  /** Fired when a tab is pressed, in both modes. */
  onViewChange?: (view: ChatInboxView) => void;
  /**
   * Draw the tab pair. Default: yes.
   *
   * `false` hides the CONTROLS, not the list — a host driving `view` from
   * chrome of its own still gets whichever list it asked for. It is also the
   * switch for a deployment that does not want to offer the left list at all;
   * with it off and `view` unset, this pane is exactly the inbox it was.
   */
  leftView?: boolean;

  // ── The toolbar (search + unread) ─────────────────────────────────────────
  //
  // Both controls are CONTROLLED-OR-NOT, the platform's own `value` /
  // `defaultValue` shape: a storefront that passes nothing gets a working
  // toolbar with no wiring at all, and a host that wants the query in its URL
  // passes `search` + `onSearchChange` and owns it. That is the whole reason
  // this is a pair of props rather than one — a screen whose filter survives
  // a reload cannot be built on internal state, and a screen that just wants
  // a search box should not have to build one.
  //
  // Both values travel to the SERVER (stapel-chat 0.8.2 `?search=`/`?unread=`),
  // so what a host owns here is a query parameter, not a local predicate.

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
   * How long a keystroke waits before it becomes a request, in ms. Default
   * 300 (`INBOX_SEARCH_DEBOUNCE_MS`). `0` sends every keystroke — for a host
   * that already debounced the value it owns.
   *
   * It does not delay what the FIELD shows: the box is controlled by `search`
   * and repaints on every keystroke either way. What waits is the query.
   */
  searchDebounceMs?: number;
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
 * A ROW'S OWN MENU — one entry, and it is the way out (stapel-chat 0.8.5).
 *
 * ── Why it is not inside the row control ──────────────────────────────────
 *
 * The whole row is one control that opens the thread (D65), and this is a
 * second control with a different act. A button inside an anchor (or inside a
 * `role="button"`) is a control inside a control — the same nesting D420
 * moved the subject strip out of — so the menu is a SIBLING of the row
 * control, in a flex line beside it, and the row shrinks by its width.
 *
 * ── Why leaving is offered from here at all ───────────────────────────────
 *
 * The inbox is where a person decides a thread is finished with. Making them
 * open the conversation to get rid of it is the same shape as having to open
 * a message to delete it: the decision is taken in the list, and the control
 * has to be where the decision is.
 */
function ConversationRowMenu(props: {
  readonly conversationId: string;
  readonly onLeft: ((conversationId: string) => void) | undefined;
}): ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  return (
    <>
      <Button
        type="text"
        size="small"
        icon={<OverflowGlyph />}
        // An icon-only control carries its name, and it is the one the sheet
        // it opens is titled with.
        aria-label={t(CHAT_I18N_KEYS.threadMenu)}
        onClick={() => setOpen(true)}
        data-testid="chat-row-menu-open"
        style={{ flex: "0 0 auto" }}
        data-analytics="none"
        data-analytics-reason="opens a row menu; the host app wraps its own controls with tracked()"
      />
      <SkinDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(CHAT_I18N_KEYS.threadMenu)}
        dismissLabel={t(STAPEL_UI_KEYS.dismiss)}
        data-testid="chat-row-menu"
      >
        <LeaveConversationTrigger
          onPress={() => {
            // The sheet steps out of the way first, and the confirmation is
            // its SIBLING rather than its child — a `SkinDialog` destroys its
            // children when it hides, so a confirmation nested in here would
            // be unmounted by the press that opened it.
            setOpen(false);
            setLeaving(true);
          }}
        />
      </SkinDialog>
      <LeaveConversationDialog
        conversationId={props.conversationId}
        open={leaving}
        onClose={() => setLeaving(false)}
        {...(props.onLeft !== undefined ? { onLeft: props.onLeft } : {})}
      />
    </>
  );
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
  readonly locale: string;
  readonly openHref: ((conversationId: string) => string) | undefined;
  readonly onOpen: ((conversationId: string) => void) | undefined;
  readonly subjectHref: ((subject: Subject) => string | undefined) | undefined;
  readonly linkComponent: LinkComponent | undefined;
  readonly onLeft: ((conversationId: string) => void) | undefined;
  readonly onRejoined: ((conversationId: string) => void) | undefined;
  readonly view: ChatInboxView;
}): ReactElement {
  const t = useT();
  const { row, viewerId, directory, openHref, onOpen } = props;
  const isLeftRow = props.view === "left";
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

  // THE LINE THE ROW DRAWS COMES WITH THE ROW (stapel-chat 0.8.3). It used to
  // be read out of the thread windows this session happened to hold, which
  // meant a first visit showed no previews at all — the rows a person has
  // never opened are precisely the ones they are scanning for.
  //
  // ONE LINE, TRUNCATED. The server already flattens and caps it at 140
  // characters; the ellipsis here is for the width of THIS pane, which the
  // server cannot know, and for the one long unbroken word a cap does not
  // help with.
  const previewText = inboxPreviewLine(props.row.last_message, viewerId, t);

  const meta =
    previewText === "" ? undefined : (
      <span
        style={{
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        data-testid="chat-row-preview"
      >
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

  // WHAT A LEFT ROW SAYS AND OFFERS (stapel-chat 0.8.6), on its own line
  // beneath the row control for the same reason the subject strip is there:
  // the row IS a control that opens the thread, and a button inside it would
  // be a control inside a control (D420).
  //
  // The date comes off the row's OWN top-level `left_at` — the requesting
  // user's departure, which is what this list is ordered by — and not from
  // hunting the participants array for the viewer's id, which would need this
  // pane to have been told who is reading and would silently draw nothing
  // where it has not. Absent (a 0.8.5 body, which has no such field) the
  // sentence is not drawn: a row says what it carries.
  const leftAt = isLeftRow ? conversationLeftAt(row) : null;
  const departure = isLeftRow ? (
    <Flex
      align="center"
      justify="space-between"
      wrap="wrap"
      gap={spacing[2]}
      style={{ paddingInlineStart: SUBJECT_INDENT, minWidth: 0 }}
      data-chat-row-departure=""
    >
      {leftAt === null ? (
        <span />
      ) : (
        <Typography.Text type="secondary" data-testid="chat-row-left-at">
          {t(CHAT_I18N_KEYS.leftAt, { date: relativeTime(props.locale, leftAt) })}
        </Typography.Text>
      )}
      <RejoinConversationButton
        conversationId={row.id}
        {...(props.onRejoined !== undefined ? { onRejoined: props.onRejoined } : {})}
      />
    </Flex>
  ) : null;

  return (
    <div
      data-testid="chat-conversation-row"
      data-chat-conversation-id={row.id}
      // The row control and the row's menu are SIBLINGS on one line — neither
      // may contain the other (see `ConversationRowMenu`). `align: start` so
      // the menu sits on the identity line and does not centre itself against
      // a two-line row with a subject strip under it.
      style={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: spacing[1] }}
    >
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        {openRow(inside, row.id, openHref, onOpen)}
        {strip}
        {departure}
      </div>
      {/* The overflow menu holds exactly one entry and it is the way out. On
          a thread this person has already left there is nothing for it to
          offer, so it is absent rather than present-and-empty. */}
      {isLeftRow ? null : (
        <ConversationRowMenu conversationId={row.id} onLeft={props.onLeft} />
      )}
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
 * The rows, once the names for the whole page have been asked for once.
 *
 * NOTHING IS FILTERED HERE ANY MORE. The rows arrive already narrowed
 * (stapel-chat 0.8.2 filters before the page is taken), and re-applying the
 * toolbar locally would be a second, WORSE filter over the same answer: the
 * counterpart's name lives behind the host's people seam and may still be
 * pending, the subject title is matched at fields only that subject type
 * knows, and both absences read as "no match" to a predicate. A row the
 * server correctly returned would blink out of the list — see
 * `model/inboxQuery.ts`. So this component draws what it is given.
 *
 * The ids handed to the people seam are the whole page's, in one batch.
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
  readonly onLeft: ((conversationId: string) => void) | undefined;
  readonly onRejoined: ((conversationId: string) => void) | undefined;
  readonly view: ChatInboxView;
}): ReactElement {
  const { rows, viewerId, selectedId } = props;
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
                locale={props.locale}
                openHref={props.openHref}
                onOpen={props.onOpen}
                subjectHref={props.subjectHref}
                linkComponent={props.linkComponent}
                onLeft={props.onLeft}
                onRejoined={props.onRejoined}
                view={props.view}
              />
            </List.Item>
          )}
        />
      )}
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
  readonly view: ChatInboxView;
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
        // THE PLACEHOLDER IS THE ONE THING THAT DIFFERS BETWEEN THE TABS, and
        // it is not decoration: the server's search rule is identical on both
        // lists, but a left thread's last line is the departure marker, an
        // unlabelled marker draws nothing and is found by nothing — so the
        // inbox's "or message" is a promise this list cannot keep, and
        // keeping it would send a person hunting for a word they can
        // genuinely remember reading.
        placeholder={t(
          props.view === "left"
            ? CHAT_I18N_KEYS.listSearchPlaceholderLeft
            : CHAT_I18N_KEYS.listSearchPlaceholder
        )}
        // The label is the accessible NAME, not a placeholder: a placeholder
        // disappears the moment there is text in the field, which is exactly
        // when a reader arriving on it needs to be told what it is.
        aria-label={t(CHAT_I18N_KEYS.listSearchLabel)}
        data-testid="chat-list-search"
        style={{ flex: "1 1 12rem", minWidth: 0 }}
        data-analytics="none"
        data-analytics-reason="a search field whose value travels to the server as ?search= — the request is the list read the host app already wraps with its own tracked()"
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

/**
 * WHICH OF THE TWO LISTS (stapel-chat 0.8.6).
 *
 * A `Segmented`, not two chips and not a switch. The lists are exact
 * complements — a thread is on one of them and never on both — which is a
 * single-choice question, and `Segmented` is what antd renders as a radio
 * group: exclusive by construction, with the choice announced. Two
 * `CheckableTag`s would be checkboxes, and a checkbox pair says a person may
 * tick both and see the union, which is an answer the endpoint has no way to
 * give.
 */
function ListViewTabs(props: {
  readonly view: ChatInboxView;
  readonly onView: (next: ChatInboxView) => void;
}): ReactElement {
  const t = useT();
  return (
    <Segmented<ChatInboxView>
      value={props.view}
      onChange={props.onView}
      options={[
        { label: t(CHAT_I18N_KEYS.listTabInbox), value: "inbox" },
        { label: t(CHAT_I18N_KEYS.listTabLeft), value: "left" },
      ]}
      style={{ marginTop: spacing[3] }}
      data-testid="chat-list-view-tabs"
    />
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
  const [view, setView] = useControlledValue<ChatInboxView>(
    props.view,
    props.defaultView ?? "inbox",
    props.onViewChange
  );
  const isLeftView = view === "left";
  // What the QUERY is narrowed by. The panel hands the raw value down and the
  // query layer settles it (trim, debounce, key) — one place, so a host
  // calling `useConversations` directly gets the same pause and the same
  // "blank is no search" rule this toolbar does.
  const filtering = inboxFilterActive({ search, unreadOnly });

  return (
    <ConversationList
      {...(props.limit !== undefined ? { limit: props.limit } : {})}
      {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
      search={search}
      unreadOnly={unreadOnly}
      view={view}
      {...(props.searchDebounceMs !== undefined
        ? { searchDebounceMs: props.searchDebounceMs }
        : {})}
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
      }) => {
        // Drawn whenever there is something to narrow OR something already
        // narrowed. `filtering` alone is not enough (the first paint of a
        // host-controlled search has no rows yet) and "has rows" alone is not
        // either (a filter that found nothing must keep its own way out).
        const showToolbar =
          props.filters !== false &&
          (filtering || (isLoadReady(state) && state.data.length > 0));
        return (
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

          {/* THE TABS ARE DRAWN IN EVERY ARM, including the empty ones and
              the failure. They are not chrome over the rows — they are how a
              person gets back to the other list, and an «Left» tab
              with nothing on it that could not be left again would be a
              corner of the product with no exit. */}
          {props.leftView === false ? null : (
            <ListViewTabs view={view} onView={setView} />
          )}

          {/* THE TOOLBAR SITS OUTSIDE THE STATE MACHINE, on purpose.
              A typed search is a NEW query — its own key, its own first page
              — so the list goes back through `loading` and comes out `empty`
              as often as `ready`. A toolbar drawn inside those arms would be
              unmounted and rebuilt by the very keystroke that moved the
              state: the field would lose focus mid-word and the caret would
              jump. Here it is one element in one place, and only its props
              change.

              It is still not drawn over an inbox that is EMPTY AND UNFILTERED
              — a search box there invites a person to look for conversations
              they do not have — and not over a failure, which has one arm and
              one thing to say. */}
          {showToolbar ? (
            <InboxToolbar
              search={search}
              onSearch={setSearch}
              unreadOnly={unreadOnly}
              onUnreadOnly={setUnreadOnly}
              view={view}
            />
          ) : null}

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
            // TWO EMPTY ANSWERS, TWO SENTENCES. Both now arrive the same way
            // — an empty page from the server — so the only thing that tells
            // them apart is whether a filter was on. Telling a person with
            // three hundred threads that they have none is the failure this
            // branch exists to prevent.
            empty: () =>
              filtering ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ marginTop: spacing[4] }}
                  data-testid="chat-conversation-list-no-matches"
                  description={t(CHAT_I18N_KEYS.listNoMatches)}
                />
              ) : (
                // THREE empty answers now, and the third is not the first
                // one's wording. "No conversations yet" over the left tab
                // would tell a person with three hundred threads that they
                // have none — the same lie the filtered arm above exists to
                // prevent, arriving by a different route.
                <Empty
                  style={{ marginTop: spacing[4] }}
                  data-testid={
                    isLeftView
                      ? "chat-conversation-list-none-left"
                      : "chat-conversation-list-empty"
                  }
                  description={t(
                    isLeftView ? CHAT_I18N_KEYS.leftEmpty : CHAT_I18N_KEYS.listEmpty
                  )}
                />
              ),
            ready: (rows) => (
              <Space orientation="vertical" style={{ width: "100%" }}>
                <InboxRows
                  rows={rows}
                  viewerId={viewerId}
                  locale={locale}
                  openHref={openHref}
                  onOpen={onOpen}
                  subjectHref={props.subjectHref}
                  linkComponent={props.linkComponent}
                  selectedId={selectedId}
                  onLeft={props.onLeft}
                  onRejoined={props.onRejoined}
                  view={view}
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
        );
      }}
    </ConversationList>
  );
}
