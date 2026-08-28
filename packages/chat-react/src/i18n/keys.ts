import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { chatErrorBundleEn } from "./generated/errors.gen.js";

/**
 * chat-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's
 * i18n engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys.
 */
export const CHAT_I18N_KEYS = {
  unknownError: "chat.error.unknown",

  // Conversation list
  listTitle: "chat.list.title",
  listEmpty: "chat.list.empty",
  listLoading: "chat.list.loading",
  listLoadMore: "chat.list.load_more",
  listEnd: "chat.list.end",
  listRetry: "chat.list.retry",
  listUnread: "chat.list.unread",
  listOpen: "chat.list.open",

  // Conversation kinds. NOT a row title any more: the inbox used to title
  // every row with its kind, so a seller with ten buyers read ten rows
  // saying "Direct message" and told them apart by the clock. A kind is now
  // what it always was — a category — and it is rendered only where there is
  // no person to name (a support case).
  kindDirect: "chat.kind.direct",
  kindGroup: "chat.kind.group",
  kindSupport: "chat.kind.support",

  // WHO the row is with. The names come from a host seam (`model/slots.ts`);
  // these two are what the skin says when the seam has not answered.
  //
  // `personUnnamed` must read as a FAILURE, never as a label. The whole
  // defect this pair shipped was a fallback that looked deliberate — and the
  // house has been bitten by that exact shape before, when a healthy chat
  // banner permanently read "Refreshing every few seconds".
  personUnnamed: "chat.person.unnamed",
  /** The lookup is in flight — nobody has failed yet, so do not say so. */
  personLoading: "chat.person.loading",
  /** Prefix on a preview of the reader's OWN last line. */
  listPreviewOwn: "chat.list.preview_own",
  /** A tombstone still occupies the last-line slot; it is not blank. */
  listPreviewDeleted: "chat.list.preview_deleted",

  // WHAT the thread is about (stapel-chat 0.6.0 subjects). The card itself is
  // the subject owner's, resolved server-side; these name the states chat can
  // be in about it.
  /** Accessible name of the pinned card region. */
  subjectLabel: "chat.subject.label",
  /** Accessible name of the link out to the thing itself. */
  subjectOpen: "chat.subject.open",
  /** The subject was deleted — the conversation about it still exists. */
  subjectGone: "chat.subject.gone",
  /** Paused, sold, withdrawn: it exists and is not on offer. */
  subjectUnavailable: "chat.subject.unavailable",
  /** The card could not be built (`meta_reason` says why, upstream). */
  subjectUnresolved: "chat.subject.unresolved",

  // Thread
  threadLoading: "chat.thread.loading",
  threadEmpty: "chat.thread.empty",
  threadRetry: "chat.thread.retry",
  threadLoadOlder: "chat.thread.load_older",
  threadBeginning: "chat.thread.beginning",
  threadSystem: "chat.thread.system",
  /**
   * The empty arm of a thread that HAS a subject. Widening `direct_key` with
   * the subject means the first message about a listing opens a new thread
   * beside the pair's old catch-all one, and to both of them that looks like
   * a duplicate. The copy answers it without naming it: this thread is about
   * this one thing, which is the whole difference.
   */
  threadEmptySubject: "chat.thread.empty_subject",
  /** The overflow menu: its trigger's accessible name and its sheet's title. */
  threadMenu: "chat.thread.menu",

  // Composer
  composerPlaceholder: "chat.composer.placeholder",
  composerSend: "chat.composer.send",
  composerSending: "chat.composer.sending",
  composerBlockedEmpty: "chat.composer.blocked.empty",
  composerBlockedTooLong: "chat.composer.blocked.too_long",

  // "Message the seller"
  startButton: "chat.start.button",
  startStarting: "chat.start.starting",
  startBlockedSelf: "chat.start.blocked.self",
  startBlockedUnknownSeller: "chat.start.blocked.unknown_seller",
  /** A visitor: the POST is `IsAuthenticated`, so say so before the click. */
  startBlockedSignIn: "chat.start.blocked.sign_in",
  /** We have not finished asking who this is. Not "you may not". */
  startBlockedMandateUnknown: "chat.start.blocked.mandate_unknown",
  /** The door beside a blocked "message the seller": the container says WHERE. */
  startSignIn: "chat.start.sign_in",

  // Transport (the seam is invisible to the UI's BEHAVIOUR, but a person may
  // still be told whether the thread is live or on a timer).
  //
  // `chat.transport.polling` — "Refreshing every few seconds" — used to live
  // here and is GONE, because it was the sentence that could never be true
  // where it was rendered. The tag falls back to a transport label only when
  // there is NO named degradation, and the states in which that happens are
  // the healthy ones: a socket that has not opened yet, a socket deliberately
  // held back until the thread window loads, and a resync that is catching
  // up. Whenever polling really is the answer there IS a named degradation
  // (`no_socket`, `never_connected`, `reconnecting…`) and it is that sentence
  // which renders. So the pair's own complaint copy was printed on precisely
  // the screens where nothing was wrong — a standing banner that trains
  // people to ignore the one message that matters.
  transportLive: "chat.transport.live",
  transportConnecting: "chat.transport.connecting",
  transportCatchingUp: "chat.transport.catching_up",
  transportIdle: "chat.transport.idle",

  // Degraded transport. These exist because "Refreshing every few seconds"
  // was, for months, the only thing a person was told while every websocket
  // handshake was being refused — a degraded mode nobody could tell from a
  // design decision. One key per named reason (`flows/freshness.ts`).
  transportReconnecting: "chat.transport.degraded.reconnecting",
  /**
   * A 4401 is waiting on core's single-flight refresh. The one key here that
   * names a QUESTION — the copy must not read as "it worked", because at the
   * moment it is on screen nobody knows. Debounced; see
   * `RENEWING_CREDENTIAL_DEBOUNCE_MS`.
   */
  transportRenewingCredential: "chat.transport.degraded.renewing_credential",
  /** Down long enough to be worth naming — and still trying, always. */
  transportReconnectingLong: "chat.transport.degraded.reconnecting_long",
  /** Configured, tried, never once open. The state the defect lived in. */
  transportNeverConnected: "chat.transport.degraded.never_connected",
  transportSignInRequired: "chat.transport.degraded.sign_in_required",
  transportForbidden: "chat.transport.degraded.forbidden",
  /** Access withdrawn mid-socket (a `kick`, then 4410). */
  transportRevoked: "chat.transport.degraded.revoked",
  /** The deployment's socket origin allowlist, not this person's rights. */
  transportOriginNotAllowed: "chat.transport.degraded.origin_not_allowed",
  transportUnsupported: "chat.transport.degraded.unsupported",
  transportNoSocket: "chat.transport.degraded.no_socket",

  // Backend error keys the pair OWNS the localization of. stapel-chat ships
  // English only (it has no `translations/` directory), so its 12 keys are
  // absent from the generated ru/es bundles and are authored here instead —
  // the stapel-forms/stapel_attributes precedent. Listed as keys so the
  // i18n-key-exists lint knows them and `test/i18n.test.ts` can prove all
  // three locales carry them.
  errorEmptyMessage: "error.400.chat_empty_message",
  errorBodyTooLong: "error.400.chat_body_too_long",
  errorAttachmentsDisabled: "error.400.chat_attachments_disabled",
  errorInvalidDirect: "error.400.chat_invalid_direct",
  errorInvalidKind: "error.400.chat_invalid_kind",
  errorKindDisabled: "error.400.chat_kind_disabled",
  errorInvalidReply: "error.400.chat_invalid_reply",
  errorNotSupport: "error.400.chat_not_support",
  errorNotOperator: "error.403.chat_not_operator",
  errorNotParticipant: "error.403.chat_not_participant",
  errorConversationNotFound: "error.404.chat_conversation_not_found",
  errorAlreadyAssigned: "error.409.chat_already_assigned",

  // Nav-manifest label (`../nav/manifest.ts`) — read by a shell via
  // `t(entry.labelKey)`.
  navConversations: "chat.nav.conversations",
} as const;

export type ChatI18nKey = (typeof CHAT_I18N_KEYS)[keyof typeof CHAT_I18N_KEYS];

/**
 * English fallback bundle for chat-react UI keys + backend error codes. The
 * generated `chatErrorBundleEn` (from stapel-chat's error registry, `pnpm
 * gen:errors`) is spread FIRST so every backend `error.*` key has a fallback —
 * a `StapelApiError.code` never renders as a raw key. Hand-polished copy below
 * then OVERRIDES the generated English for the keys users see most.
 */
export const chatI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...chatErrorBundleEn,

  // chat-react UI
  "chat.error.unknown": "Something went wrong. Please try again.",

  "chat.list.title": "Messages",
  "chat.list.empty": "No conversations yet.",
  "chat.list.loading": "Loading conversations…",
  "chat.list.load_more": "Load more",
  "chat.list.end": "That's everything.",
  "chat.list.retry": "Try again",
  "chat.list.unread": "{count} unread",
  "chat.list.open": "Open",

  "chat.kind.direct": "Direct message",
  "chat.kind.group": "Group",
  "chat.kind.support": "Support",

  "chat.person.unnamed": "Name unavailable",
  "chat.person.loading": "Loading…",
  "chat.list.preview_own": "You: {text}",
  "chat.list.preview_deleted": "Message deleted",

  "chat.subject.label": "What this conversation is about",
  "chat.subject.open": "Open",
  "chat.subject.gone": "This has been removed.",
  "chat.subject.unavailable": "This is not available right now.",
  "chat.subject.unresolved":
    "We couldn't load what this conversation is about.",

  "chat.thread.loading": "Loading messages…",
  "chat.thread.empty": "No messages yet. Say hello.",
  "chat.thread.retry": "Try again",
  "chat.thread.load_older": "Show earlier messages",
  "chat.thread.beginning": "This is the beginning of the conversation.",
  "chat.thread.system": "System",
  "chat.thread.empty_subject":
    "No messages about this yet. Say hello — this conversation stays with it.",
  "chat.thread.menu": "Conversation options",

  "chat.composer.placeholder": "Write a message…",
  "chat.composer.send": "Send",
  "chat.composer.sending": "Sending…",
  "chat.composer.blocked.empty": "Write something first.",
  "chat.composer.blocked.too_long":
    "That is longer than {max} characters — shorten it a little.",

  "chat.start.button": "Message the seller",
  "chat.start.starting": "Opening…",
  "chat.start.blocked.self": "This is your own listing.",
  "chat.start.blocked.unknown_seller": "This listing has no seller to write to.",
  "chat.start.blocked.sign_in": "Sign in to message the seller.",
  "chat.start.blocked.mandate_unknown": "Checking your session…",
  "chat.start.sign_in": "Sign in",

  "chat.transport.live": "Live",
  "chat.transport.connecting": "Connecting…",
  "chat.transport.catching_up": "Catching up…",
  "chat.transport.idle": "Paused",

  "chat.transport.degraded.reconnecting": "Reconnecting…",
  // A question, deliberately. "Renewing your session" would be read as "and
  // it will work" — at this moment the refresh has not landed, and one of the
  // three things it can land on is being signed out.
  "chat.transport.degraded.renewing_credential":
    "Checking your session — live messages are waiting on the answer.",
  "chat.transport.degraded.reconnecting_long":
    "Still reconnecting — showing messages from your last update.",
  "chat.transport.degraded.never_connected":
    "Live messages aren't reaching this app — refreshing every few seconds instead.",
  "chat.transport.degraded.sign_in_required":
    "Live messages stopped — sign in again to get them back.",
  "chat.transport.degraded.forbidden":
    "Live messages are unavailable for this conversation.",
  "chat.transport.degraded.revoked":
    "You no longer have access to this conversation.",
  "chat.transport.degraded.origin_not_allowed":
    "Live messages are blocked for this site — an administrator has to allow it.",
  "chat.transport.degraded.unsupported":
    "Live messages are unavailable — this app needs an update.",
  "chat.transport.degraded.no_socket":
    "Live messages are off here — refreshing every few seconds instead.",

  "chat.nav.conversations": "Messages",
};

/**
 * Register chat-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`).
 *
 * MERGE-PRIORITY CONVENTION (i18n-shipping.md §3 — every `@stapel/*-react`
 * pair follows it): registration order IS override priority, later wins per
 * key. Within a locale, layers register bottom-up:
 *
 *   1. generated en floor (`chatErrorBundleEn` — coverage by construction),
 *   2. the pair's polish / UI copy (this bundle spreads 1 then overrides),
 *   3. the pair's locale bundle from the `./i18n/<locale>` subpath,
 *   4. the HOST's own bundle — always registered LAST.
 */
export function registerChatI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, chatI18nBundleEn);
}
