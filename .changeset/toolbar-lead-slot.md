---
"@stapel/search-react": minor
---

`toolbarLead` — a host node inside the results toolbar row, at its start.

Nothing could put a control in that row. `<SearchPage>` forwards `toolbarSticky`
and `toolbarTop` and nothing else about it, and each existing candidate costs a
row of its own plus the column's gap — about 50px of a page head:

- `resultsHeader` spans BOTH columns by contract, so it would stand the control
  over the filter rail as well as over the list;
- `resultsLead` is inside the results column, which is closer, but it renders
  ABOVE the heading row and the toolbar;
- the pane's own `toolbar` is not forwardable from `<SearchPage>` at all,
  because the page BUILDS that value — the view switch, the sort select, the
  page size and `resultsAction`, in two shapes for phone and desktop. A host
  handed that prop would be REPLACING the pair's controls rather than adding to
  them: it would have to re-implement the row to add one item, and would lose
  the phone/desktop split on the way. That is why this is a lead slot and not a
  passthrough.

So `toolbarLead` is the mirror of `resultsAction`, which is the same row's
trailing end. It is taken by `<SearchResultsPane>` and forwarded by
`<SearchPage>`, and it renders in both shapes of the header: in `"banner"` as
the first item of the controls row, before the count's own half; in `"compact"`
as the first item of the toolbar row between the heading and the count. Nothing
is rendered when a host passes nothing — no box, no gap.

It is placed AHEAD of the count's half rather than inside it. That half is a
reservation with a zero flex basis (D466) whose job is to absorb the row's
slack so the controls do not travel when the number arrives one render later; a
second elastic item sharing it would split the slack and bring the travel back.
The new box is sized like the trailing group instead — it keeps the width it
needs and gives some back below that, with `min-inline-size: 0` so the host's
own node decides how.

Measured in Chromium with the styles the row emits, a realistic control beside
the count and the controls: the row stays **40px and the controls stay flush to
the trailing edge** at 1088, 840 and 600. On the 390px compact arm the row wraps
and grows 40px to 52px — a 12px cost on a phone, against ~50px for a row of its
own.
