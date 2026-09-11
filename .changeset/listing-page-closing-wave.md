---
"@stapel/listings-react": minor
---

The listing page gets the four things the reference has and it did not.

Four rows of the closing-wave comparison inventory, all on
`<ListingDetailPane>`, plus one verdict that is not a defect in this package.

**A condensed bar the pane draws itself.** Past the first screen the reference
classified pins back / title / heart / share to the top of a phone listing;
this pane offered `renderActionsBar` and left every container to write the
same four things. `actionsPlacement={["header", "condensed-top"]}` is the pane
drawing it — `onBack` is the arrow (absent, there is none: a listing opened in
a new tab has nowhere to go back to), the title is one ellipsised line, and
the cluster is the SAME travelling `<ListingActions>` the movable-cluster
portal already moves, so the page still mounts one `useFavoriteToggle` and one
`aria-pressed` heart. The threshold is the title leaving the fold rather than
the reference's "~160px", which is a fact about its own header height. A host
that also passes `renderActionsBar` keeps it: the specific answer beats the
default one, and two bars never stack.

**The strip says where it is.** `galleryLayout="strip"` is a native scroll
container and the page had no active-photo indicator at all (§20b: a full
slide of `scrollLeft` moved the strip and moved nothing else).
`useGalleryPosition` reads the strip's own `scroll`, throttled to one
measurement per animation frame, from live rectangles rather than
`scrollLeft / slideWidth` — and the "3 of 16" pill stands in a frame BESIDE
the strip, because an absolutely positioned child of a scroller scrolls away
with the content it is counting. Nothing here is keyed off a tap: the gesture
that changes the photograph is not one.

**Four canned questions above the contact control.** `quickQuestions` (the
pair's own four, in en/ru/es; a host's own list; `[]` to switch off, capped at
four) with `onQuickQuestion` reporting the press. The press is a callback and
not a prefilled composer on purpose: `@stapel/chat-react` 0.12.1's door takes
no initial message — `<StartDirectChat>` takes a seller and a subject,
`useStartDirectChat` posts `{userId, subject}`, `<MessageComposer>` opens on an
empty string — so a pane that claimed to seed it would be inventing a seam the
other pair does not have. Without the callback the block is not drawn, and the
owner never sees it: the owner is the person being asked.

**Two "find more" strips.** `similar` / `fromSeller` take rows and draw
`<ListingRelatedStrip>`; `renderSimilar` / `renderFromSeller` take the whole
section and are handed `{listingId, categoryId, ownerKey, axes}` to build a
query with. Two sections and not one rail, because the reference draws two and
they answer different questions. The rows come from the host's search: this
pair does not read search, and the detail wire carries a category id, not a
slug. Neither strip is drawn empty.

**And the characteristics table, which was not the bug.** The comparison
measured ~2.5× fewer fields than the reference on the same kind of listing.
Read against a live answer: the pane applies no cap and no filter beyond
dropping form `header` rows, and it counts what it cannot key
(`listings-detail-unreadable`). The shortfall is in the DATA — the listing the
comparison measured carries seven feature rows on the wire, and a
fully-filled one in the same category carries twenty-eight, all of which the
pane draws. What is added is the reference's FOLD, not rows:
`<ListingSpecList limit>` / `<ListingDetailPane characteristicsLimit>`, default
unlimited, folding only when it saves at least two rows, opening in place.

Also fixed on the way past: `useTitleVisibility` attached a fresh
`IntersectionObserver` to the heading on every render. `<Typography.Title ref>`
is antd's, which merges refs and invokes them itself, and a ref callback's
return value means nothing to a caller that is not React — so the cleanup was
dropped. Three live observers on one `<h1>` after two crossings, each
announcing the crossing again to `onTitleVisible`. The hook now holds the one
live observer by the node it watches and disconnects from an effect as well.

`test/detailCondensedBar`, `test/detailGalleryPosition`,
`test/detailQuickQuestions` and `test/detailRelated` are the four; the bar's
cluster is asserted by ELEMENT IDENTITY across the move, the gallery by a faked
strip scroll, and the observer by the count of LIVE observers after three
crossings.

The `/default` size budget is raised 31 → 33 KB (measured 31.84) — the note in
`package.json` says what was bought and what was measured against what.
