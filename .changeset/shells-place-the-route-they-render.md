---
"@stapel/shell-react": minor
---

Both chromes place the route they render: the top on a PUSH, where you left it
on a POP.

A single-page app changes the address without loading a document, so nothing
moves the viewport — and neither shell did either. The measured symptom on a
storefront: a card tapped two thousand pixels down a feed opened a listing page
already scrolled past its own photographs, which a reader reports as "the page
opens at the bottom". The other half of the same complaint is the way back: the
browser's own restoration fires against a document the app has not finished
rendering, so Back landed a feed anywhere but the reader's place in it.

The chromes own the `<Outlet/>`, so the chromes own this. `<AppShell/>` and
`<PublicShell/>` both call the new `useRouteScrollReset`, which states four
rules and argues each one:

- a PUSH to another **page** lands at the top;
- a POP restores the offset that history entry was left at;
- a **hash** target wins — nothing is reset over it;
- the **same page under a different query** — a chip, a tab, `?step=` — does
  not move at all.

That last one is why this is not react-router's `<ScrollRestoration/>`: that
component resets on every PUSH unless each individual `<Link>` and `navigate()`
opts out with `preventScrollReset`, so one forgotten call site throws a
filtering reader back to the top of the results. Here the rule is read off the
address instead, and there is nothing per call site to forget. A REPLACE is
deliberately inert: it is an address being corrected under a screen that is
already standing (`/new` becoming `/new/<draft id>` on the first save), and a
composer that jumped to the top on its own autosave would be the worse defect.

`scrollRestoration={false}` on either shell hands the viewport back whole,
including `history.scrollRestoration` — which this otherwise takes for as long
as it is mounted. That is the opt-out for a host that mounts react-router's own
component, and the two must not both run. Default `true`, because a chrome that
owns the `<Outlet/>` and does not place what it renders has left undone the one
job only it can do.

`useRouteScrollReset` is exported from `/default` so a host arranging its own
chrome states the same rule rather than a fifth version of it. It reads and
writes `window`: both shells scroll the document (a `minHeight`, never a
`height` with an `overflow`), and a chrome that grew an inner scrollport would
have to move the hook onto that element in the same change. It is also the one
place in this package that registers a `scroll` listener — passive, its whole
body one assignment to a ref — because the offset a POP has to restore is the
outgoing page's offset at the moment the navigation started, and by the time
any effect runs the browser has already clamped `scrollY` against the incoming
document. No observer reports an offset; the header's flag, which asks a
threshold, keeps its `IntersectionObserver` and its own test says so.
