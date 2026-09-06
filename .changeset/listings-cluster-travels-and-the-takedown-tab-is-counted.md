---
"@stapel/listings-react": minor
---

**The reader's cluster can be in two places, and is one thing.**
`<ListingDetailPane actionsPlacement>` now takes a LIST (`["header", "bar"]`)
and a new `renderActionsBar` render prop is handed the cluster's MOUNT POINT,
not a copy of it: `<ListingActions>` is rendered once through a portal whose
container is moved between the two slots as a DOM node, so the component mounts
once, holds one `useFavoriteToggle`, and is literally the same element in both
placements. A container that wanted the two verbs beside the title AND in a
condensed top bar had to mount a second `<ListingActions>` of its own — two
hearts agreeing only after a refetch, and its own test ids so the pane's
`listings-detail-reader-actions` stayed single for anything counting it. That
second mount can go. Returning `null` from `renderActionsBar` hands the cluster
back home mid-write; asking for `"bar"` without the render prop changes
nothing at all, as does every existing single-placement mount.

**And `onTitleVisible` says when to ask for it.** An `IntersectionObserver` on
the pane's own title — never a scroll listener — reporting each crossing. The
same container watched that heading through the pane's published `data-testid`
and a `MutationObserver` (the title lands with the listing, not with the first
frame) for a boolean the pane already knew. Nothing is reported in an
environment with no `IntersectionObserver`: "this page cannot tell" is an
answer, and a fabricated `true` would wedge a host's bar open on the one arm
with no scrolling to close it.

**The gallery's shape is the host's, and saying so costs no `!important`.**
`<ListingDetailPane galleryLayout>` takes `"grid"` (default, the
element-width grid this pane has always drawn) or `"strip"` — a snap-scrolling
horizontal strip, one photograph visible with the next peeking. On a 390px
phone the grid resolves to ONE column, so a listing with three pictures pushes
its own title and price nearly three screens down. The pane also stops writing
`display` and the track INLINE: they are on `LISTINGS_GALLERY_CLASS` plus a
`data-gallery-layout` attribute now (`detailGalleryCss()`, exported), so a host
that wants a third shape at its own breakpoints needs a selector rather than
`!important` over a pair's own geometry. A live storefront was carrying exactly
that `!important`. What stays inline is what nobody overrides: the page's
responsive gutter (D418) and the `position: relative` the
`actionsPlacement="gallery"` overlay is pinned to.

**The takedown tab draws the SERVER's number (D407, second half).** Pinned to
stapel-listings **v0.22.4**, which adds `MyCountersResponse.blocked` beside
`active` / `archived` / `drafts`. The fourth tab was counted from its own
unpaged `?status=blocked` page — right up to a page and blind past one, and
only after that page had landed. It is the counter now: the tab appears with
`my/counters`, the badge is the whole set, and the page stays what it always
was underneath, the tab's rows. A deployment on a server older than 0.22.4
sends no `blocked` and degrades to the rows' length — never to a `0`, which is
the defect wearing the new field.
