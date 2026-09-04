---
"@stapel/search-react": minor
---

The ends of a from/to come from the answer that measured them.

stapel-search 0.14.7 reports `facet_meta.ranges = {slug: {min, max}}` for
every axis a page has numbers behind — core columns and attribute axes in one
map, measured with the range filters removed and uncapped by
`MAX_FACET_FIELDS`. Until now the rail could only ask the CATEGORY SCHEMA,
which knows what a year could ever be (`1900..2027`) and not what this page
has (`1990..2024`), and which types a vocabulary-backed `year`, a `floor`, a
`doors` as CHOICES — so a buyer got a checkbox wall where a from/to belongs,
or nothing at all.

`buildRangeGroups` now takes `ranges` and reads two facts off it. **The
ends**: measured bounds win over declared ones, `RangeGroup.measured` says
which of the two a row was drawn from, and the schema stays the fallback for
a server that predates the report. **Which axes exist**: every reported axis
gets a row whatever the schema calls it — a picker when its integer span is
at most `RANGE_PICKER_MAX_VALUES` (a year), two inputs otherwise (a mileage),
and labelled by slug when the schema names no such feature. `facets=year`
keeps its buckets; an axis can be both. The core price row is unchanged: its
ends move with every other filter, and a field that refuses the number a
person meant to type is worse than an unbounded one.

An engine with no `ranges` verb lists `facet_ranges` in `degraded[]`
(`FACET_RANGES`, exposed as `useFacetPanel().rangesDegraded`). Its empty map
is an engine fact, not a corpus fact: the rail falls back to the schema's
bounds and remembers nothing from it.

And the reservation (D361) learns the same lesson. A leaf whose schema
declares two numeric attributes can ANSWER with four, which is the 53px jump
again, one answer later. `<SearchStateProvider>` now remembers the measured
axis list **per category** (`usePublishRangeAxes` / `useRememberedRangeAxes`,
published from the facet bag as `reservedRangeAxes`), and `<FacetPanelPane>`
reserves that count once a category has reported one — the schema's count
only until then. Memory, never a control: it sizes a placeholder and never
draws a row, so a stale entry costs pixels and nothing else.
