---
"@stapel/search-react": minor
---

On a phone the buyer's dictionary filter is a sheet, the same gesture the
seller's vocabulary picker already was.

Mobile pass 12 measured both halves of one product on one screen: the
composer's `ref_select` editor is a trigger row that opens a sheet with a
search box, a recommended band and «All values» — zero checkboxes — while the
filter panel drew the SAME axis as a wall of 8 → 38 checkboxes over a "Find a
value" box, with no way to say "any". One dictionary, two gestures, depending
on which half of the product you were in.

`<FacetGroupControl dictionaryMode="sheet">` is the third mode, and
`<SearchPage>`/`<FacetPanelPane>` make it the default for the phone filter
sheet (the desktop `"field"` is unchanged; `"inline"` stays for a surface
already devoted to one group, such as the per-chip sheet). The closed row
reads *Any* or the chosen values with their count; it opens the shared
`SkinPickerSheet` — the very component the composer's picker draws, so the
search box, the checkmarks, the commit above the home indicator and the
swipe/Esc/back dismissal are inherited rather than re-derived — holding a
**Recommended** band (the busiest values by count, capped at
`FACET_VISIBLE_OPTIONS`, with anything chosen in front of it, so a cold
chosen value is never out of reach of its own off-switch), **All values** (the
rest alphabetically, `FACET_SHEET_PAGE` = 50 at a time as the list is
scrolled) and one **Done** that writes the whole draft. The box filters
locally and across alphabets (`translitPrefixMatch`, the desktop field's own
matcher); typing collapses the two bands into one, because a *Recommended*
heading over rows that answer a query is a lie about which rows those are.

The commit needed a bulk write: `toggle` reads the state it flips, so a draft
of several ticks applied through it would collapse into the last tick.
`useFacetPanel` gains `setValues(slug, values)` — one URL write per commit —
and `<FacetGroupControl onSetValues>` is the seam that carries it; without one
the sheet mode falls back to the desktop field rather than committing
something it cannot apply.

New i18n keys in every catalogue (en/ru/es):
`search.facets.dictionary_recommended`, `search.facets.dictionary_all_values`,
`search.facets.dictionary_done`.
