---
"@stapel/drive-react": minor
---

The share sheet — the surface 0.1.0 deliberately left a clean seam for.

0.1.0's note said share-sheet surfaces would land once stapel-docs implemented
the sharing mechanism, and that the seams were left clean for them: a slot, an
export, a nav entry that does not move. That is exactly what this is. The
contract pin moves to stapel-docs 0.6.1 (35 → 44 operations, 77 → 84 error
codes), the peer floor on `@stapel/docs-react` rises to `>=0.7.0`, and nothing
in the nav or the screen's shape changed.

`ShareSheetPanel` is the skin half of `@stapel/docs-react`'s headless
`ShareSheet`, exactly as `UploadTrayPanel` is the skin half of `UploadTray`,
reached from a row's Share action. Two sections, because stapel-docs has two
INDEPENDENT grant sources and a deployment may enable either, both or neither:

- **Links** — mint a bearer link at a level, copy the URL, see the date it
  stops working and whether anybody has opened it yet (stamped once: evidence
  somebody got in, not a counter), revoke it behind a confirmation, because a
  revoke is terminal and a revoked link never revives.
- **People** — grant to a user id or to a resolver-backed group reference, at
  a level, removable. The wire NAMES the subject kind rather than inferring it
  from which field is filled: an ACL write that guesses its own meaning is one
  typo away from granting to somebody nobody named.

Every read and every write is the docs pair's. Nothing of the axis is
re-implemented here — the same rule that made 0.1.0's trash tab a thin wrapper
over that pair's `TrashPane`.

**Three properties this drawing is responsible for.**

1. A switched-off mode's rows stay VISIBLE, tagged "Paused", under a banner
   saying they were not revoked. The kill switch is a display state, not a
   filter: an admin who cannot see an inert grant believes the access was
   taken away, and re-enabling the mode then restores access nobody expected.
2. A section the caller may not administer is ABSENT, not a dead form. Both
   listings are themselves the capability gates (`docs.share.whitelist` names
   other people; `docs.share.link` carries live tokens), so a 403 is the
   honest "you may not do this" — and a form whose every submit is refused is
   worse than no form. The two gates are independent, so one section can be
   live while the other is gone.
3. A refused mint says WHICH refusal it was. `SHARING.LINK.MAX_LEVEL` is
   published by no endpoint in 0.6.1 and the document envelope does not carry
   it, so the sheet cannot check the ceiling before it asks. It offers both
   levels and renders `error.400.docs_share_level`'s own sentence — the one
   that names the remedy — rather than a generic failure. A client-side cap
   invented from nothing would be a second answer to an authorization
   question.

Share is offered on a DOCUMENT and not on a folder: stapel-docs 0.6 shares a
document, and a folder has no `/access` or `/links` route at all, so the action
is absent rather than present and dead.

The sheet is a slot — `registerDriveSkinComponent("shareSheet", …)` — and
`DriveRowActions` resolves it through the registry, so a host's replacement is
used from the row action too; a slot honoured at one call site and hardcoded at
another is a slot only half the product keeps. It is the entry most likely to
be swapped after `thumbnail`: a host that resolves group references against
its own directory wants a people picker where this one takes a raw id.

There is deliberately no shared-link ROUTE here. The bearer page's URL shape
and chrome are host composition, `@stapel/docs-react`'s `SharedDocumentView` is
the seam it is built on, and the one thing this sheet needs from the host is
`shareLinkUrl` — the function that turns a token into the URL people paste.
Without it Copy copies the bare token, which is honest; assembling an origin
and a path this package cannot know would not be.

Four demos at the strict skin gate (links + people, links-only, suspended,
mint refused) and 10 tests. The default skin spent the headroom 0.1.0
earmarked for exactly this: 10.2 → 12.4 KB against a 14 KB budget that was NOT
raised. en/ru/es copy for all of it.
