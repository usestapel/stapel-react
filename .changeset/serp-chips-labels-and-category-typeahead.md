---
"@stapel/search-react": minor
---

The result list gets a chip row a person can use, chips that print copy, a
category narrowing, and a search box that can reach a category.

**A facet a person cannot filter by is not a chip.** `FACETABLE_FEATURE_TYPES`
/ `isFacetableFeature` decide from the category's own schema — the select
family, `bool`, and `attributes-react`'s own `VOCABULARY_BACKED_TYPES`,
imported rather than retyped. `imei` and `video_file_url` leave both the chip
row and the panel. Two edges are held on purpose: a group with NO feature def
is KEPT (the schema slot is optional, and treating silence as "not facetable"
would empty the row for every host that never threaded it), and a slug the URL
already filters on is kept whatever its type, or a shared link would narrow a
search with nothing on screen to widen it again.

**The row's leading edge is the filters people use.** `orderChipFilters` sorts
applied-first, then by band: core ranges (`facet_meta.core_ranges`), then
counted facet groups, then the category's numeric attributes. A live
classified deployment led with battery health and four delivery dimensions;
it now leads with category, price, condition and brand. Nothing is deleted —
`facet_meta.skipped` means the counter hit its field cap, not that the axis
is unfilterable, and `r.<slug>` still answers for a skipped slug, so removing
one on that signal would delete a working filter on a capacity report.

**A chip prints copy, not a storage slug.** Precedence, now answer-first:
`facet_labels` (the server saw the write-time snapshot) → the def's inline
`options` → the host's `resolveFacetLabels` → the raw value. The host seam is
batched per group through `useQueries`, cached, deduplicated across the three
components that read the panel, and given the query's own `AbortSignal`; it is
asked only about values nothing else named and cannot overwrite one that was.
A value nothing resolves keeps printing itself — a chip that silently drops an
option is worse than one showing a slug.

**A category narrowing on the row.** `renderCategoryFilter` and the new
`categoryLabel` reach `<FilterChips>` as the LEADING chip, opening the same
sheet every other chip does. There is no category facet on any server and the
index has no read path for one, so nothing here synthesizes counts. `hasChips`
now renders a row holding only the category chip and still renders nothing for
a row holding only the sliders circle.

**The search box offers CATEGORIES.** stapel-search 0.7.0's `/suggest` answers
a destination per row — the full ancestor path, the live count behind it, and
a `category` string to pass verbatim to `/query`. `useSearchBox` surfaces
`categories`, `categoriesUnavailable`, `categoryCountsUnknown` and
`chooseCategory`, and `<SearchBox>` draws them as a labelled group above the
term suggestions, each row printing the whole trail (which is what tells three
same-named leaves apart) and its counted sentence. Choosing one clears the
query text: keeping it would land the person on that section intersected with
a title search for the word that found it, which is fewer results than the
number they just tapped. A zero-count row is dropped — an empty section is a
dead end dressed as a destination — except under `category_rollup`, where the
zeroes mean the ancestry never arrived and it is the NUMBERS that are omitted.
`SuggestAnswer` deliberately widens the generated response type, whose fields
are all required: a pair typed against it would compile while reading
`undefined` from a field the compiler swore was there. An older server that
sends no `categories` key, and one that reports `category_suggestions` in
`degraded`, both draw no group at all — never an empty one, and nothing
anywhere says the catalogue has no matches.

**Nav labels.** `search.results` stopped borrowing `search.results.title` from
the results heading: one key was carrying the name of a DESTINATION and the
name of a LIST, and they diverge the moment the destination is a tab.
`search.nav.results` / `search.nav.ranking` are the nav's own, and the
disclosure entry declares a `shortLabelKey` for a phone dock.
