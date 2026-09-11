---
"@stapel/search-react": minor
---

The feed pins its sort row, and a colour facet shows the colour.

Five rows of the closing-wave comparison inventory, all on the results feed
and the filter rail. Two of them are code; three are verdicts, and two of
those say the gap is in the DATA rather than in this package.

**The results toolbar pins itself.** `<SearchPage toolbarSticky>`, default
`true`. The reference pins its sort bar to the top of the window once a reader
has scrolled into the results (REPORT §24, Surface 2); this pair already had
the mechanism — `stickyToolbar`, shipped a release ago — and not one
deployment had turned it on, which is a feature nobody has. The default pins
at `railTop`: the filter rail's sticky top edge and the toolbar's are the same
edge (the foot of whatever chrome the host pinned above the page), so there is
one number and no second one to keep in step. It is a hoisted
`@media (pointer: fine)` rule set (`toolbarStickyCss`, the offset arriving per
instance through `--stapel-search-toolbar-top`) rather than an inline style,
for the one reason a sheet is ever right here: the pin has to be gated on a
pointer and a media query cannot be written in a `style` attribute. A phone
therefore keeps its toolbar in flow — a bar standing over a 390px viewport
spends the fold on chrome the reader did not ask for. The row now also states
its own box from the first frame (`toolbarRowMinHeight(token.controlHeight)`,
the discipline `chipRowMinHeight` is written under), so nothing in the feed can
move when the rule engages. `stickyToolbar` still wins where a host passes it —
it pins on every pointer, at its own offset — so one row can never carry two
pins; `toolbarSticky={false}` leaves it exactly where it stood.

**A colour facet draws the colour.** The reference's colour group shows a
filled dot beside every value and ours showed the word alone
(deep/elektronika-telefony.md §3) — on the one attribute whose label is
strictly worse than the thing itself. Two questions, each answered
conservatively, because both mistakes are visible on a shopper's screen.
`isColorAxis` recognises the axis from the slug's HEAD segment with the
control-type tail stripped (the live phones leaf maps its colour to
`color_ref_select` and publishes it as `color`; `colorado_region` is a place),
from the address key beside it, and from `axis_role` the day the canon grows a
colour one. `swatchColor` paints a value only where its code IS a colour by a
name that resolves — a design-system colour role first (§68: one neutral
vocabulary of roles, resolved at paint time, so it follows the brand and the
dark side), then CSS's own colour keywords, then a hex code a catalogue spelled
out itself — and returns nothing otherwise, in which case the row draws no dot
at all. A grey placeholder beside a value nobody named a colour for would say
"this one is grey".

**Three verdicts, recorded rather than patched.**

*The condition scale is the catalogue's, not this pair's.* The census reads a
5-point condition scale on the reference's phones and a binary on ours. There
is no collapse in this package to undo: nothing here caps a closed select, and
the rail draws every counted bucket. The live answer for the phones leaf
carries exactly two (`novoe` 13, `b-u` 31 over 46 candidates) and the
category's own `condition` feature declares exactly two options with
`maxSelected: 1`. Its description says the finer grades are DERIVED from the
condition blocks and shown on the listing, so the 5-point scale is a display
value upstream and was never a filterable axis. A rail cannot offer values the
schema does not have.

*The label suffix is an importer defect.* The pair reads the heading the wire
provides (`facet_labels[<slug>].label`), falls back to the feature's own
`name`, and composes nothing — so a technical suffix in a visible label is a
feature name, which is data. The specific instance the census caught is no
longer in the registry; what remains of the class is one orphaned feature
(`bathroom_multi`, named with a `(multiple)` suffix, referenced by no
category) and two `(ND)` names under `novostroyka`. Nothing to fix here.

*The two empty-rail sentences are already one.* The census found the rail
explaining one cause two ways; `search.facets.withheld` and its plural family
were deleted in the wave before this one and the withheld case now says
nothing at all. What was missing is the guard: both of the pair's layouts — the
desktop column and the phone sheet — now have a test asserting they print the
same string for the same answer, that it comes from `search.facets.empty`, and
that no bundle in en/ru/es carries a second sentence for the case to drift back
into.
