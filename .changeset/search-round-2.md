---
"@stapel/search-react": minor
---

search: the rail is the category's own form, and the axes a seller had to fill are the ones a buyer sees first

A walk of a live classified's desktop cars page reported three things in one
breath, and they turned out to be four faults with one shape: the panel was
answering questions the *answer* had asked, not the ones the *category* asks.

**The rail is in SCHEMA order, required first.** It ranked by evidence — the
sum of an axis's counts — which is the right question for a phone chip row
with room for four and the wrong one for the column a person narrows a
catalogue in. On three listings the busiest axis is whichever three values
happen to be counted, so the rail opened on condition and colour while the
make, the model and the year — the three fields the category marks `mandatory`,
i.e. the three every seller had to fill — sat below them. `orderFacetGroupsBySchema`
puts pinned slugs first, then the required features in the schema's own order,
then the rest in schema order, then what the schema does not name at all in
evidence order, because with no schema there is no other order to have. Stable
under a click, which a rail that reshuffles as you tick is not. Past
`visibleGroups` (default 8) the tail folds under one **All filters (K)**
control — never a group you have already chosen a value in, because the control
that removes a filter is the one you came back for. `<SearchPage>` gains
`partition` (drawn above the price: which half of one template a page is about
is not a filter among filters) and `pinnedFacets`.

**Why the make could vanish.** `facetGroupIsDrawable` is now the one predicate
the rail and the chip row share, and it says what the old duplicated
`options.length > 0` said without saying WHY: a group with nothing under it is
a heading over nothing. The catalogue's `make`, `model`, `generation` and
`body_type` are `ref_select` features whose config is a bare `optionsRef`
pointer — no option table in the schema and there never will be — so the moment
the server's plan does not count one, there is nothing on either side to
enumerate and the group leaves the page, while every `select`-typed comfort
option (steering side, power steering, heating) draws its own schema table and
stays. That is the exact set the walker saw and did not see. The drop is still
right — a dead heading helps nobody — and it is no longer SILENT: outside
production one `console.warn` names the axis, says which side is missing
(uncounted, or a schema that does not define it), and says when the schema
calls the axis **required**. Both owners of that wiring fault can now see it
from the page. The regression is pinned against the live answer itself, saved
as a fixture (`test/liveCars.ts`, captured 2026-09-04): an axis with evidence
buckets survives the parent node's EMPTY feature list and a def that names it
without typing it.

**A dictionary outranks the pills, and on desktop it is a FIELD.** The live
make axis is `maxSelected: 1` over a 418-value vocabulary, so "pick one" won
the shape contest and the control it produced was four hundred pills in a 280px
rail — a wall with a different border radius. `facetGroupShape` now asks
"dictionary?" before "single-choice?". And on the rail
(`dictionaryMode="field"`, which `<SearchPage>` sets for the column layout) a
dictionary closes into a select-style field reading its chosen values or *Any*,
which opens the searchable list you already had: a real `role="combobox"`
button, ArrowDown to open, Escape to close. The phone sheet keeps the list
inline — the sheet is already the disclosure.

**A bounded integer is a picker, not a bare number.** The year was two empty
number fields; it is `int` with `min: 1900, max: 2027`, which is 128 values and
therefore a list. `RangeGroup.picker` carries it (newest first — a year picker
that opens on 1900 is a picker nobody uses) for any `int` feature whose schema
declares both bounds and spans at most `RANGE_PICKER_MAX_VALUES` (300), and
`<RangeFilterRow>` draws two from/to selects. Typing still works and carries
the bounds: a valid in-range number narrows the list, anything else brings the
whole list back with the bounds said in words, because a year below the
catalogue's floor otherwise does nothing at all, silently. A mileage
(`1..1000000`) and the core price stay two typed fields.

**The rail's scrollbar is in the gutter, not on the filters.**
`scrollbar-width: thin` and `scrollbar-gutter: stable` are the standard half
and they are not enough: on every overlay-scrollbar platform — a Mac by
default, every iOS browser — the bar is painted OVER the content and the gutter
reserves nothing, which is why it lay across the checkbox labels. The rail now
also declares a classic bar through the WebKit pseudo-elements, with a real
width so it displaces rather than overlaps, and every colour a `--stapel-*`
custom property so it is the panel's own hairline in both themes rather than a
grey that glows in the dark one. `railScrollbarCss()` and `RAIL_CLASS` are
exported for a host that lays out its own column.

**`<PartitionChips variant="segmented">`** is the desktop rail's shape of the
same choice: one joined control under its own label instead of a wrapping pill
row, which in a 280px column is two ragged lines. The SEMANTICS do not vary
with the variant — the same `radiogroup`, the same roving tabindex, the same
arrow keys — because a segmented look is a border-radius decision, and swapping
in a component that draws joined cells by giving up "exactly one of these is
true" would trade the accessible half of the control for the visible half.

Also: `FacetLabels.label_translatable` is typed. The live answer sends it
beside every group label and the pinned `schema.json` does not describe it, so
a fixture captured from the wire was a type error.
