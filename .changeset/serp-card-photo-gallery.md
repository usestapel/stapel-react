---
"@stapel/search-react": minor
---

The default SERP card draws the photos — the whole gallery, not one, and not none.

`<SearchResultCard>` read `card.image` as an object with a `url` key and fell
back to `card.image_url`. Neither is a shape this fleet emits, so **every
consumer that did not pass its own `renderCard` got a card with no photo at
all**:

- `image_url` is a convention nothing in the fleet writes. It was declared in
  `GENERIC_CARD_FIELDS`, drawn in the demos from a data URI, and never once
  served by a backend.
- `card.image` IS emitted — `stapel-classified`'s search projection stores it —
  and it is a plain `<type>/<hash>` CDN reference **string**, not an object.
- the one rich shape that exists (chat's subject card, which serves the same
  CDN render descriptor its attachments carry) has `ref` + `variants[]` and no
  top-level `url`, so the `"url" in rich` guard rejected it too.

**What the card reads now** (`default/cardPhotos.ts`, unit-tested as data):
`images[]` first — the whole seller-ordered gallery `stapel-classified` 0.7.0
projects, capped by its `CARD_IMAGES_LIMIT` — with the singular `image` as the
fallback for a doc type that never grew a list. Never both: `image` IS
`images[0]`, so reading the singular after the list would draw the first photo
twice. Each entry may be a CDN reference, a URL the doc type stored itself (a
reference is `<type>/<hash>`: no scheme, no leading slash, so the two are told
apart by shape and never by a guess), or a render descriptor, whose whole
variant ladder survives so `<Image>` still has tiers to choose between.

**How a reference becomes a picture: a new `resolveImage` seam** on
`createSearchRuntime`, the same seam `@stapel/listings-react` states and the
same function a container passes to both. No contract in this fleet resolves a
stranger's reference — stapel-cdn's `file/exists/` is owner-scoped — so the
deployment hands its own knowledge in once rather than having a library invent
a URL convention nobody agreed to.

**A gallery is a strip.** Two or more photos render as a `<SkinCarousel>` with
the peek and the position indicator (one photo gets neither: a sliver of a next
slide is an affordance for something that is not there). The strip is a
**sibling** of the card's anchor, never a child — a horizontal swipe that ends
inside an `<a>` can be delivered as a click, which is the defect that makes
phone galleries unusable.

**Three honest answers about a photo, drawn as three different things.** A card
with no photo field reserves nothing (a text corpus is not a gallery with holes
in it); a card whose references nothing resolved draws the well and *says* the
photo is unavailable — that is what an unwired `resolveImage` looks like, and a
sentence gets it fixed where an empty grey box does not; anything else is the
strip.

BREAKING for a host that stored `card.image_url`: that field is no longer read
(nothing in the fleet wrote it). Store the URL in `image`/`images` instead — a
stored URL still needs no resolver.

New i18n keys in all three bundles: `search.results.photos`,
`search.results.photo_alt`, `search.results.photo_unavailable`.
