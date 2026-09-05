---
"@stapel/profiles-react": patch
---

`<PersonRow>` takes `href` and `linkComponent`: a person's name can be a real
link.

The row's only activation was `onOpen`, a click handler on a `role="button"`
div — navigation a browser cannot see: no middle click, no "open in new tab",
no "copy link address", no status bar, nothing for a crawler. A seller's name
under "message the seller" is exactly where a reader reaches for all four.

`href` makes the NAME an anchor; `linkComponent` swaps that anchor for the
host router's `<Link>` (core's seam — this pair still ships no router). With
`href` the row does not also become a button: one destination, one activatable
element, and no `role="button"` wrapped around a link. `onOpen` still fires on
the click, additively, and never cancels the navigation. Neither prop given,
the row is exactly what it was.
