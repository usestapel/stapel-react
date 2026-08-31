---
"@stapel/core": minor
"@stapel/shell-react": minor
"@stapel/search-react": minor
"@stapel/listings-react": minor
"@stapel/tokens-antd": minor
"@stapel/categories-react": minor
"@stapel/calendar-react": patch
---

The phone dock stops truncating its labels, stops covering the footer, and the
phone SERP gets a one-line toolbar instead of four stacked rows.

**A compact label for a compact chrome.** `NavEntry.shortLabelKey` (core) is an
optional second i18n key a manifest declares when its menu label cannot fit a
dock cell. A five-item dock at 390px gives each destination about ten
characters, and a label written for a menu row ellipsizes mid-word — a
destination a person has to guess at, which is the one thing a dock must not
produce. A key and not a length hint, because which words survive the cut is a
translator's judgement: the useful short form of "Post a listing" is the verb,
of "My listings" the noun, and no truncation rule finds either. `resolveNav`
carries it through, `<NavDock>` prints it and keeps the LONG label as the
link's accessible name; `listings-react` declares one for `compose` and `mine`.
The dock also drops its inter-cell gap and one inset step — 24px given back to
five labels — and `scripts/gen-nav-manifest.mjs` validates the new field.

**The clearance belongs to the page, not the content.** The island is fixed
over the last thing on the page, and the last thing is the footer. Reserving
`DOCK_CLEARANCE` on `<Layout.Content>` cleared the final card and left the
footer's legal links permanently under the island. `<PublicShell>` reserves it
on the page column instead, and only when `dockRenders(nav)` says an island
will actually be drawn — a one-entry nav used to get a strip of empty page
under a dock nobody rendered.

**A phone toolbar that is one row.** `<SearchResultsPane header="compact">`
gives the toolbar its own line and puts the count directly above the cards as
their caption, with the heading visually hidden but still in the document
outline; the banner shape (heading | count + toolbar) is unchanged and
remains the default. `<SortSelect compact>` drops the caption and the 200px
floor so the control shares a row, and moves the blocked `distance` option's
REASON into the option's own label — on a phone, where that refusal is most
common, a separate reason row costs a band of viewport above the first result.
`<FilterChips>` takes `geoChip={false}` for a surface that already states the
location above it (the phone SERP mounts `<LocationSummaryLine>`, and the two
together asked about one filter twice), and renders NOTHING when it would be a
row of one button — a free-text query has no category, so the server returns no
facet plan, and the row was a lone circle floating between two working filter
affordances. `<LocationSummaryLine>` says "Filters", not "All filters": that
end of the row shares 390px with a place name.

**Tiles say which category they are.** `<CategoryTileGrid>` draws the
category's own initial where art is missing, instead of a muted disc. A live
catalogue put nine identical grey discs on one landing — every category there
carries an empty `carousel_icon`, which is the state every catalogue is in
until somebody uploads art — and a grid of them reads as nine images still
loading. A letter cannot be mistaken for a pending image, and every tile
differs from every other.

**`visuallyHidden`** (tokens-antd `/skin`) is the fleet's one off-screen-but-
announced style. It was written twice before, in `calendar-react` and
`search-react`, and the two disagreed on `clip-path` versus the deprecated
`clip`; both now import it.
