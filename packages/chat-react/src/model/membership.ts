/**
 * WHO IS STILL IN THE ROOM — `participants[].left_at` (stapel-chat 0.8.5).
 *
 * ── Why the state is read and not remembered ──────────────────────────────
 *
 * Leaving is announced twice, and the two halves answer different questions.
 * A `system` line — `chat.participant.left:<user_id>` — records WHEN it
 * happened, in the transcript, for a reader who is scrolling the history.
 * `participants[].left_at` carries the DURABLE half on every conversation
 * body, so a client that was not connected when the line was posted reads the
 * state instead of replaying the journal to reconstruct it.
 *
 * A header therefore reads the field. It never derives the answer from the
 * marker it happens to have seen, because "have I seen the line" is a
 * property of this session's connection and not of the thread.
 *
 * ── And why nothing here remembers that *I* left ──────────────────────────
 *
 * The leaver's own row is stamped too, and this module deliberately gives no
 * way to cache that. Leaving hides a thread from one inbox; an AUTHORED
 * message from the other side clears the marker for everyone, and the row
 * comes back on the very next list read. A client holding its own "I left"
 * set would have to be told to forget it, by an event nobody sends — and
 * would suppress a row the server correctly returned, which is the one
 * failure the person cannot see or work around.
 *
 * ── The absent field is not "nobody has left" being asserted ──────────────
 *
 * `left_at` is absent from the schema's `required` list, so a deployment on
 * 0.8.4 sends a participant body without it. That reads as "nobody has left",
 * which is what that server means: it has no way for anybody to leave at all.
 * Degrading toward the state the older contract can actually be in is the
 * only safe direction — the alternative is a header announcing a departure a
 * server never recorded.
 */
import type { Conversation, Participant } from "../api/types.js";

/**
 * When this participant left the thread, ISO 8601 — or `null` for somebody
 * who is still in it (and for a server that does not carry the field).
 */
export function participantLeftAt(
  conversation: Conversation | undefined,
  userId: string | null
): string | null {
  if (conversation === undefined || userId === null) return null;
  // `participants` is optional in the generated schema; a body without it is
  // a body with nobody to have left, not a crash.
  const participant = (conversation.participants ?? []).find(
    (candidate: Participant) => candidate.user_id === userId
  );
  return participant?.left_at ?? null;
}

/** Has this participant left? The boolean reading of {@link participantLeftAt}. */
export function participantHasLeft(
  conversation: Conversation | undefined,
  userId: string | null
): boolean {
  return participantLeftAt(conversation, userId) !== null;
}
