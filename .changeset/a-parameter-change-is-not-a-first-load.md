---
"@stapel/core": minor
"@stapel/tokens-antd": minor
---

**A parameter change is not a first load: `keepPrevious`.**
`LoadState`'s three arms are three DIFFERENT elements at one position, so
every trip through `loading` UNMOUNTS whatever the boundary was rendering.
That is the right answer for a first load and the wrong one for a parameter
change, where a whole correct page is on the glass and the only news is that a
newer one is coming.

The measured cost of not distinguishing them (D454, a storefront's `/c/:slug`):
a partition press — a navigation to a SIBLING, where the page's whole frame is
unchanged and only its rows differ — sent the screen's reads pending, swapped
the boundary's subtree for a four-row skeleton, and rebuilt the filter rail,
the facet panel, the segmented control the person had just pressed, its focus
and its scroll position. Twice, out and back, plus a layout shift in both
directions. The host's workaround was to re-mount the pair's own queries in the
container and withhold the id from the page until both had landed — 47 lines to
tell a component something it already knew.

* **`useKeptLoad(state, { keepPrevious })`** is the memory: the last data a
  screen actually showed, held while the next answer is in flight. For a state
  composed of SEVERAL reads (a category page is gated on two, and the composed
  answer is `loading` the moment either is), and for one built from hooks that
  are shared with surfaces which must not see a stale rung — turning
  `placeholderData` on inside a hook hands that behaviour to every caller of
  it; this hands it to the one screen that asked. The memory is a ref written
  in an effect, so nothing is written during render and the hook cannot loop on
  a `data` whose identity changes every render.
* **`loadStateFromQuery(query, { keepPrevious: true })`** is the same rule for
  the case TanStack remembers itself: one query with
  `placeholderData: keepPreviousData` reads as `ready` + `refreshing` instead
  of `loading`.
* **`keepPreviousLoad(next, previous)`** is the merge both are made of, pure
  and React-free, so the rule is testable without a renderer.
* **`LoadReady.refreshing`** carries it, and `mapLoad`/`bothLoaded` carry it
  across a projection.

Two things are deliberately not kept. A FIRST load still reports `loading` —
there is nothing behind the skeleton. And a REFUSAL passes straight through on
top of however much good data there was: holding the last live answer over an
error is a dead link wearing a working page, which is this module's own lie
one state along, and the error arm owns the retry.

`refreshing` is set on EVERY ready answer once the seam is in play, `false`
included. That is not noise — it is what lets a renderer key its DOM off the
field without growing and dropping a wrapper as the flag comes and goes, and a
wrapper that appears is a different element at the same position, which is the
remount being prevented. So **`<LoadBoundary>`** (`@stapel/tokens-antd`) wraps
such a ready arm in one `display: contents` box — no layout, present whether
the flag is up or down — carrying `data-stapel-load-refreshing="true"` while
the newer read is in flight, for a host that wants to dim or announce the wait
without owning the state. A state that never asked to keep anything gets no
wrapper at all, so no existing host's DOM changes.

Without the option every one of these functions behaves exactly as it always
did, placeholder data included, down to `toStrictEqual`.
