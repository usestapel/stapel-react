---
"@stapel/search-react": minor
---

search: the rail and the results toolbar can both be told where the page's chrome ends

Both columns of `<SearchPage>` pin something, and a deployment with a fixed
header could state neither of them without reaching around the pair.

- **`<SearchPage railTop>`** — where the filter rail's sticky top edge sits. The
  rail is `position: sticky; top: 0` written INLINE, and an inline declaration is
  beaten by nothing but `!important`, so the fleet's storefront carried that
  `!important` as the only rule in its repo aimed at a pair's own geometry —
  which meant the first 56-64px of the rail (its heading and its first control)
  sat behind the header everywhere else. A number is pixels; a string is taken as
  written, so `railTop="var(--stapel-header-height)"` reads the height
  `@stapel/shell-react`'s `<PublicShell>` now publishes rather than restating it.
  The rail's internal height cap moves WITH the offset — a rail pushed 64px down
  the window whose cap is still `100dvh` ends 64px past the foot of the screen
  and its last control is unreachable. `railStyle(top)` is exported for a host
  laying out its own column.
- **The results toolbar has an element of its own, in BOTH header shapes.**
  `data-testid="search-results-toolbar"` and the class `RESULTS_TOOLBAR_CLASS`
  (`"stapel-search-results-toolbar"`) are on the row that carries the sort, the
  view switch, the page size and the count: in `"banner"` that is the wide header
  block (heading at one end, controls at the other, one line, already a direct
  child of the results column), in `"compact"` the toolbar row alone. It had no
  class, no test id and, in the compact header, no parent but a ~112px stack, so
  a host that wanted it pinned needed a `:has()` on the heading beside it, a
  `display: contents` and this pair's own rail breakpoint restated in a media
  query — three rules aimed at a shape the pane could change under them.
- **`<SearchResultsPane stickyToolbar={{ top }}>`**, passed through from
  `<SearchPage stickyToolbar>`. It pins the row the pane ACTUALLY drew, which is
  why it is a prop and not a stylesheet: the pane knows which shape it is in and
  a sheet has to guess. Net-zero in flow — `position`, a layer and the `surface`
  background, and not one pixel of padding, because a bar that grows room to
  breathe has to give it back and which spacing that is belongs to the host. And
  no second sort control: there is exactly one on a results page and this pins it
  where it stands.
- **The toolbar row is one line that cannot become two** — `flex-wrap: nowrap`,
  `min-inline-size: 0`, `overflow-x: auto` and a thin scrollbar, in both shapes. The count arrives
  with the answer, one render after the toolbar is on screen; a row that wraps
  grows a second line at exactly that moment, and a bar that grows while pinned
  pushes the first cards of the feed down under the reader's eye.

**One visual change, and only on the phone**: the compact header's stack now
draws no box of its own (`display: contents`), so its heading, toolbar and count
are items of the results COLUMN — which is what a sticky row needs, since
`position: sticky` travels inside its parent and a toolbar nested in a 112px
stack can move 112px and no further. The gap between those three is therefore
the column's rather than the stack's. Everything else is unchanged for a host
that passes neither new prop.

Size: `dist/default/index.js` 31.05 → 31.2 KB measured with dependencies held
constant (150 B); the ceiling moves 31.25 → 31.5 KB.
