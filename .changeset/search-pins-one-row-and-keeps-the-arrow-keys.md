---
"@stapel/search-react": patch
---

search: what pins on a results page is one row of controls, and the partition's arrow keys work more than once (D452, D454)

**D452 — the heading is out of the pinned block, and has the column to itself.**
Measured on the stand: the pinned results block on `/s` was **100px** at 1440
and **150px** at 1280. Both numbers are one `<h1>` wrapped to two lines. In the
wide header shape the heading was the leading flex item of the very block that
pins, the `nowrap` controls row beside it (count, sort, page size, view switch)
took the width it needed, and the heading was left a **415px** sub-column of a
1200px measure — so the page pinned a third of a laptop's fold under the header
while the feed scrolled past it.

The heading is now a row of its own at the column's full width
(`search-results-heading-row`, `inline-size: 100%`), and
`search-results-toolbar` — the element `stickyToolbar` acts on — is the
controls' line alone, which is what `header="compact"` already did. Nothing
about a heading belongs in a pinned bar: it is read once, and its length is the
HOST's (`resultsHeading` carries a surface's own sentence), so it is the one
element on the page whose height this pair cannot bound.

Visible change for a wide-shape host: the heading and the controls are two rows
rather than one line, separated by the results column's own gap. `resultsHeading`,
`resultsHeadingLevel`, `resultsHeadingVisible`, `RESULTS_TOOLBAR_CLASS` and
`stickyToolbar` are unchanged; a host reaching *into* the toolbar for the
heading with a descendant selector must aim at `search-results-heading` instead.

**D454 — the segmented partition keeps the focus across the choice it just
made.** Measured on the stand: the first `ArrowRight` moved the rail from "all"
to "new" and navigated — correct, the choice IS a `category` in the URL — and
after the navigation `document.activeElement` was `BODY`. Every further arrow
press then did nothing, so a keyboard user got exactly one move per Tab into the
row.

Choosing re-renders the surface and, while the new category's children are
resolved, takes the rail down and puts a new one up: new `input`s, a new antd
`useId()` name, and the focus left on `<body>`. `<PartitionChips>` now restores
it to the chosen cell after an arrow press — in both variants, on a re-render
and across a remount — and only after an arrow press, so a page that was loaded,
clicked or scrolled is never grabbed. Within one mount it also brings the focus
and the selection back together, which is what makes the control's own focus
ring (painted on the checked cell) agree with where the keyboard actually is.
