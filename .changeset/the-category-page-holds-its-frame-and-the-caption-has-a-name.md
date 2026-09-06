---
"@stapel/categories-react": minor
---

**`<CategoryPage>` holds the page it is showing until the next one is whole.**
A partition press navigates to a SIBLING: same page, same trail, same rail,
same segmented control, different rows. It changed `categoryId`, sent
`GET {id}/` and `GET {id}/children/` pending, and the page's `LoadBoundary`
swapped its subtree for a four-row skeleton — which unmounted everything the
host had rendered into `renderListings`, including the control the person had
just pressed, its focus and its scroll position, twice, out and back (D454). A
storefront worked around it by mounting these very hooks in its own container
and withholding the id from this page until both had landed: 47 lines of
container code to tell the page something the page already knew, and a second
copy of the pair's own gating rule to keep in step with it.

`useCategoryPageSource` now derives its state through core's
`useKeptLoad({ keepPrevious })`, and the landing travels INSIDE the load state
rather than beside it — the row, the level under it and its depth as one frame.
That is what makes the hold mean anything: the heading, the sub-category chrome
and the listings slot are read off ONE frame, so they can never disagree about
which category is on screen. The `renderListings` node keeps its identity
across a sibling change (asserted with a mount counter, not by looking for a
skeleton — a test that only looked would pass against a remount that happened
to be fast), and the page never draws the skeleton once it has drawn anything.

While the next frame is in flight the ready arm carries
`data-stapel-load-refreshing="true"` (`<LoadBoundary>`), so a host can dim or
announce without owning the state. A category the page has never shown still
loads with the skeleton — there is nothing behind it. A REFUSAL is never held:
the error arm and its retry replace the page, because a dead category wearing
the last live one is a dead link that looks alive. `keepPrevious={false}`
restores the previous behaviour exactly, for a host that draws its own held
frame and would otherwise hold one on top of another.

**And a tile's caption has a name.** `data-testid="categories-tile-label"` is
on the clamped `<span>` of every ordinary tile, in all three anatomies, and
`CATEGORY_TILE_LABEL_TESTID` is exported so a host does not retype the string.

The caption is FIRST inside the tile link on the regular and `size="compact"`
tiles and SECOND on `density="compact"`, whose art leads — so everything
reaching for it by position aims at the label on one surface and at the art on
the next, and reports a number either way. That is not hypothetical twice over:
it is the `span:first-child` `!important` clamp `labelLines` retired, and then
a stand probe that read `-webkit-line-clamp` off the tile LINK (`none`, on a
page where the clamp works perfectly) and counted the art box and the monogram
among the caption's three "lines". A name that is on the clamped span in every
anatomy is the difference between measuring the cap and measuring whatever was
first.

The two special tiles keep the names they already had on that same span —
`categories-tile-grid-all`, `categories-tile-grid-more` — because a test
reading the clamp off those already points at the right element, and renaming
it would move nothing and break that.
