/**
 * `@stapel/chat-react/default` — the opt-in antd skin for this pair (mirrors
 * auth-react's `/default` split, §54): a separate entry point so consumers who
 * bring their own visuals never pull `antd` into their bundle; importing this
 * subpath is the opt-in.
 *
 * ```tsx
 * import {
 *   ConversationListPanel,
 *   ConversationThreadPanel,
 *   StartChatButton,
 * } from "@stapel/chat-react/default";
 * ```
 */
export {
  ConversationListPanel,
  ROW_OPEN_CLASS,
  conversationRowCss,
} from "./ConversationListPanel.js";
export type { ConversationListPanelProps } from "./ConversationListPanel.js";
export { ConversationThreadPanel } from "./ConversationThreadPanel.js";
export type {
  ConversationThreadPanelProps,
  ThreadHeaderActionsContext,
} from "./ConversationThreadPanel.js";
// The desktop two-pane arrangement over the two panels above. Mounting it is
// the HOST's viewport decision — a phone host keeps the two screens.
export { ConversationSplitPanel } from "./ConversationSplitPanel.js";
export type { ConversationSplitPanelProps } from "./ConversationSplitPanel.js";
export { StartChatButton } from "./StartChatButton.js";
export type { StartChatButtonProps, StartChatRefusal } from "./StartChatButton.js";
export { SignInLink } from "./SignInLink.js";
export { PooledSignInDoor, usePooledRefusal } from "./pooledSignInDoor.js";
export type { PooledRefusal } from "./pooledSignInDoor.js";
// The subject card and the overflow menu are exported so a host composing its
// own thread screen keeps the same two surfaces rather than re-deciding them.
export {
  SubjectCard,
  SubjectRowSummary,
  readSubjectCard,
  subjectRowLabel,
} from "./subjectCard.js";
export type { SubjectCardView } from "./subjectCard.js";
// The presence line and the transport tag are both exported, and the pair of
// them is the point: one says whether the OTHER person is there, the other
// says whether THIS client's connection is healthy. A host composing its own
// thread screen gets both, so it cannot rebuild the header that answered the
// first question with the second one's evidence.
export { ChatNotificationsPrompt } from "./ChatNotificationsPrompt.js";
export type { ChatNotificationsPromptProps } from "./ChatNotificationsPrompt.js";
export { PresenceLine } from "./PresenceLine.js";
export type { PresenceLineProps } from "./PresenceLine.js";
export { TransportTag } from "./TransportTag.js";
export { ThreadActionsMenu } from "./ThreadActionsMenu.js";
export type { ThreadActionsMenuProps } from "./ThreadActionsMenu.js";
// LEAVING A THREAD (stapel-chat 0.8.5). Exported as two pieces because they
// are two pieces: a `SkinDialog` destroys its children when it hides, so the
// confirmation cannot live inside the menu the trigger sits in — the menu
// closes, and the dialog is rendered beside it. A host composing its own
// inbox row or thread header wires the same two.
export {
  LeaveConversationDialog,
  LeaveConversationTrigger,
} from "./LeaveConversation.js";
export type { LeaveConversationDialogProps } from "./LeaveConversation.js";
export {
  CounterpartyAvatar,
  PeopleScope,
  conversationPeopleIds,
  counterpartyIds,
  counterpartyLabel,
  useCounterpartyLabel,
} from "./people.js";
// The inbox toolbar's rules moved to the MAIN entry (`model/inboxQuery.ts`)
// when stapel-chat 0.8.2 made the filter the server's: what used to be a
// predicate over loaded rows is now a query parameter, which is a headless
// concern and not a skin's. `inboxFilterActive` and `InboxRowText` are still
// re-exported here so a host composing its own thread list beside this skin
// keeps one import path; `matchesInboxFilter` and `previewSearchText` are
// gone, and deliberately not replaced — see `model/inboxQuery.ts` on why a
// second, client-side filter over a server-filtered page is a DOUBLE filter
// that hides rows the server correctly returned.
export { inboxFilterActive } from "../model/inboxQuery.js";
export type { ChatInboxFilter, InboxRowText } from "../model/inboxQuery.js";
export type { SignInLinkProps } from "./SignInLink.js";
// The skin's own theme root. Every surface above already wraps itself in it;
// it is exported so a host composing loose parts can wrap them once.
export { ChatSkinTheme } from "./theme.js";
export type { ChatSkinThemeProps } from "./theme.js";

// ── The call control (0.10.0) ───────────────────────────────────────────────
//
// chat owns the QUESTION — may these two people talk, about this thing, right
// now — and `@stapel/video-react` owns the act. The button below holds the
// gate and calls back; a host wires `onCall` to `useCalls().place(…)`, and
// neither package depends on the other. A thread header that imported the
// video pair to draw a button would put a WebRTC stack in the bundle of every
// host that shows a conversation and never calls anybody.
export { StartCallButton } from "./StartCallButton.js";
export type { StartCallButtonProps } from "./StartCallButton.js";
