---
"@stapel/search-react": minor
---

Three fixes from the desktop reference walk, pass 12 (D343, D344, D346).

**A value equal to its default no longer rides along in the address.** The
codec wrote `type`, `sort` and `limit` unconditionally whenever the state
carried them, so `?type=listing` sat on every single link a catalogue with
one doc type ever produced. `writeSearchState` now takes an optional fourth
argument, `{ defaultType, defaultSort, defaultLimit }`, and omits each
parameter that equals its default; `SearchStateProvider` passes its own
parse options through automatically. Reading is unaffected — the same
default fills the gap whether or not the parameter is there — so the round
trip stays exact and a caller that never passes the new argument sees no
change.

**Back now unwinds a filter, a range and a partition one press at a time.**
`goToAnchor` pushed a history entry for a keyset page move, so Back paged
backwards through the results forever instead of leaving them where the
visitor actually started paging. The push/replace choice on every mutator
is now stated once, as a table (`DEFAULT_HISTORY_MODE`, exported with its
`SearchHistoryKind`/`HistoryMode` types): a facet value, a range, a
partition/category and geo push; the search box, a page-size change and a
keyset page move replace. `goToAnchor` follows it like everything else, so
paging no longer pushes.

**`<OtherCategoriesLine>` rows can be real links.** Every entry was a
`<button>` with no `href` — no address to hover, no "open in a new tab",
nothing a crawler could follow. The new `categoryHref?: (category: string)
=> string | undefined` prop (threaded through `<SearchResultsPane>` and
`<SearchPage>`) resolves an id path to a host address; a row it names
becomes a real `<a href>` whose plain click still narrows the search in
place (a full navigation would answer a different query than the one the
count was counted for) while a modified click is left to the browser. A row
`categoryHref` returns nothing for keeps today's in-app-only button, and
whether a row is drawn at all still depends only on `categoryName`, exactly
as before.
