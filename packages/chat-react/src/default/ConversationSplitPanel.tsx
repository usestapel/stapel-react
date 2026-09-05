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
import type { ReactElement, ReactNode } from "react";
import { Empty, theme as antdTheme } from "antd";
import { useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import type { Subject } from "../api/types.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { ConversationListPanel } from "./ConversationListPanel.js";
import { ConversationThreadPanel } from "./ConversationThreadPanel.js";
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
  /** Thread page size — forwarded to `<ConversationThreadPanel/>`. */
  limit?: number;
  /** Composer cap — forwarded to `<ConversationThreadPanel/>`. */
  maxLength?: number;
  /** Browser-notification offer — forwarded to `<ConversationThreadPanel/>`. */
  notifications?: boolean;
  /**
   * The right pane while nothing is selected. Default: a quiet empty state
   * saying to pick a conversation — an invitation, not a failure.
   */
  empty?: ReactNode;
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

/** Split out so `useToken`/`useT` are read under the skin's own theme root. */
function SplitBody(props: ConversationSplitPanelProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const selectedId = props.selectedId ?? null;
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
        {selectedId !== null ? (
          <ConversationThreadPanel
            // Keyed by conversation: a half-typed draft must not follow the
            // reader from one counterparty's thread into another's.
            key={selectedId}
            conversationId={selectedId}
            viewerId={threadViewerId}
            {...(props.limit !== undefined ? { limit: props.limit } : {})}
            {...(props.maxLength !== undefined ? { maxLength: props.maxLength } : {})}
            {...(props.notifications !== undefined
              ? { notifications: props.notifications }
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
