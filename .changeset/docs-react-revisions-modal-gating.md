---
"@stapel/docs-react": patch
---

A closed `<RevisionsModal/>` costs nothing.

The modal read `GET /documents/:id` and its revision list the moment it was
MOUNTED rather than the moment it was opened, so a host that mounts it once
beside a row — the obvious composition, and the one `SkinDialog`'s own API
invites — paid two requests per row for a dialog nobody had opened.
`@stapel/drive-react` 0.5.1 worked around it at its call site by mounting the
modal only on tap; the fix belongs here, where every other caller inherits it.

- `useDocument(id, { enabled })` and `useRevisions(id, { enabled })` join the
  options-bag convention `useDocumentAccess` / `useDocumentLinks` /
  `useDownloadUrl` already follow. Default `true` — a caller that says nothing
  keeps the old behavior.
- `<RevisionHistory enabled={…}>` forwards it, so the headless bag is holdable
  too. The WRITES are untouched: a mutation only fires when something calls it.
- `<RevisionsModal/>` gates both reads on its own `open` prop.

Pinned by a test that asserts zero requests while closed and reads resuming on
open. The `index` size budget moves 12 -> 12.5 KB for the two options bags
(12004 B against a 12000 B line): a budget that fails on 4 B of a shipped fix
is a gate proving nothing.
