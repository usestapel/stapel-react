/**
 * The read marker, and the one rule that governs it: it only ever moves
 * forward.
 *
 * The server already enforces that (`services.mark_read` never lowers
 * `last_read_seq`), so a client that sends a smaller value is not corrupting
 * anything — it is spending a request to be ignored, and, worse, telling the
 * UI a story that the next list refresh will contradict. The guard is here so
 * the client's own belief matches the server's.
 *
 * WHY THE CLIENT HAS TO REMEMBER AT ALL. `ConversationResponse.participants[]`
 * carries `last_read_seq` — for every participant, with no marker for which
 * one is the caller (the response has no "me"). `unread_count` is the only
 * caller-relative number the endpoint returns. So the highest marker THIS
 * client has reported cannot be read back off the wire; it is remembered in
 * the query cache (`chatQueryKeys.readMarker`), which the session layer wipes
 * at logout along with everything else.
 */

/**
 * The value to send, or `null` for "already reported — send nothing".
 *
 * `candidate` of 0 (an empty thread) is never sent: there is no such seq.
 */
export function nextReadMarker(
  known: number | undefined,
  candidate: number
): number | null {
  if (!Number.isFinite(candidate) || candidate <= 0) return null;
  if (known !== undefined && candidate <= known) return null;
  return candidate;
}
