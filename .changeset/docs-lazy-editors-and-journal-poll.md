---
"@stapel/docs-react": minor
---

Real editors, behind optional peers — and the update journal finally has a reader.

Two things this pair promised and had not delivered: an editing surface worth
the name, and any consumer at all for the `crdt` half of the module's contract.

**The editors — `./editors/codemirror` and `./editors/milkdown`.**
The verdict the editors research reached (§1.3) implemented as written:
CodeMirror 6 for source editing, Milkdown for markdown WYSIWYG, both as
OPTIONAL peer dependencies fetched with a dynamic `import()` at mount, both
behind their own subpaths, neither anywhere near the main entry. That is a
structural rule, not a preference: the main entry is budgeted at 12 KB and the
lightest WYSIWYG on the market is 109 KB gzip. `size-limit` measures the
consequence; `test/prodBundlePurity.test.ts` now names the cause, so a leak is
reported as "an engine reached the main entry" rather than as "the budget
moved". Registration is the only integration surface —
`registerCodeMirrorDocEditors()`, `registerMilkdownDocEditor()`, or
`registerDocsRichEditors()` from `/default` for both at once with the skin's
`EditorChrome` kept, so Save, the dirty marker and the conflict override stay
exactly where they were.

**Round-trip, stated in the API and not only in a doc.** CodeMirror is
byte-stable by construction — its document model IS the string, which is the
acceptance criterion for a module written to by services: a machine-generated
document opened and closed untouched is the same FILE, not merely the same
document. Milkdown is markdown-native but **not** byte-stable: remark
normalizes list markers, escapes, emphasis and the trailing newline, so the
first WYSIWYG save of a generated file can read as a rewrite of the whole
thing in a server-side diff. Hence a one-click source mode (CodeMirror) on the
markdown surface, `defaultSourceMode` for products whose documents are written
by machine, and a codec whose identity is asserted over the strings that break
normalizing editors rather than asserted in prose.

**Absence is a designed screen.** With the peers not installed, each surface
renders the pair's own plain builtin under a sentence saying why, and the
document is still edited and saved through the same If-Match bag — a missing
`@milkdown/crepe` degrades to CodeMirror source, a missing CodeMirror to the
textarea. `csv` is deliberately untouched: the zero-dependency grid is the
better surface for a table.

**`useDocUpdates` — the journal poll.** `getUpdates`/`postUpdate` have been on
the client since 0.1.0 with nothing reading them, which is why a `crdt`
document could only be told "no collaborative editor is registered". The hook
polls `?since=`, keeps the sequence cursor, hands out each batch of new rows,
and treats a **resync** as what it is — not an error but an order to stop
replaying: it invalidates the content and document reads, drops its buffer and
re-arms the cursor at the head the backend named. Polling is a floor, not a
claim about transport: `enabled: false` turns it off for a host that has a
socket, and `useAppendUpdates` posts a batch while invalidating only the
document head (an append happens as often as a person types — the module-root
invalidation every other mutation performs would be a refetch storm).

Five new i18n keys (en/ru/es), a demo of all four editor arms including the
one where nothing is installed, and 39 new tests.
