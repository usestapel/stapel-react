---
"@stapel/search-react": minor
---

The SERP stops being a dead end: empty sections are offered, an empty result has exits, and a category chip never prints a database id.

Four defects, all measured on a live board at full catalogue scale (3583 categories, 3036 leaves, ~100 listings), all of them the same shape — a surface deleting or degrading the thing a person came for, at exactly the moment the catalogue was thinnest.

**`offerableCategories` no longer drops a zero-count category.** The reasoning it was written on — an empty section is a dead end dressed as a destination — holds for a stocked board and inverts on a young one. With 2924 of 2924 leaves empty, the filter deleted the answer: typing a word with six real sections behind it produced NO PANEL AT ALL, and so did two other everyday words. The type-ahead was telling a person that sections of the catalogue do not exist, about sections that do. The server already ranks stocked destinations above empty ones (`stapel-search` 0.8: stock, then match quality, then count) and every row carries its own count, so an empty section now appears, below the stocked ones, saying honestly that it holds nothing. This side keeps the server's order and no longer re-sorts.

**A category chip never prints a raw id.** `categoryLeaf` returns `undefined` for a path segment that is a bare number, and the chip falls back to the filter's own name. A board whose `category=` carries database ids drew a green pill reading «165», then «163», then «1142», permanently, on every SERP. A slug is a half-answer worth printing; an id names nothing a person could have typed. A host that resolves the real name still passes `categoryLabel` and always wins.

**A barren result no longer leaves the feed's own fields as the whole filter row.** When the server counted a plan (`facet_meta.counted`) over a candidate set of zero (`facet_meta.candidates`), every counted facet is empty and drops out on its own — and the only chips left standing are the ones that never needed a count: the category's numeric attributes, drawn from the schema alone. On a cars leaf inside a radius that held no cars, that row read "Price / Colour / Availability / Steering side / Year / VIN / Dealer offer ×9": the make and the model gone because they had nothing to count, a body number and nine dealer promotions in their place. An unapplied numeric axis over an empty set narrows nothing that is not already nothing, so it is dropped; an APPLIED one always stays, because a constraint keeps the control that removes it.

**`<EmptyExits>`: an empty result now has a way out.** "Nothing matches this search" was the terminal state of the whole catalogue — no way up, no siblings, no wider radius, no way to drop the constraint that caused it. Rendered inside the empty state of `<SearchResultsPane>` (and so of `<SearchPage>`), it offers only exits it can DERIVE from state the pair already owns, each removing exactly one constraint: go up a level (drop the last segment of `category=`), widen the radius ×4, search anywhere, drop one named applied filter or range, clear everything. A search with nothing to widen renders no exits at all rather than a row of buttons that change nothing.

Sibling sections with their counts — the exit a buyer most wants — is a SLOT (`renderEmptyExits` on `<SearchPage>` and `<SearchResultsPane>`), for the reason `breadcrumb` is one: walking the tree belongs to `categories-react`. `<SearchResultsPane>` also takes `categoryFeatures` now, used only to name an applied filter in an exit the way its own chip names it.

New i18n keys in all three bundles: `search.empty.exits_title`, `search.empty.up_a_level`, `search.empty.widen_radius`, `search.empty.anywhere`, `search.empty.drop_filter`.
