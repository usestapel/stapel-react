/**
 * `<ConversationSplitPanel/>` — the desktop two-pane inbox: the conversation
 * list on the left, the open thread on the right, one screen.
 *
 * ── The defect this arrangement exists for ─────────────────────────────────
 *
 * Measured on a wide desktop viewport (1440×900) of a live classified
 * deployment: the thread page was ONE full-width lane. The composer stretched
 * to 1230px, a reader's own messages sat one and a half metres of screen away
 * from the avatar that named them, and the dialog list lived on a separate
 * screen entirely — so answering three buyers meant three round trips through
 * navigation. The reference design for a desktop inbox is two panes, and the
 * pair had no two-pane arm to mount. This is that arm, composed entirely from
 * the two panels that already exist: this file makes layout decisions and
 * nothing else.
 *
 * ── Whose decision it is to mount this ─────────────────────────────────────
 *
 * The HOST's — the same rule `CategoryPage`'s sub-category arms argue: the
 * host STATES which arrangement a viewport gets, rather than one component
 * rendering both and covering one with CSS. A phone host keeps the two
 * screens (list, then thread, with the app bar's back arrow between them) and
 * never mounts this at all; a desktop host mounts this instead of the two
 * screens. Nothing here measures the window.
 *
 * ```tsx
 * <ConversationSplitPanel
 *   viewerId={me.id}
 *   selectedId={params.conversationId ?? null}
 *   openHref={(id) => `/account/chat/${id}`}
 * />
 * ```
 */
import { spacing } from "@stapel/tokens-antd";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Empty, theme as antdTheme } from "antd";
import { useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import type { ChatMessage, Subject } from "../api/types.js";
import type { ChatInboxView } from "../model/inboxQuery.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ConversationListPanel } from "./ConversationListPanel.js";
import type { ConversationListPanelProps } from "./ConversationListPanel.js";
import { ConversationThreadPanel } from "./ConversationThreadPanel.js";
import type { ThreadHeaderActionsContext } from "./ConversationThreadPanel.js";
import { ChatSkinTheme } from "./theme.js";

export interface ConversationSplitPanelProps {
  /** See {@link ConversationListPanelProps.viewerId} — forwarded to both panes. */
  viewerId?: string | number | null;
  /**
   * The open conversation. Set, it mounts the thread on the right and marks
   * the matching list row; unset, the right pane holds {@link empty}. The
   * host owns it (typically from the route), so back/forward and a shared
   * URL land on the same open thread.
   */
  selectedId?: string | null;
  /** Where a row leads, as an href — forwarded to the list. */
  openHref?: (conversationId: string) => string;
  /** Where a row leads, in a SPA — forwarded to the list. */
  onOpen?: (conversationId: string) => void;
  /** Where a row's SUBJECT leads — forwarded to the list. */
  subjectHref?: (subject: Subject) => string | undefined;
  /** The router's link for the subject title — forwarded to the list. */
  linkComponent?: LinkComponent;
  /**
   * The list pane's toolbar — search text, the unread chip and whether the
   * controls are drawn at all. Forwarded verbatim to
   * `<ConversationListPanel/>`, which documents each one.
   *
   * They are here for the reason `renderHeaderActions` is: this arrangement
   * mounts the list panel ITSELF, so a host composing the two panes by hand
   * could keep its filter in the URL and a host taking this arrangement could
   * not — the same deployment filtering on the phone and losing the filter on
   * a reload of the desktop split. A host that passes none of them gets the
   * self-managing toolbar, which is what the storefront gets today.
   */
  search?: string;
  defaultSearch?: string;
  onSearchChange?: (search: string) => void;
  unreadOnly?: boolean;
  defaultUnreadOnly?: boolean;
  onUnreadOnlyChange?: (unreadOnly: boolean) => void;
  filters?: boolean;
  /** Thread page size — forwarded to `<ConversationThreadPanel/>`. */
  limit?: number;
  /** Composer cap — forwarded to `<ConversationThreadPanel/>`. */
  maxLength?: number;
  /** Browser-notification offer — forwarded to `<ConversationThreadPanel/>`. */
  notifications?: boolean;
  /**
   * Extra controls in the thread header — forwarded verbatim to
   * `<ConversationThreadPanel renderHeaderActions>`, which is where
   * `<StartCallButton>` goes.
   *
   * It is here because the desktop arrangement mounts the thread panel
   * ITSELF: a host that composed the two panes by hand could pass the slot
   * and a host that took this arrangement could not, so the same deployment
   * grew a call button on the phone's thread screen and had none in the
   * desktop split — the arrangement silently deciding a product question it
   * makes no decisions about (this file lays out; it does not choose which
   * verbs a thread has). The slot is told the same context on both surfaces.
   */
  renderHeaderActions?: (context: ThreadHeaderActionsContext) => ReactNode;
  /**
   * Draw a system line's sentence — forwarded to
   * `<ConversationThreadPanel renderSystemMessage>`, where the reasoning is.
   * Here for the same reason the slot above is: this arrangement mounts the
   * thread panel itself, so a desktop host could not otherwise reach it.
   */
  renderSystemMessage?: (message: ChatMessage) => ReactNode;
  /**
   * The reader LEFT the open conversation (stapel-chat 0.8.5).
   *
   * This arrangement needs no wiring to close the pane — it owns which thread
   * the right side shows and stops showing that one on its own. The callback
   * is for the host's ROUTE: `selectedId` typically comes from the URL, and a
   * URL still naming a thread that is off this person's list is a page that
   * reopens it on the next reload.
   */
  onLeft?: (conversationId: string) => void;
  /**
   * The right pane while nothing is selected. Default: a quiet empty state
   * saying to pick a conversation — an invitation, not a failure.
   */
  empty?: ReactNode;

  // ── The two lists (stapel-chat 0.8.6), forwarded to the left pane ─────────
  //
  // Forwarded for the same reason the toolbar is: this arrangement mounts the
  // list panel itself, so a desktop host that wanted the tab in its URL — or
  // did not want the tab at all — could not otherwise reach it, and the same
  // deployment would answer that product question differently on the phone
  // and on the desk. See `ConversationListPanelProps`.

  /** Which list the left pane shows, CONTROLLED. Pair with {@link onViewChange}. */
  view?: ChatInboxView;
  /** Which list a self-managing left pane starts on. Default `"inbox"`. */
  defaultView?: ChatInboxView;
  /** Fired when a tab is pressed, in both modes. */
  onViewChange?: (view: ChatInboxView) => void;
  /** Draw the tab pair in the left pane. Default: yes. */
  leftView?: boolean;
  /** A thread was returned to from the «Left» tab (0.8.6). */
  onRejoined?: (conversationId: string) => void;
}

/**
 * The reading measure of the thread pane. A chat line is prose, and prose
 * stops being readable past ~48rem — but the cap is really about the OWN
 * message: bubbles align right, avatars sit left, and in an uncapped wide
 * pane a reader's own line lands a screen away from the face that sent the
 * reply. Capped here, in the split arrangement that created the width, not
 * in `<ConversationThreadPanel/>`, whose behaviour belongs to every host
 * that mounts it alone.
 */
const THREAD_MEASURE = "48rem";

export function ConversationSplitPanel(
  props: ConversationSplitPanelProps = {}
): ReactElement {
  // The theme wraps the whole arrangement once so the divider colour below is
  // read on the right side of the mode; the panels nest their own wrapper for
  // free (`ChatSkinTheme` reuses an outer provider on the same mode).
  return (
    <ChatSkinTheme>
      <SplitBody {...props} />
    </ChatSkinTheme>
  );
}

/**
 * The toolbar half of the props, forwarded only where the host really set it.
 *
 * One pass rather than seven inline spreads at the call site, and `undefined`
 * is DROPPED rather than passed on: under `exactOptionalPropertyTypes` an
 * explicit `search={undefined}` is a different thing from an absent `search`,
 * and passing it would put the list panel into controlled mode with no value.
 */
function toolbarProps(
  props: ConversationSplitPanelProps
): Partial<ConversationListPanelProps> {
  return {
    ...(props.search !== undefined ? { search: props.search } : {}),
    ...(props.defaultSearch !== undefined
      ? { defaultSearch: props.defaultSearch }
      : {}),
    ...(props.onSearchChange !== undefined
      ? { onSearchChange: props.onSearchChange }
      : {}),
    ...(props.unreadOnly !== undefined ? { unreadOnly: props.unreadOnly } : {}),
    ...(props.defaultUnreadOnly !== undefined
      ? { defaultUnreadOnly: props.defaultUnreadOnly }
      : {}),
    ...(props.onUnreadOnlyChange !== undefined
      ? { onUnreadOnlyChange: props.onUnreadOnlyChange }
      : {}),
    ...(props.filters !== undefined ? { filters: props.filters } : {}),
    ...(props.view !== undefined ? { view: props.view } : {}),
    ...(props.defaultView !== undefined ? { defaultView: props.defaultView } : {}),
    ...(props.onViewChange !== undefined
      ? { onViewChange: props.onViewChange }
      : {}),
    ...(props.leftView !== undefined ? { leftView: props.leftView } : {}),
    ...(props.onRejoined !== undefined ? { onRejoined: props.onRejoined } : {}),
  };
}

/** Split out so `useToken`/`useT` are read under the skin's own theme root. */
function SplitBody(props: ConversationSplitPanelProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const selectedId = props.selectedId ?? null;
  // THE PANE CLOSES ITSELF ON A LEAVE.
  //
  // `selectedId` is the HOST's (it is usually the route), so this arrangement
  // cannot clear it — and a right pane still showing a thread that just left
  // the list beside it is the two halves of one screen disagreeing. So the
  // one id that was left is remembered until the selection moves, which is
  // exactly as long as the disagreement can last. Reset during render on a
  // new selection: opening another thread is a new question, and a thread
  // that came back and was picked again is open.
  const [leftId, setLeftId] = useState<string | null>(null);
  const [lastSelection, setLastSelection] = useState<string | null>(selectedId);
  if (lastSelection !== selectedId) {
    setLastSelection(selectedId);
    setLeftId(null);
  }
  const openId = selectedId !== null && selectedId === leftId ? null : selectedId;
  const threadViewerId =
    props.viewerId === null || props.viewerId === undefined
      ? null
      : String(props.viewerId);
  return (
    <div
      data-testid="chat-split"
      style={{
        display: "grid",
        // The list is a fixed rail, the thread takes the rest — and the
        // `minmax(0, 1fr)` is load-bearing: a bare `1fr` is `minmax(auto,
        // 1fr)`, so one long unbroken preview would widen the whole grid.
        gridTemplateColumns: "360px minmax(0, 1fr)",
        columnGap: spacing[4],
        // Top-aligned, both: a short list beside a long thread (or the other
        // way round) must not stretch its neighbour's card to match.
        alignItems: "start",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <ConversationListPanel
          selectedId={selectedId}
          {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
          {...(props.openHref !== undefined ? { openHref: props.openHref } : {})}
          {...(props.onOpen !== undefined ? { onOpen: props.onOpen } : {})}
          {...(props.subjectHref !== undefined
            ? { subjectHref: props.subjectHref }
            : {})}
          {...(props.linkComponent !== undefined
            ? { linkComponent: props.linkComponent }
            : {})}
          // A row left from the LIST's own menu closes the pane beside it too:
          // the two halves of one screen must not disagree about a thread.
          onLeft={(conversationId) => {
            setLeftId(conversationId);
            props.onLeft?.(conversationId);
          }}
          {...toolbarProps(props)}
        />
      </div>
      <div
        data-testid="chat-split-thread-pane"
        style={{
          minWidth: 0,
          maxWidth: THREAD_MEASURE,
          borderInlineStart: `1px solid ${token.colorSplit}`,
          paddingInlineStart: spacing[4],
        }}
      >
        {openId !== null ? (
          <ConversationThreadPanel
            // Keyed by conversation: a half-typed draft must not follow the
            // reader from one counterparty's thread into another's.
            key={openId}
            conversationId={openId}
            viewerId={threadViewerId}
            onLeft={(conversationId) => {
              setLeftId(conversationId);
              props.onLeft?.(conversationId);
            }}
            {...(props.limit !== undefined ? { limit: props.limit } : {})}
            {...(props.maxLength !== undefined ? { maxLength: props.maxLength } : {})}
            {...(props.notifications !== undefined
              ? { notifications: props.notifications }
              : {})}
            {...(props.renderHeaderActions !== undefined
              ? { renderHeaderActions: props.renderHeaderActions }
              : {})}
            {...(props.renderSystemMessage !== undefined
              ? { renderSystemMessage: props.renderSystemMessage }
              : {})}
          />
        ) : (
          (props.empty ?? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              data-testid="chat-split-empty"
              description={t(CHAT_I18N_KEYS.splitEmpty)}
              style={{ marginTop: spacing[6] }}
            />
          ))
        )}
      </div>
    </div>
  );
}
