---
"@stapel/search-react": minor
---

search: headings come from the server, a vocabulary becomes a dictionary, and two browse surfaces for a category page

**A heading is named, or it is marked.** Group headings and option captions now
resolve in one stated order — `facet_labels` from the answer, then the category
feature definition, then the raw slug. The slug arm is not a fallback anyone may
ship: it renders, because a heading a person cannot read still beats options
with no heading at all, and it renders MARKED — `labelSource: "none"` on the
group and the option, `data-label-source` on the drawn control, and one
`console.warn` per slug outside production, so a storefront's own test fails on
it. Measured on a live classified's cars branch the page passed an empty feature
list and the whole rail was raw index slugs: the make group was on screen,
unlabelled, and the complaint that came back was "I cannot pick a make".
`FacetGroup` and `FacetOption` both carry `labelSource`
(`"server" | "schema" | "host" | "none"`) — "did anybody actually name this?" is
a question two surfaces have to answer and neither can answer by reading the
string.

**A vocabulary level is a DICTIONARY.** Past eight counted buckets a
`ref_select` group — or an untyped group that long, which is the live case where
no schema was threaded through — stops being eight checkboxes plus a
`Show all (418)` and becomes the busiest values, a search box over the rest, and
the chosen values pinned above it where a filter cannot go invisible. The box
matches ACROSS ALPHABETS: `тойота` finds `Toyota`, `тимберленд` finds
`Timberland`, `ровер` finds `Land Rover`. That is a prefix rule over two keys
per word — a transliteration, and its consonant skeleton, because the two
scripts disagree exactly on the vowels of a borrowed name (`timberlend` vs
`timberland`, both `tmbrlnd`). Table-driven and dependency-free, and local: the
buckets are already in the answer, so nothing is requested per keystroke.
`facetGroupShape` gains a `"dictionary"` arm beside `segmented`/`nested`/
`checkbox`, and the threshold counts EVIDENCE buckets — a zero-filled option
table or a schema-only tail is still a list a person can read.

**`<PopularValues>`** prints the busiest values of one group as a multi-column
`Toyota 802` block that applies the filter on click — a table of contents for a
category, drawn from the same drill-down counts the panel shows, so a value
cannot read `802` in one place and `93` in the other. `hidden` is a PROP rather
than a media query inside: whether a 390px screen has room for forty links is a
fact about the page, and the page is the storefront's.

**`<PartitionChips>`** is the single-select row a `chips` category draws instead
of a tile grid: `Все | child…` from `{id, path, name}`, controlled — the choice
is a `category` in the URL, not state in a chip row. It is a real `radiogroup`
with roving tabindex and arrow keys, because exactly one of them is true at a
time and a row of `aria-pressed` toggles announces the opposite: independent
switches, with no reason why pressing one released another.
