/**
 * FINDING ONE CONVERSATION IN AN INBOX — the query half.
 *
 * ── What changed, and why this file is not a predicate ────────────────────
 *
 * Until stapel-chat 0.8.2 `GET /chat/api/v1/conversations` took `anchor`,
 * `direction` and `limit` and nothing else, so a toolbar over it could only
 * narrow the rows a client had ALREADY loaded: a search box that reads one
 * page of twenty and reports "nothing found" over an inbox of three hundred.
 * This pair shipped that client-side predicate with the gap named beside it.
 *
 * The gap is closed. `search` and `unread` are the server's own parameters,
 * they match the three things a row DRAWS (below), and they filter BEFORE the
 * page is taken — so `anchor` / `direction` / `limit` mean exactly what they
 * mean without them, and paging a search can never surface a row the search
 * excluded. What lives here is therefore the *query*: what goes in the key,
 * what goes on the wire, and when a keystroke is allowed to become a request.
 *
 * ── THE CLIENT PREDICATE IS GONE, AND NOT AS AN OPTIMISATION ──────────────
 *
 * The obvious cheap trick — keep filtering the loaded rows locally for the
 * frame before the server answers — is a DOUBLE FILTER, and a visible one.
 * The server matches a row on things this client does not hold:
 *
 *   · the counterpart's display name lives in the host's people seam
 *     (`model/slots.ts`), which answers asynchronously and may still be
 *     `pending` — a local predicate reads "" and drops the row;
 *   · the subject card's title is matched at the fields that subject type's
 *     own `search_fields` policy names, which this pair cannot know;
 *   · the last line is now `last_message.body_preview`, but the local rules
 *     for a tombstone / attachment / unlabelled system marker were this
 *     pair's guesses, not `services.drawn_last_line`.
 *
 * So a row the server correctly returns would blink out of the list for the
 * length of the debounce and the round trip — which is exactly when a person
 * is looking at the box they are typing in. One authority over what matches,
 * and it is the one that can see every field. The pane shows the rows it has
 * while the next answer is in flight, unfiltered, and swaps them when it
 * lands.
 */
import { useEffect, useState } from "react";

/**
 * The three texts one row can be found BY — as the row itself draws them.
 *
 * Kept as a documented shape (rather than deleted with the predicate) because
 * it is the constraint the server's rule is built on and a host writing its
 * own thread list is bound by the same one: a row that comes back for a word
 * nobody can see on it reads as a bug in the search box, and a row that draws
 * a word the search will not find reads as the same bug from the other side.
 * The ids, the kind and the clock are searched by neither side.
 */
export interface InboxRowText {
  /** The counterpart, exactly as the row titles them. */
  readonly person: string;
  /** The subject's title (the listing), or `""` when there is none. */
  readonly subject: string;
  /** The last line the row draws, or `""` when it draws none. */
  readonly preview: string;
}

/**
 * WHICH OF THE TWO LISTS a thread pane is showing.
 *
 * `"inbox"` is the conversations a person is in; `"left"` is the ones they
 * walked out of (stapel-chat 0.8.6 `?left=true`). They are exact complements
 * — every thread a person is party to is on one and never on both — which is
 * why this is one axis with two values and not a filter that could be off.
 */
export type ChatInboxView = "inbox" | "left";

/** What a thread list is narrowed by. Every half travels to the server. */
export interface ChatInboxFilter {
  /** Free text. Blank or whitespace-only is no search at all. */
  readonly search?: string;
  /** Keep only conversations with a non-zero `unread_count`. */
  readonly unreadOnly?: boolean;
  /**
   * Ask for the LEFT threads instead of the inbox (stapel-chat 0.8.6).
   *
   * NOT DEBOUNCED and never merged with the inbox's pages: it is a different
   * list with a different ordering, so it takes its own cache entry and its
   * own anchor chain (`model/queryKeys.ts`).
   */
  readonly view?: ChatInboxView;
  /**
   * How long a keystroke waits before it becomes a request, in ms. Default
   * {@link INBOX_SEARCH_DEBOUNCE_MS}. `0` sends every keystroke — for a test
   * that is asserting something other than the debounce, or a host driving
   * the value from a URL it already debounced.
   */
  readonly searchDebounceMs?: number;
}

/**
 * How long a keystroke waits before it becomes a request.
 *
 * A search that fires per character turns one word into six page reads, each
 * of which runs six correlated subqueries over the caller's whole inbox
 * server-side (`services.with_last_message`), and the answers race: the reply
 * to "bicy" can land after the reply to "bicycl" and paint the wider list
 * over the narrower one. 300 ms is a pause between words, not between
 * letters.
 */
export const INBOX_SEARCH_DEBOUNCE_MS = 300;

/**
 * The search as it goes on the wire and into the query key.
 *
 * Trimmed, and nothing else: the server case-folds (and case folding is
 * language-dependent — the dotted/dotless i — so a client that lower-cased
 * through the process default would be answering a question the server was
 * never asked). Whitespace-only comes back `""`, which every reader below
 * treats as no search at all.
 */
export function normalizeInboxSearch(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Is the toolbar narrowing anything at all right now? */
export function inboxFilterActive(filter: ChatInboxFilter | undefined): boolean {
  return (
    normalizeInboxSearch(filter?.search) !== "" || filter?.unreadOnly === true
  );
}

/**
 * A value that only moves once it has stopped moving.
 *
 * `delayMs <= 0` returns the live value with no state of its own — not a
 * zero-length timer, which would still cost a frame and make "no debounce"
 * observably different from no debounce.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return delayMs <= 0 ? value : settled;
}

/**
 * The filter the QUERY runs on: the chip and the tab immediately, the text
 * once typing has paused.
 *
 * Only the search is debounced. A chip is one press with one meaning and
 * delaying it would be a control that lags for no reason; a search box is a
 * sequence of intermediate words nobody asked to see the answer to. The tab
 * is not a filter at all — it is which list this is — so delaying it would
 * leave a person looking at the other one.
 */
export function useSettledInboxFilter(
  filter: ChatInboxFilter | undefined
): {
  readonly search: string;
  readonly unreadOnly: boolean;
  readonly left: boolean;
} {
  const delay = filter?.searchDebounceMs ?? INBOX_SEARCH_DEBOUNCE_MS;
  const search = useDebouncedValue(normalizeInboxSearch(filter?.search), delay);
  return {
    search,
    unreadOnly: filter?.unreadOnly === true,
    left: filter?.view === "left",
  };
}
