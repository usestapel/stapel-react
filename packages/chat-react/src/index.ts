/**
 * `@stapel/chat-react` — the headless React pair for stapel-chat
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * WHAT IS DIFFERENT ABOUT THIS PAIR. Its backend has two ways to deliver the
 * same journal: the REST history, and its own resumable WebSocket protocol
 * (`ws/chat/<conversation_id>` — hello{last_seq} → welcome → replay →
 * replay_done → live). Both are wired here, behind ONE seam
 * (`useChatFreshness`), and no component above that seam can tell which is
 * running. Writes go over REST in either case. See `flows/freshness.ts` for
 * the seam and the criterion under which `@stapel/realtime` replaces its
 * insides.
 *
 * Layers: api → model → realtime → flows → headless → i18n. Generated
 * surfaces (error map, manifest, llms.txt) are produced by the monorepo
 * `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createChatApi } from "./api/chatApi.js";
export type { ChatApi } from "./api/chatApi.js";
export type {
  Schemas,
  AnchorDirection,
  ChatMessage,
  Conversation,
  ConversationKind,
  ConversationListParams,
  ConversationPage,
  CreateConversationRequest,
  MarkReadRequest,
  MessageHistoryParams,
  MessageKind,
  MessagePage,
  Participant,
  ParticipantRole,
  SendMessageRequest,
  SupportStatus,
} from "./api/types.js";

// ── realtime (the module's own socket protocol, typed) ───────────────────────
// Exported because a host may want to render the connection state or inject a
// transport; NOTHING above `flows/freshness.ts` inside this package uses it,
// which is what keeps the substrate migration to one file.
export {
  CHAT_WS_CLOSE_NOT_PARTICIPANT,
  CHAT_WS_CLOSE_UNAUTHENTICATED,
  CHAT_WS_REPLAY_LIMIT,
  CHAT_WS_RESYNC,
  decodeServerFrame,
  parseServerFrame,
} from "./realtime/frames.js";
export type {
  ChatAckFrame,
  ChatClientFrame,
  ChatErrorFrame,
  ChatHelloFrame,
  ChatMessageFrame,
  ChatPingFrame,
  ChatPongFrame,
  ChatReplayDoneFrame,
  ChatSendFrame,
  ChatServerFrame,
  ChatWelcomeFrame,
} from "./realtime/frames.js";
export {
  browserWebSocketFactory,
  canOpenWebSocket,
  createChatSocket,
} from "./realtime/chatSocket.js";
export type {
  ChatConnectionState,
  ChatReconnectOptions,
  ChatSocket,
  ChatSocketConnection,
  ChatSocketHandlers,
  ChatSocketOptions,
  ChatSocketRefusal,
  ChatSocketStatus,
  ChatWebSocketFactory,
} from "./realtime/chatSocket.js";
export {
  chatConversationStream,
  chatInboxStream,
  chatSocketUrl,
  chatStreamId,
  deriveChatSocketBase,
} from "./realtime/streams.js";
export type {
  ChatConversationStream,
  ChatInboxStream,
  ChatStreamKey,
} from "./realtime/streams.js";

// ── flows (the transport seam + the error fold) ──────────────────────────────
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { CHAT_FLOWS, flowEndpoints } from "./flows/registry.js";
export type { ChatFlowId, ChatFlowSpec, FlowEndpoint } from "./flows/registry.js";
export {
  CONVERSATION_LIST_INTERVAL_MS,
  THREAD_INTERVAL_MS,
  useChatFreshness,
} from "./flows/freshness.js";
export type {
  ChatFreshness,
  ChatFreshnessOptions,
  ChatSignal,
  ChatSignalKeyMap,
  ChatTransport,
} from "./flows/freshness.js";

// ── model (runtime wiring, query keys, context, the thread store) ────────────
export { createChatRuntime } from "./model/runtime.js";
export type {
  ChatRealtimeConfig,
  ChatRealtimeOptions,
  ChatRuntime,
  CreateChatRuntimeOptions,
} from "./model/runtime.js";
export {
  ChatRuntimeContext,
  useChatRuntime,
  useChatApi,
  useChatAnalytics,
} from "./model/context.js";
export { chatQueryKeys } from "./model/queryKeys.js";
export { THREAD_PAGE, useConversation, useConversations, useThread } from "./model/queries.js";
export {
  useLoadOlderMessages,
  useMarkRead,
  useSendMessage,
  useStartDirectChat,
} from "./model/mutations.js";
export type {
  SendMessageVariables,
  StartDirectChatVariables,
} from "./model/mutations.js";
export { CHAT_DEFAULT_MAX_BODY_LENGTH } from "./model/limits.js";
export { nextReadMarker } from "./model/readMarker.js";
export {
  EMPTY_THREAD_WINDOW,
  mergeMessage,
  mergeNewerPage,
  mergeOlderPage,
  threadFirstSeq,
  threadLastSeq,
  threadWindowFromPage,
} from "./model/threadWindow.js";
export type { ChatThreadWindow, ThreadMergeResult } from "./model/threadWindow.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { ChatProvider } from "./headless/ChatProvider.js";
export { ConversationList } from "./headless/ConversationList.js";
export type { ConversationListBag } from "./headless/ConversationList.js";
export { ConversationThread } from "./headless/ConversationThread.js";
export type { ConversationThreadBag } from "./headless/ConversationThread.js";
export { MessageComposer } from "./headless/MessageComposer.js";
export type { MessageComposerBag } from "./headless/MessageComposer.js";
export { StartDirectChat } from "./headless/StartDirectChat.js";
export type { StartDirectChatBag } from "./headless/StartDirectChat.js";

// ── nav ──────────────────────────────────────────────────────────────────────
export { navEntries } from "./nav/manifest.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export { CHAT_I18N_KEYS, chatI18nBundleEn, registerChatI18n } from "./i18n/keys.js";
export type { ChatI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  CHAT_ERRORS,
  CHAT_ERROR_CODES,
  chatErrorBundleEn,
  explainChatError,
} from "./i18n/errorsMap.js";
export type {
  ChatErrorCode,
  ChatErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
