/**
 * `@stapel/chat-react` — the headless React pair for stapel-chat
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * WHAT IS DIFFERENT ABOUT THIS PAIR. Its backend has two ways to deliver the
 * same journal: the REST history, and two resumable/ephemeral WebSocket
 * streams on `@stapel/realtime`'s wire — `chat:conv:<id>` (`ws/chat/<id>`,
 * resumed by `rev_seq`) and `chat:user:<id>` (`ws/chat/inbox`). Both are
 * wired here, behind ONE seam (`useChatFreshness`), and no component above
 * that seam can tell which is running. Writes go over REST by default; chat
 * is also the substrate's one documented socket-WRITE exception, and that
 * seam is `model/socketWrites.ts`.
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

// ── realtime (chat's stream keys and payloads, on @stapel/realtime) ─────────
// The protocol itself is NOT here any more and never will be again: the
// envelope, the resume handshake, the heartbeat answer, the close-code table
// and the 4401 session refresh are `@stapel/realtime`'s, one implementation
// for the fleet. What a pair owns is its stream keys and what its payloads
// mean — which is all this section exports.
export {
  CHAT_ACTIVITY_STATES,
  CHAT_FRAME_ACTIVITY,
  CHAT_FRAME_DELETE,
  CHAT_FRAME_DELIVERED,
  CHAT_FRAME_EDIT,
  CHAT_FRAME_READ,
  CHAT_FRAME_SEND,
  CHAT_SIGNAL_ACTIVITY,
  CHAT_SIGNAL_DELIVERED,
  CHAT_SIGNAL_INBOX,
  CHAT_SIGNAL_READ,
  CHAT_WS_ERRORS,
  chatClientMessageId,
  isChatMessageFrame,
  readChatActivityFrame,
  readChatInboxFrame,
  readChatMarkerFrame,
  readChatMessageFrame,
  readChatMessagePayload,
} from "./realtime/frames.js";
export type {
  ChatActivityFramePayload,
  ChatActivityPayload,
  ChatActivityState,
  ChatDeletePayload,
  ChatEditPayload,
  ChatInboxPayload,
  ChatMarkerFramePayload,
  ChatMarkerPayload,
  ChatMessagePayload,
  ChatSendPayload,
  ChatWriteRefusal,
} from "./realtime/frames.js";
export {
  CHAT_INBOX_SOCKET_PATH,
  CHAT_STREAM_MODULE,
  chatConversationSocketPath,
  chatConversationStream,
  chatConversationStreamKey,
  chatInboxStream,
  chatSocketUrl,
  chatSocketUrlForStreamKey,
  chatStreamForConversation,
  chatUserStreamKey,
  deriveChatSocketOrigin,
} from "./realtime/streams.js";
export type { ChatStream } from "./realtime/streams.js";
// The named degradations — every reason a socket is not carrying a stream,
// with its i18n key. A degraded transport that cannot say why is
// indistinguishable from a working product, which is how this pair's own
// defect survived for months.
// `withRenewingCredential` is the one that names a QUESTION: a 4401 is inside
// core's single-flight refresh and nobody yet knows which of its three
// landings is coming. Exported with its threshold so a host skin that
// replaces the tag debounces on the same number the pair does.
export {
  RENEWING_CREDENTIAL_DEBOUNCE_MS,
  chatDegradation,
  chatDegraded,
  withRenewingCredential,
} from "./realtime/degradation.js";
export type { ChatDegraded, ChatDegradedReason } from "./realtime/degradation.js";

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
  ChatRealtimeClientOptions,
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
  applyRevision,
  mergeMessage,
  mergeNewerPage,
  mergeOlderPage,
  threadFirstSeq,
  threadLastRevSeq,
  threadLastSeq,
  threadWindowFromPage,
} from "./model/threadWindow.js";
export type {
  ChatMessageRevision,
  ChatThreadWindow,
  ThreadMergeResult,
} from "./model/threadWindow.js";
// Chat is the substrate's ONE documented socket-write exception; this is the
// typed way to emit those six frames, not a replacement for the REST twins.
export { createChatSocketWrites } from "./model/socketWrites.js";
export type {
  ChatFrameSender,
  ChatSendOverSocket,
  ChatSocketWrites,
} from "./model/socketWrites.js";

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
