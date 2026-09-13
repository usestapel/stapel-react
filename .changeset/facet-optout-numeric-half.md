---
"@stapel/search-react": minor
---

`config.facet: false` is honoured on the numeric half of the rail.

Reviewers on a leaf selling thirteen second-hand laptops were offered a filter
rail of the parcel's weight, length, height and width, the packing quantity and
the minimum order — six from/to rows of the seller's own shipping and wholesale
paperwork, with the one real numeric axis (the battery) among them.

It was never a data defect. Every one of those slugs carries `facet: false` in
the catalogue — in both fixture catalogues and on the live stand — and
`stapel-search` honours it (`_is_facetable`, read off the feature and then off
its config, defaulting to true): the answer for that leaf counts twenty-four
facets and none of the six.

The client threw the flag away on exactly one path. The DISCRETE half is built
from the answer, which the engine has already filtered; the NUMERIC half walks
`categoryFeatures` — the raw category schema — and pushed every numeric feature
as a from/to row without ever asking. So the opt-out worked on every axis the
server enumerates and on none of the axes it cannot.

`featureAllowsFaceting` (new, exported) reads the flag the way the engine does,
off the feature and then off its `config`, defaulting to true so a catalogue
that says nothing is unchanged. `buildRangeGroups` now consults it. Counted
from the committed catalogue, 15,121 seller-only numeric occurrences across
2,642 leaves stop being offered as filters.

Two exemptions, both already load-bearing elsewhere in this module: a slug THIS
ANSWER measured (`facet_meta.ranges` — the server publishing bounds for it is
the server saying it counted it), and a slug the URL constrains, which keeps
the row that clears it. `isFacetableFeature` reads the same flag, where it is
the belt against a stale index rather than the fix; an applied filter outranks
it there exactly as it outranks the type table.
