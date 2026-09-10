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

  // FINDING ONE CONVERSATION. Since stapel-chat 0.8.2 both controls are the
  // SERVER's own `search` / `unread` parameters, filtering before the page is
  // taken — so there is no longer a scope to caveat, and the sentence that
  // used to say "among the conversations loaded so far"
  // (`chat.list.filter.scope`) is gone from all three locales rather than
  // left standing as a lie about a filter that is now total.
  listSearchLabel: "chat.list.search.label",
  listSearchPlaceholder: "chat.list.search.placeholder",
  listUnreadOnly: "chat.list.filter.unread",
  /** The filtered list found nothing — NOT the same sentence as an empty inbox. */
  listNoMatches: "chat.list.no_matches",

  // ── THE TWO LISTS (stapel-chat 0.8.6) ────────────────────────────────────
  //
  // `?left=true` is the exact complement of the inbox, so the pane offers two
  // tabs and never a "show left conversations too" switch: a thread is on one
  // of them and never on both, and a control that could put them side by side
  // would be describing a state the server cannot produce.
  /** The default tab: the conversations this person is in. */
  listTabInbox: "chat.list.tab.inbox",
  /** The other one: the conversations they walked out of. */
  listTabLeft: "chat.list.tab.left",
  /**
   * The left list, empty. NOT `chat.list.empty` — "no conversations yet" over
   * an inbox of three hundred that this person has simply never left any of
   * would be the same lie the filtered-empty arm exists to prevent.
   */
  leftEmpty: "chat.left.empty",
  /** WHEN this person left, on the row. `{date}` is `Intl`-rendered. */
  leftAt: "chat.left.at",
  /**
   * The search field's placeholder ON THE LEFT TAB, and it differs from the
   * inbox's for a reason a person would otherwise report as a bug.
   *
   * The server's search rule is the same on both lists — the counterpart's
   * name, the subject card's title, and the last line the row DRAWS — but a
   * left thread's last line IS the departure marker, and an unlabelled marker
   * draws nothing and is therefore found by nothing. So the inbox's promise
   * ("Name, listing or message") is one third false here, and the field says
   * what it can actually find instead of inviting a search that will come
   * back empty for a word the person can remember reading.
   */
  listSearchPlaceholderLeft: "chat.list.search.placeholder_left",

  // ── THE WAY BACK (stapel-chat 0.8.6 POST /conversations/{id}/rejoin) ─────
  //
  // Leaving destroys nothing, so it must be undoable, and the undo needs no
  // confirmation of its own: it is the SAFE direction of the same choice —
  // it puts a thread back on one list and takes nothing from anybody. The
  // control therefore acts on the press, where leaving asks first.
  /** The control on a left row. */
  rejoinAction: "chat.rejoin.action",
  /** In flight. One round trip, and a phone on a train is still a phone on a train. */
  rejoinPending: "chat.rejoin.pending",

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
  /**
   * The person a SENTENCE is about when the seam could not name them —
   * "{name} left the conversation" with nobody to put in the hole.
   *
   * Deliberately NOT `personUnnamed`. That key reads as a failure because it
   * stands where a name was promised (a row title, a header); this one stands
   * inside a sentence about somebody who is definitely there, where "Name
   * unavailable left the conversation" would be a broken line rather than an
   * honest one. Printing the raw user id instead is the third option and the
   * worst of them: a uuid at a reader is machine vocabulary, which is the
   * exact thing this whole contour exists to keep off the screen.
   */
  personSomeone: "chat.person.someone",
  /** Prefix on a preview of the reader's OWN last line. */
  listPreviewOwn: "chat.list.preview_own",
  /**
   * A tombstone still occupies the last-line slot; it is not blank.
   *
   * DORMANT ON THE INBOX ROW, deliberately. `last_message` (stapel-chat
   * 0.8.3) collapses "tombstone", "attachment-only" and "unlabelled system
   * marker" into one `body_preview: null` with `kind` beside it, so a row
   * cannot tell a withdrawn message from a picture. The key stays — it is the
   * copy the thread itself uses and the copy the row will use again the day
   * the projection says WHY it is null (`model/previews.ts` names the ask).
   */
  listPreviewDeleted: "chat.list.preview_deleted",
  /**
   * The last line is a system marker this deployment gave no words to
   * (`SYSTEM_LINE_LABELS` is empty out of the box). Something happened in the
   * thread and the row says only that — machine vocabulary like
   * `video.call.ended:188` is not a sentence to show anybody.
   */
  listPreviewSystem: "chat.list.preview_system",
  /**
   * The last line has no drawable words and is not a system line: an
   * attachment-only message (and, until the projection distinguishes them, a
   * tombstone). "A picture was sent" is right for the first and vague for the
   * second — calling a picture "deleted" would be wrong for both.
   */
  listPreviewAttachment: "chat.list.preview_attachment",

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

  // ── LEAVING A CONVERSATION (stapel-chat 0.8.5) ───────────────────────────
  //
  // The verb on the wire is `DELETE` and the copy must never be: nothing is
  // deleted. The confirmation's whole job is to say which of the two things
  // this is, in one sentence, BEFORE the press — what happens to your list,
  // and what happens to the other person's copy. A person who reads "delete"
  // and means "tidy" will not press it; a person who reads "delete" and means
  // "destroy it for both of us" will press it and be wrong.
  /** The control, in the thread's overflow menu and on an inbox row. */
  leaveAction: "chat.leave.action",
  /** The one sentence the confirmation is FOR: your list, and their copy. */
  leaveBody: "chat.leave.body",
  /** The affirmative. Not "Delete", and not the module's verb. */
  leaveConfirm: "chat.leave.confirm",
  /** In flight. The request is one round trip, but a phone on a train is not. */
  leavePending: "chat.leave.pending",

  /**
   * The system line THIS module writes when somebody leaves
   * (`chat.participant.left:<user_id>` — see `model/systemLines.ts`).
   *
   * `{name}` comes from the host's people seam. stapel-chat writes the marker
   * and owns no words for it on purpose: the id after the colon is there so a
   * client can name the person without the backend inventing a sentence in a
   * language it does not own.
   */
  systemParticipantLeft: "chat.system.participant_left",

  /**
   * The right pane of the desktop split inbox before anything is open. An
   * invitation, not an apology: nothing has failed and nothing is empty —
   * the person simply has not picked yet, and the list is right there.
   */
  splitEmpty: "chat.split.empty",

  // Composer
  composerPlaceholder: "chat.composer.placeholder",
  composerSend: "chat.composer.send",
  composerSending: "chat.composer.sending",
  composerBlockedEmpty: "chat.composer.blocked.empty",
  composerBlockedTooLong: "chat.composer.blocked.too_long",
  /**
   * A VISITOR WITH NO IDENTITY AT ALL. `POST /conversations/{id}/messages/` is
   * `IsAuthenticated`, so the press buys a 401 — the same refusal
   * {@link CHAT_I18N_KEYS.startBlockedSignIn} exists to deliver before the
   * click rather than after it.
   */
  composerBlockedSignIn: "chat.composer.blocked.sign_in",
  /**
   * A GUEST — an issued anonymous identity — and therefore NOT a block: the
   * send goes through, because the guest is authenticated. What it does not
   * have is a way back. The account lives in this browser and nowhere else,
   * so the conversation the person is about to start is reachable only from
   * this device until they sign in.
   *
   * Said beside the send control and not in place of it, because the two are
   * different claims: a blocked control owes a reason, a working one that
   * carries a risk owes a warning. A walk of a listing page found the call
   * door stating its refusal and this composer — live, enabled, on the same
   * screen — saying nothing at all.
   */
  composerSignIn: "chat.composer.sign_in",

  // "Message the seller"
  startButton: "chat.start.button",
  startStarting: "chat.start.starting",
  startBlockedSelf: "chat.start.blocked.self",

  // ── The call control (0.10.0) ────────────────────────────────────────────
  // chat owns the QUESTION ("may these two talk, about this thing, now") and
  // not the act: @stapel/video-react places the call. These keys are the
  // sentences a switched-off control shows, and every one of them names a
  // reason the person can act on.
  callButton: "chat.call.button",
  callBlockedSignIn: "chat.call.blocked.sign_in",
  callBlockedMandateUnknown: "chat.call.blocked.mandate_unknown",
  callBlockedUnknownPeer: "chat.call.blocked.unknown_peer",
  callBlockedSelf: "chat.call.blocked.self",
  /** No conversation to hang the call off. The server's authorizer requires
   * one — a user id is not a phone number — so this is blocked rather than
   * pressed into a 403. */
  callBlockedNoThread: "chat.call.blocked.no_thread",
  callBlockedBusy: "chat.call.blocked.busy",
  callBlockedPending: "chat.call.blocked.pending",
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
  // PRESENCE — the other person, from their own sockets. A separate block
  // from `transport.*` on purpose: those keys describe THIS client's
  // connection, and one control answering both questions is the defect
  // (a header that said "Live" whenever the reader's own socket was up,
  // beside the seller's name, reading as "the seller is online").
  notifyTitle: "chat.notify.title",
  notifyBody: "chat.notify.body",
  notifyDenied: "chat.notify.denied",
  notifyFrom: "chat.notify.from",
  /** The inline ask's two controls (D64): the ask lives above the composer,
   * so it carries its own buttons rather than a dialog's footer. */
  notifyAllow: "chat.notify.allow",
  notifyNotNow: "chat.notify.not_now",

  presenceOnline: "chat.presence.online",
  presenceLastSeen: "chat.presence.last_seen",
  presenceUnknown: "chat.presence.unknown",
  /**
   * They are not in the thread any more (`participants[].left_at`). It REPLACES
   * the presence sentence rather than joining it: "Online" about somebody who
   * has left the room is the same lie as the tag that read "Live" off the
   * reader's own socket, and "Last seen 5 minutes ago" invites a reply to
   * somebody who will not see it.
   */
  presenceLeft: "chat.presence.left",

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

  "chat.list.search.label": "Search conversations",
  "chat.list.search.placeholder": "Name, listing or message",
  "chat.list.search.placeholder_left": "Name or listing",
  "chat.list.filter.unread": "Unread",
  "chat.list.no_matches": "Nothing found.",

  "chat.list.tab.inbox": "Conversations",
  "chat.list.tab.left": "Left",
  "chat.left.empty": "You haven't left any conversations.",
  "chat.left.at": "Left {date}",
  "chat.rejoin.action": "Return to conversation",
  "chat.rejoin.pending": "Returning…",

  "chat.kind.direct": "Direct message",
  "chat.kind.group": "Group",
  "chat.kind.support": "Support",

  "chat.person.unnamed": "Name unavailable",
  "chat.person.loading": "Loading…",
  "chat.person.someone": "The other person",
  "chat.list.preview_own": "You: {text}",
  "chat.list.preview_deleted": "Message deleted",
  "chat.list.preview_system": "System message",
  "chat.list.preview_attachment": "Attachment",

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

  "chat.leave.action": "Leave conversation",
  "chat.leave.body":
    "This conversation will disappear from your list. The other person keeps the messages.",
  "chat.leave.confirm": "Leave",
  "chat.leave.pending": "Leaving…",
  "chat.system.participant_left": "{name} left the conversation",

  "chat.split.empty": "Pick a conversation",

  "chat.composer.placeholder": "Write a message…",
  "chat.composer.send": "Send",
  "chat.composer.sending": "Sending…",
  "chat.composer.blocked.empty": "Write something first.",
  "chat.composer.blocked.too_long":
    "That is longer than {max} characters — shorten it a little.",
  "chat.composer.blocked.sign_in": "Sign in to send a message.",
  "chat.composer.sign_in":
    "You are writing as a guest — this conversation lives only in this browser. " +
    "Sign in to keep it.",

  "chat.start.button": "Message the seller",
  "chat.start.starting": "Opening…",
  "chat.start.blocked.self": "This is your own listing.",

  // ── The call control ──────────────────────────────────────────────────────
  "chat.call.button": "Call",
  "chat.call.blocked.sign_in": "Sign in to call.",
  "chat.call.blocked.mandate_unknown": "One moment…",
  "chat.call.blocked.unknown_peer": "There is nobody to call here.",
  "chat.call.blocked.self": "This is your own listing.",
  "chat.call.blocked.no_thread": "Open the conversation first, then call.",
  "chat.call.blocked.busy": "You are already on a call.",
  "chat.call.blocked.pending": "Calling…",
  "chat.start.blocked.unknown_seller": "This listing has no seller to write to.",
  "chat.start.blocked.sign_in": "Sign in to message the seller.",
  "chat.start.blocked.mandate_unknown": "Checking your session…",
  "chat.start.sign_in": "Sign in",

  // `{when}` is a relative time from core's own formatter, so it follows the
  // reader's locale and cannot go stale in a catalogue.
  // Asked at the first message exchanged, never on arrival: `denied` is
  // terminal, so an early prompt spends the only chance there is.
  "chat.notify.title": "Get notified about replies?",
  "chat.notify.body":
    "We'll show a notification when a message arrives and this tab isn't in front of you. Nothing else.",
  "chat.notify.denied":
    "Notifications are switched off for this site. Turn them back on in your browser's site settings for this page.",
  "chat.notify.from": "New message",
  "chat.notify.allow": "Allow",
  "chat.notify.not_now": "Not now",

  "chat.presence.online": "Online",
  "chat.presence.last_seen": "Last seen {when}",
  // Never seen connect — a different fact from "seen long ago". Saying
  // nothing beats inventing a date.
  "chat.presence.unknown": "Offline",
  "chat.presence.left": "Left the conversation",

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
