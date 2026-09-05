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
export type { ConversationThreadPanelProps } from "./ConversationThreadPanel.js";
// The desktop two-pane arrangement over the two panels above. Mounting it is
// the HOST's viewport decision — a phone host keeps the two screens.
export { ConversationSplitPanel } from "./ConversationSplitPanel.js";
export type { ConversationSplitPanelProps } from "./ConversationSplitPanel.js";
export { StartChatButton } from "./StartChatButton.js";
export type { StartChatButtonProps, StartChatRefusal } from "./StartChatButton.js";
export { SignInLink } from "./SignInLink.js";
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
export {
  CounterpartyAvatar,
  PeopleScope,
  conversationPeopleIds,
  counterpartyIds,
  useCounterpartyLabel,
} from "./people.js";
export type { SignInLinkProps } from "./SignInLink.js";
// The skin's own theme root. Every surface above already wraps itself in it;
// it is exported so a host composing loose parts can wrap them once.
export { ChatSkinTheme } from "./theme.js";
export type { ChatSkinThemeProps } from "./theme.js";
