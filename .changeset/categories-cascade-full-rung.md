---
"@stapel/categories-react": patch
---

A short cascade rung is read whole, without a gesture.

`<CategoryCascadeField>`'s option list took antd's 256px default. Against the
44px touch rows this skin draws that shows five and a half of them and lands
the seventh flush with the bottom edge — so a ten-option rung, which is what a
catalogue's TOP level is, renders with no visual cue that three more exist
behind an eight-pixel scrollbar.

Two separate walkers read a ten-root catalogue as "seven roots" from that
view and filed it as missing data. It was not: `GET /categories/carousel/`
answered all ten in one request, the list is virtualised, and a real finger
reaches the rest. A scripted `scrollTop` does not, because a virtualised list
keeps `overflow-y: hidden` on its holder and scrolls itself — so the report
was measurement, but the affordance it measured was real.

`listHeight` now fits ten rows. A longer rung still scrolls, and always looked
scrollable, because there a row is cut by the edge.
