---
"@stapel/search-react": minor
---

The location control is one control, it says how the search got there, and a radius in the URL means something

Three measurements on a live results page, and each one is a different way of
the same line not saying what is true.

- **Two red links at opposite ends of a 992px strip.** "Searching everywhere"
  sat at x=370 and "Near me · Within 25 km" at x=776, both in the brand colour,
  with 400px of air between them and nothing saying they were about the same
  thing. They now share one bordered box at the leading edge, split by a
  hairline; the place half is ordinary type because it is a STATEMENT, and the
  offer keeps the colour because it is the action. The offer states its radius
  compactly (`search.geo.radius_km_short`) — at 390px the long form made the
  control 272px wide against 231px of room, so it was cut by the group's own
  clip and the filters door overlapped it by 52px.
- **"A chosen place on the map", said to somebody who pressed a button.**
  `SearchStateBag.geoIsOffer` is the provider reporting PROVENANCE — the one
  fact a summary line cannot infer, because every way of arriving at a centre
  produces the same three numbers.
- **`?radius_km=300` with no place.** The search that ran was the honest one (a
  radius with no centre narrows nothing) and the control went on advertising
  its own 25, with nothing on screen saying which number the page had used —
  and pressing the offer then wrote 25 over the 300 the person had typed, the
  one place the URL was rewritten behind a visitor. The codec now reports
  `radius_without_place` through the same notice every other unreadable
  parameter goes through, and the offer CARRIES that radius: what the link
  asked for, what the button says, and what pressing it does are one number.
