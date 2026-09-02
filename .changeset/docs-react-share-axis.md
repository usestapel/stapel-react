---
"@stapel/docs-react": minor
---

The share axis, against stapel-docs 0.6.1 — access grants, bearer links, and
the bearer's own read.

The contract pin moves 0.5.0 → 0.6.1 and both halves of the pair regenerate
from it: 35 → 44 operations in `src/api/generated/schema.ts`, 77 → 84 error
codes in the en/ru/es bundles. 0.6.1 rather than 0.6.0 deliberately — 0.6.0
shipped the mechanism with `authorize()` called without the document at every
document-scoped view, so a whitelist grantee was refused by every URL that
would have honoured the grant. A pair built against 0.6.0 would have drawn a
share sheet whose grants did nothing.

**The client.** Nine operations: `GET`/`POST /documents/<id>/access` +
`DELETE …/access/<id>` (whitelist grants — one subject, one level, upsert on
repeat), `GET`/`POST /documents/<id>/links` + `DELETE …/links/<id>` (bearer
links), and `GET /shared/<token>` + `/content` + `/download`. The bearer's
body read joins the raw-bytes surface in `api/content.ts`, because it carries
`X-Docs-Head-Seq` like every other content read and a JSON client cannot
surface a header.

**Hooks.** `useDocumentAccess` / `useDocumentLinks` / `useSharedDocument` /
`useSharedDocumentContent`, and `useGrantAccess` / `useRevokeAccess` /
`useMintShareLink` / `useRevokeShareLink` / `useSharedDownloadUrl`. The share
writes invalidate ONE listing, never the module root every other write in this
pair drops: granting access moves no document, and dropping the root would
refetch the whole file manager sitting behind the sheet.

**`<ShareSheet>`** composes the two halves into one bag, and two of its
properties are the point rather than an implementation detail:

- **The capability IS the 403.** Both listings are themselves gated
  (`docs.share.whitelist` / `docs.share.link` — the whitelist listing names
  other people, and the link listing carries live tokens), so a refusal to
  list is the honest "you may not administer this". There is no capabilities
  endpoint and `DocumentPresenterDTO` carries no "can share" flag; the pair
  checked the 0.6.1 schema rather than inventing a second source.
- **A suspended row is shown, never filtered.** The kill switch is a display
  state: an operator who cannot see an inert grant believes it was revoked,
  and re-enabling the mode then restores access nobody expected.

The four share 400s are surfaced by name (`DOCS_SHARE_ERROR_CODES`, typed
against the generated registry so a backend rename stops the build), because
each names a different remedy: a mode nobody in the sheet can switch on, a
level to retry one step lower, a form that sent both subject fields or
neither, and a reference kind this host registered no resolver for.

**HONEST GAP.** `SHARING.LINK.MAX_LEVEL` is published by no endpoint in 0.6.1
and the document envelope does not carry it, so the level ceiling cannot be
known before a mint. `ShareSheetBag.levelRefused` reports the backend's
refusal instead; a client-side cap invented from nothing would be a second
answer to an authorization question, which is how a share mode ships
half-enforced. Recorded for the backend rather than guessed at here.

**`<SharedDocumentView>`** is the seam for the bearer route, not the route:
the stripped envelope (no workspace, no folder, no owner, no star, no
revisions), the level the link carries, `readOnly` as a structural fact rather
than a guess, and one honest sentence for a dead token — expired, revoked and
never-existed all answer 404 on purpose, so that the endpoint is not an oracle
for guessing tokens. The one refusal that names a remedy,
`error.401.docs_share_auth_required`, is told apart from it and is keyed on
the CODE, never on a bare 401, which is the session layer's business.

The bearer PAGE, and the product share sheet, are somebody else's:
`@stapel/drive-react/default` draws the sheet, and the page's URL shape and
chrome are host composition. This pair ships no share skin — a second
implementation of a surface that already exists is the integration-seam defect
the drive package was designed to avoid.

Two demos (the sheet, the bearer view) and 22 tests, including the two
properties a re-skin can silently lose: a mint refreshes its listing, and a
suspended row still renders. en/ru/es copy for all of it.
