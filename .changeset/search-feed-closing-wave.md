---
"@stapel/search-react": minor
---

The feed pins its sort row, a colour facet shows the colour, and the rail stops
drawing boxes the page had already decided.

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

**Three fills, from the owner's tidiness probe on the stand (dark theme).** All
three are the same mistake in three places — this pair painting something its
page had already decided.

`<SearchPage railSurface>` / `<FacetPanelPane railSurface>`, default `"flat"`.
The filter panel's body painted the raised container ground, and the probe read
it as a **270 x 1539** filled slab with no radius and no border, standing on
the page ground for the whole height of the feed: a card shape with none of a
card's edges. `"flat"` is the substrate's `bare` surface plus the one property
a bare surface does not set (`color: var(--stapel-text)`) — the same answer
`categories-react` gave for its grid, its strip and its breadcrumbs. `"panel"`
restores the old arm whole, for a page whose ground is an image or a layout
that genuinely wants the filters on their own sheet.

**The rail's footer bar chooses no colour.** It painted antd's
`colorBgContainer` in BOTH arms — a second opinion about a colour its parent
had already taken, and, once the body went flat, a lighter strip across the
foot of the rail. It now paints the panel's OWN token (`var(--stapel-surface)`,
or `--stapel-surface-raised` under `railSurface="panel"`) and only in the
PINNED arm, which is the one with a scroll port under it; a transparent floor
there would let the options read through the bar. The static arm paints
nothing and keeps its hairline — the finding is the fill, not the edge.

**`resultsHeader` takes a box only when it fills one.** The slot is a node, and
a node that renders nothing cannot be told from one that renders something
until React has run it — so the wrapper was mounted on the PROP and stood in
the block-rhythm column as a `1392 x 0` element whenever a host's header had
nothing to say. An empty child is not free there: the column's gap is charged
on both sides of it, so two real blocks measured **64px** apart where 32 is
declared, on every feed page. The wrapper is `display: contents` now — no box
with nothing inside, exactly one gap with something inside — and the
`data-testid` survives either way, so a consumer stylesheet carrying
`[data-testid="search-results-header"]:empty { display: none }` as a stand-in
can delete it.
