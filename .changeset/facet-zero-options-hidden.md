---
"@stapel/search-react": minor
---

A facet option counted at zero is not offered.

Reviewers walking a live classified at 1024 and 1440 found filter rails printing
values nothing can match: on a text search the colour axis offered six values
with a `0` beside them, and on a laptops leaf the condition axis offered its
"new" bucket at `0`. Each is a pressable checkbox whose only outcome is an empty
feed. The drill-down facet is reporting what swapping to that value would get
you, and the shape it reports in is an offer.

`facetOptionIsOfferable` (new, exported) is now the one predicate for it and
`FacetGroupControl` applies it once, at the top, so all four shapes obey it — the
checkbox list, the single-choice pills, the desktop dictionary field and the
phone dictionary sheet. It keeps exactly two things:

  - a value the reader has ALREADY CHOSEN, whatever its count. Counts come back
    with the slug's own filter removed, but a chosen value the counter never
    returned is built at `0` by `buildFacetGroups`, and hiding it would strand a
    person inside a constraint with no control to clear it;
  - `null`, which is not `0`. "Nobody counted this" and "there are none" are
    different sentences, so a deployment that publishes no counts keeps its whole
    option list and its rail.

A group left with nothing offerable leaves no titled, openable accordion behind
either: `facetGroupIsEmptyHeading` now asks the question of the offerable
options. Its one exemption is unchanged — a vocabulary-backed axis draws a field
over a dictionary the answer never enumerated, so it works with no live buckets
at all. The panel's own search matches over the options a group will actually
draw, for the same reason.

The rule is the FACET OPTION LIST's alone. Count-bearing controls a host
composes — partition chips, a vocabulary band — are the host's and print
whatever the host rules they print.
