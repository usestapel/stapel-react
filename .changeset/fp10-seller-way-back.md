---
"@stapel/listings-react": minor
---

The seller's board is a door in both directions, and every button on it does something

`MyListingCard.available_transitions` (stapel-listings 0.20.0) is the third
axis — `status` says where a listing IS, `moderation_status` says what is
being waited on, and neither answers *what can I do about it*. The dashboard
was re-deriving that from a local copy of the state table, and got it wrong in
both directions at once on a live board:

- **Two of the four buttons on an archived row did nothing.** `canTransition`
  answers `true` for a same-status move — correctly, since the server returns
  early on one — so a SOLD row offered "Mark sold" and an ARCHIVED row offered
  "Archive", both enabled, both clickable, both inert.
- **There was no way back.** `archive` and `complete` were the whole owner API
  and both are exits, so a seller who marked something sold by a misclick had
  `DELETE` and nothing else. The edges that undo it — SOLD or PAUSED to
  PUBLISHED, ARCHIVED to DRAFT, EXPIRED renewed — were in the machine the
  whole time with no route.

Now: `POST listings/{id}/transition/` on `ListingsApi`, `useTransitionListing`,
`OWNER_TRANSITIONS`/`ownerMoves` as the fallback mirror for a surface that
holds a bare status, and `ListingActionsBag.moves` — the moves the server
declared, in a stable drawing order, and nothing else. A control that would be
a no-op is not rendered rather than rendered switched off, because "you cannot
do the thing you already did" is not a refusal worth a sentence.

Also here, all measured on the same live board:

- **`listingHref` / `linkComponent` on `<MyListingsPane>`** — the cabinet held
  ZERO links to a listing, so the one move a seller makes after publishing
  ("did that come out right?") needed a hand-typed URL. A row nobody has ever
  published gets no link: the predicate is the server's own (DRAFT plus
  NOT_SUBMITTED), because a never-published row's public page is a blank one.
- **A fresh draft is no longer announced as REJECTED.** `moderationNotice`'s
  last branch was an unlabelled fallthrough onto "rejected", so 0.20.0's new
  default `not_submitted` made every newly created draft read "A moderator
  turned this listing down" to somebody who had submitted nothing. Unknown
  verdicts now degrade to silence; `not_submitted` says nothing, because the
  lifecycle already says "Draft".
- **The refusal stops quoting the wire.** "A listing in status 'draft' cannot
  be moved that way" was printed beside a status tag that said "Draft" in the
  reader's own words two lines above.
- **The row fits a phone.** Every action is `layout="inline"` except Delete,
  which carries a standing sentence, and the whole list sits in one
  `<PaneGate>` so a refusal is printed once instead of once per row: a
  published row measured 495px of an 844px screen and now measures 376.
- **The card's photo is cut to the card's own corner** (`--listing-card-radius`
  on the media well, square slides inside it), the place line is ONE line that
  truncates — a two-part district name wrapped and left a row of tiles 24px
  ragged — and the card answers a PRESS, not only a hover, on all three
  surfaces: the phone this is used on reports `(hover: hover)` false, so
  `:active` was the only feedback a finger could ever get. The hover rule is
  now inside `@media (hover: hover)`, where it cannot latch after a tap.

Contract pin moves to stapel-listings v0.21.0 (`available_transitions`, the
transition route, `ModerationStatus.NOT_SUBMITTED`, and the public card's
coarsened coordinates — `geo_precision_km` is optional on the card prop for
the same reason the engagement fields are: the search document does not carry
it).
