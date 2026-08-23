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
export { ConversationListPanel } from "./ConversationListPanel.js";
export type { ConversationListPanelProps } from "./ConversationListPanel.js";
export { ConversationThreadPanel } from "./ConversationThreadPanel.js";
export type { ConversationThreadPanelProps } from "./ConversationThreadPanel.js";
export { StartChatButton } from "./StartChatButton.js";
export type { StartChatButtonProps } from "./StartChatButton.js";
export { SignInLink } from "./SignInLink.js";
export type { SignInLinkProps } from "./SignInLink.js";
