---
"@stapel/listings-react": minor
---

`<ListingComposerPage renderLocationPicker>` — ask a seller WHERE, not for
their latitude.

The composer asked for a location label and a raw `lat` / `lon` pair, which is
a question no advert-poster on any marketplace can answer, and it is why
`location` was empty on every listing on the darom fleet. The pair still
cannot ask for an address — that needs a geocoder, a geocoder is the
deployment's, and a library that picked one would pick it for every host — so
the question is a slot, shaped like `renderCategoryPicker` beside it. It
carries the whole `ListingLocation` composite including `geohash`, which only
the resolver has and which this pair still refuses to compute. Unfilled,
nothing changes: the label and the coordinates are exactly what shipped before.

`<ListingCard blockedReason>` — how loudly a blocked favourite states itself is
a decision about the SURFACE.

`"text"` (default, unchanged) prints the reason and the sign-in door. `"line"`
keeps the sentence and drops the repeated door; `"tooltip"` moves the reason
onto the control it is about, where the existing `<span>` wrapper keeps it
reachable by pointer and by keyboard. On one card the full version is help; on
a grid of twenty-four it was the loudest thing on the landing page — twenty-four
doors to the one place the header already links. Same argument, and same shape,
as `<SearchResultsPane degradationNotice>`.

`<ListingPhoto>` memoises the host resolver on the image reference instead of
calling it in render.
