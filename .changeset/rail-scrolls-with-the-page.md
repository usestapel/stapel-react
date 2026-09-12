---
"@stapel/search-react": minor
---

`<SearchPage railScroll>` — the filter rail can scroll with the PAGE.

The rail has been its own scroll container since it became sticky, and for the
surface that asked for it that is the right answer. It is not the only one: a
client storefront's owner reads a second scrollbar standing beside the results
as a second page, and wants the filter column to travel with the feed in one
gesture. `railScroll="page"` is that arm — no `overflow-y`, no height cap, no
`scrollbar-gutter`, no `overscroll-behavior`, and no bar to dress a port that
is not there. The default is `"internal"`, so no existing deployment changes
behaviour by upgrading.

`"page"` is not "sticky off". A rail SHORTER than the room under the host's
chrome still pins at `railTop`; only a rail taller than the window stands in
flow, because a stuck box that tall is cut off at the foot of the screen and
the page scroll — now the only scroll on the surface — cannot reach its last
controls. Which of the two a leaf gets is MEASURED rather than read off a
breakpoint (`useRailFits`: the rail's own height against `window.innerHeight`
minus the offset it carries as `scroll-margin-top`, a `ResizeObserver` for the
element and a `resize` listener for the window, with zero refused as a
measurement), because the same catalogue draws four facet groups on one section
and twenty on the next.

The rail keeps its own element across a facet change in both arms: the panel
re-renders inside the box and the box is never replaced, so ticking a filter
scrolls nothing.
