/**
 * FINDING ONE CONVERSATION IN AN INBOX — the pure half of the thread list's
 * toolbar.
 *
 * ── Why this is client-side, and why it says so on screen ─────────────────
 *
 * `GET /chat/api/v1/conversations` takes `anchor`, `direction` and `limit`,
 * and nothing else: no search term, no unread filter (stapel-chat 0.8.0,
 * `docs/schema.json` — the pin this pair is generated against). So a toolbar
 * over that endpoint can only narrow what the client has ALREADY loaded, and
 * the one dishonest thing it could do is imply otherwise — a search box that
 * silently reads one page of twenty and reports "nothing found" over an inbox
 * of three hundred. The panel therefore states its scope whenever there is
 * more to load, and this module is deliberately a predicate over rows in
 * memory rather than a query builder.
 *
 * NAMED UPSTREAM GAP: a `search` parameter (over the counterpart's name, the
 * subject title and the message bodies) and an `unread=true` filter on the
 * conversation list endpoint would make both of these server-side and exact.
 * Both are contract changes in stapel-chat, not something a skin can paper
 * over — the same shape as the `last_message` projection `model/previews.ts`
 * already names.
 *
 * ── What a row is findable BY ─────────────────────────────────────────────
 *
 * The three things the row actually draws: WHO it is with, WHAT it is about,
 * and the last line when this client holds one. Nothing else — a row cannot
 * be found by a word that is nowhere on it, which is why the ids, the kind
 * and the clock are not searched.
 */
import type { ChatMessage, Conversation } from "../api/types.js";

/** The three texts one row can be found by — as the row itself renders them. */
export interface InboxRowText {
  /** The counterpart, exactly as the row titles them. */
  readonly person: string;
  /** The subject's title (the listing), or `""` when there is none. */
  readonly subject: string;
  /** The last line this client holds, or `""` when it holds none. */
  readonly preview: string;
}

/**
 * Fold a typed query into the form the comparison happens in. The locale is
 * handed in rather than defaulted: case folding is language-dependent (the
 * dotted/dotless i is the standing example), and a chat pair that renders its
 * clock and its prices through `Intl` should not lower-case through the
 * process default.
 *
 * A query of only whitespace is not a query — it comes back `""`, which every
 * predicate below reads as "no search at all".
 */
export function normalizeSearch(value: string, locale: string): string {
  return value.trim().toLocaleLowerCase(locale);
}

/**
 * The last line as a SEARCHABLE string — which is to say, only when the row
 * really shows it.
 *
 * A deleted message renders as a tombstone and a system line renders as the
 * word "System": in both cases the body is either gone or machine vocabulary
 * (`video.call.ended:188`), so matching against it would find rows by text
 * that is nowhere on the screen.
 */
export function previewSearchText(message: ChatMessage | undefined): string {
  if (message === undefined) return "";
  if (message.deleted === true || message.kind === "system") return "";
  return message.body;
}

/**
 * Does this row survive the toolbar?
 *
 * `unreadOnly` is the server's own `unread_count`, which is computed per
 * conversation for the reader — not a count this client derives — so the chip
 * says exactly what the badge on the row says.
 */
export function matchesInboxFilter(
  conversation: Conversation,
  text: InboxRowText,
  options: {
    /** Already through {@link normalizeSearch}. `""` matches everything. */
    readonly needle: string;
    readonly unreadOnly: boolean;
    readonly locale: string;
  }
): boolean {
  if (options.unreadOnly && conversation.unread_count <= 0) return false;
  if (options.needle === "") return true;
  return [text.person, text.subject, text.preview].some(
    (field) =>
      field !== "" &&
      field.toLocaleLowerCase(options.locale).includes(options.needle)
  );
}

/** Is the toolbar narrowing anything at all right now? */
export function inboxFilterActive(options: {
  readonly needle: string;
  readonly unreadOnly: boolean;
}): boolean {
  return options.needle !== "" || options.unreadOnly;
}
