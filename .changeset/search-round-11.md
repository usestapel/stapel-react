---
"@stapel/search-react": patch
---

Two storefront-integrator gaps, closed.

A typed range bound now commits on **blur**, not only on Enter or Apply — the
picker path (`BoundPicker`) already committed on blur, and a typed price or
mileage field doing nothing until a second click was the odd one out.
`<RangeFilterRow>` tracks what it last sent, so Enter followed by the blur it
triggers never double-commits, and a blur that changed nothing sends nothing.

A schemaless group of 2-3 counted buckets (a branch category whose
`/features/` answered `[]`) now draws as segmented pills when its slug reads
as a condition or a boolean (`condition`, `state`, `is_*`, `has_*`) rather
than always falling back to checkboxes — the shape `facetGroupShape` already
gives a schema-declared `maxSelected: 1` axis. There is no `facet_meta` hint
for single-valuedness today, so this is a documented guess keyed on the
slug alone (see `looksSingleChoiceByEvidence` in `FacetGroupControl.tsx`),
and the first thing to replace once the plan sends a real one.
