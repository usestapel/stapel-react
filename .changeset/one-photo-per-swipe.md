---
"@stapel/listings-react": patch
---

A swipe advances exactly one photo, and only past a real threshold

The card gallery committed an advance after a fixed `SWIPE_MIN_PX = 32` of
travel, whatever the photo's size — 9.1% of a slide on a one-column phone card
and 18.8% on a two-column feed tile. Worse, the gesture's origin was reset on
every commit, so one continuous drag committed once per 32px travelled: a drag
across three slide widths advanced three photos, and a fling advanced as many
as there were. The middle photo flew past on a light gesture.

`swipeStep(dx, dy, slideWidth, velocity)` now commits on either:

- **distance** — at least `SWIPE_COMMIT_FRACTION` (0.3) of the SLIDE's own
  measured width, via `measureSlideWidth()` (the first slide's box, taken once
  at pointerdown; the media well is 8% too generous because of the carousel's
  peek, and the viewport is not the geometry that matters), or
- **velocity** — at least `SWIPE_FLICK_VELOCITY` (0.5 px/ms) over a
  `SWIPE_VELOCITY_WINDOW_MS` (100ms) moving window, so a gesture that crawls
  and is then thrown is read as the throw the person meant.

It returns only `-1 | 0 | 1`, and a per-gesture latch means one press can never
move more than one photo. A horizontal gesture that falls short snaps back to
the active slide. `SWIPE_MIN_PX` stays as a tap-wobble floor and is documented
as a floor rather than as the price.

The detail gallery's strip is native scroll-snap; it gains
`scroll-snap-stop: always`, so a fling comes to rest on the next photograph
instead of flying past however many its momentum carried.

`measureSlideWidth` returns `0` when nothing is laid out, and `swipeStep` then
falls back to the pixel floor rather than inventing a width. The extra
parameters are additive, so an existing two-argument caller is unchanged.
