---
"@stapel/docs-react": minor
---

The crdt-consumption slice over stapel-docs 0.7.0: live co-editing on the
update journal, both transports, one downstream shape.

- **Contract pin → v0.7.0** (`contract-pins.json`): the regen picks up
  `socket_path` on the document envelope (null on a polling-only host),
  the two live builtin types (`ymd`/`ytxt`, hints
  `markdown.crdt`/`text.crdt`), and `error.400.docs_invalid_crdt_payload`
  (85 codes, en/ru/es). Manifest range becomes `>=0.7 <0.8`.
- **`useDocStream(documentId)`** in the main entry — wire-level only, no
  CRDT library: resolves `socket_path` off the document row, consumes the
  resumable stream through `@stapel/realtime` (NEW required peer,
  `>=0.1.1` — the fleet's one socket runtime; the main entry stays inside
  its 12 KB budget), and hands out ordered `{seq, update(base64),
  authorId, clientId}` events plus a resync signal. When the row says
  null, no `<RealtimeProvider>` is mounted, or the socket closes with a
  verdict, the same events flow from the `useDocUpdates` poll at
  `fallbackRefetchInterval` — taken up at the cursor the socket got to,
  never from zero.
- **NEW subpath `./editors/collab`** (optional peers `yjs` >=13.6 and
  `y-codemirror.next` >=0.3, dynamic `import()`, own 9 KB budget): a
  framework-free Y.Doc session (hydrate from the binary `/content` state;
  origin-tagged remote application so nothing echoes back; debounced
  `POST /updates` batches under `client_id`/`client_seq` — a failed batch
  retries AS-IS under its own seq; resync MERGES the fresh state into the
  live doc, so unsent local edits survive and flush) and
  `registerCollabDocEditors()` — CodeMirror 6 + `yCollab` bound to the
  `"content"` Y.Text for both live hints, no awareness (0.7.0 ships no
  transport; stated, not faked). With the peers absent the surface stays
  read-only — no textarea fallback, because a snapshot save over a crdt
  body is refused by the write door.
- **`CRDT_DOCUMENT_TYPES`** — the `ymd`/`ytxt` picker options, exported
  but NOT folded into `DEFAULT_DOCUMENT_TYPES`: the server registers the
  live types only with the `[crdt]` extra installed and still publishes
  no `/types` listing to ask.
