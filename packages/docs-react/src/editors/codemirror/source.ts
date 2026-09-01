/**
 * The source codec for the CodeMirror surface — and the reason CodeMirror is
 * the pair's `txt` editor at all.
 *
 * The editors research (§1.1, §1.3) fixed one acceptance criterion above
 * every question of comfort: **`serialize ∘ parse` must be the identity on an
 * untouched document.** stapel-docs is written to by SERVICES (a transcript, a
 * summary, an export), and a document that is rewritten merely by being opened
 * corrupts every derived artifact built from it — the knowledge chunker's
 * offsets, a server-side diff, a git-shaped history.
 *
 * CodeMirror satisfies it by construction: its document model IS the text, so
 * this codec is the identity pair. That is not a placeholder — it is the
 * statement of the contract, in a form `test/lazyEditors.test.ts` can execute
 * on the strings that break other editors (list markers, escapes, hard breaks,
 * a missing trailing newline). An engine that CANNOT make this promise —
 * Milkdown, whose remark serializer normalizes — says so in its own module
 * instead of quietly failing the same test.
 */

/** Document bytes (already decoded to text by `useDocumentContent`) → the
 * editor's model. For a source editor the model IS the text. */
export function parseDocSource(raw: string): string {
  return raw;
}

/** The editor's model → what a snapshot save sends. Byte-for-byte what
 * {@link parseDocSource} was given, for a document nothing edited. */
export function serializeDocSource(text: string): string {
  return text;
}

/** True when this codec round-trips `raw` unchanged — the executable form of
 * the §1.1 promise, exported so a host can assert it over its own corpus. */
export function isByteStable(raw: string): boolean {
  return serializeDocSource(parseDocSource(raw)) === raw;
}
