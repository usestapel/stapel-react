---
"@stapel/search-react": minor
---

A facet group whose codes are a sibling's children is STAGED behind that
sibling, and the server decides which groups those are.

`OptionsRef.parentFeature` says a model group's codes are the children of the
make group's chosen term. This pair has read that off the category schema
since `resolveFacetParents` shipped, and a leaf page with a threaded schema is
the only place that read works: a branch page and a text query carry no leaf
schema at all, and the server decides staging on the SETTLED query — text
extraction can supply the parent's value, which no client can reproduce.

stapel-search 0.18.0 says it on the wire instead. `facet_labels[<slug>]`
gains `depends_on` (the parent's slug, `null` for an independent axis), `gated`
(this answer is holding the group shut: no options, and no aggregation was
paid for) and `parent_missing` (the deep-link case — the request filters the
CHILD and carries no value for the parent; the filter stays applied), and
`facet_meta.dependent_facets` reports `staged` or `flat` under both values.
The pin moves to v0.18.0 and the panel follows the server: `staged` means the
answer's `gated` decides per group, `flat` means nothing is gated and the
schema-derived rule is not applied on top, and a server that states neither —
a pre-0.18 one — keeps exactly the behaviour it had.

New: `useDependentFacets(groups, values, meta)` publishes
`{dependsOn, gated, parentMissing, parentLabel}` per group, the parents a
`parent_missing` child asks to be drawn open, and `onParentChange` — the rule
that a parent's change takes its dependents' selections with it. It is applied
inside `useFacetPanel`, so the rail, the phone drawer and both chip rows
cascade through the seam they already write through: changing, adding to or
clearing a parent removes the child's filter in the SAME commit — one history
entry, one request. Committing them separately puts the new make and the old
model on the wire together, and that request has an honest answer nobody asked
for.

In the default skin a gated group renders collapsed and inert — disabled
header, no focus stop, no options, no count — with the hint that names its
parent (`search.facets.parent_first`, already in every locale this package
ships) drawn whether the group is open or not; its opener chip is disabled
rather than opening an empty sheet; and it remounts when it un-gates, so the
axis the reader has just unlocked comes back open. A `parent_missing` group
keeps its selection and forces its parent group open beside it. Order is the
server's: the answer already places a dependent below the group that opens it.
