---
"@stapel/search-react": patch
---

A facet group nothing in the result set carries is not drawn

Measured on the deployed phones leaf: `sim_config`, `device_history` and `set`
are authored `select` features that no listing in the leaf fills. All three
were drawn as full groups — a heading in the rail, a chip on a 390px row, and
between them seven checkboxes each guaranteed to return nothing. A buyer can
tap every one of them.

They are not a counting bug. The server's `fill_zero_options` creates the slug
and zero-fills every authored option on purpose, and the coverage floor that
would have withheld them (`FACET_MIN_COVERAGE`) governs only the slugs an
evidence plan BORROWED from sibling leaves — a slug the queried category
authored is exempt, because "a closed option set answering with its zeros is a
shipped decision". That is right about an OPTION and wrong about a GROUP: a
size chart showing `XL — 0` beside `M — 12` is telling the truth about a shape
worth seeing whole, while a group whose every option is 0 is not a shape at
all. Nothing on the wire separates the two — the client has to sum the buckets
itself, which is what `facetCoverage` already does for the chip row's order
and the rail's disclosures.

So `buildFacetGroups` now drops a group that is COUNTED and sums to zero, by
that same measure — the module already refuses to emit an empty group, on the
stated grounds that an empty group is still a heading and still a chip, and
this is the same defect with checkboxes in it. Three exemptions, each with a
test:

- an UNCOUNTED group sums to zero for the opposite reason — its options carry
  `count: null`, nobody looked, and `/query` accepts `f.<slug>` regardless.
  Dropping on that is the regression the `MAX_FACET_FIELDS` branch exists to
  prevent (a live cars leaf: 26 facetable features declared, 12 counted).
- a group the reader has already filtered on, whatever its counts say, or the
  URL narrows the search with no control left to widen it.
- a zero option beside a live one, which is drill-down working as designed.

A counted group that came back with no buckets at all (`video_file_url: {}` on
that same leaf) is dropped by the same rule rather than by each skin filtering
the model's output again downstream.

This does not fix the catalogue. A leaf declaring three features that nothing
in it fills is a category-authoring defect; this stops it reaching a buyer as
a dead control, on every leaf and every host, and it needs no server release.
