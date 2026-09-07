---
"@stapel/search-react": minor
---

`<SearchPage>`: the filters sheet is controllable, and its header can close it.

The page owned `sheetOpen` and published only `defaultFiltersOpen` — an INITIAL
value. A storefront that renders a partition or axis row in `filtersHeader` and
NAVIGATES on a chip press therefore had nothing to close the sheet with: the
route changed under a drawer that was still standing, and the new page opened
behind it.

Two seams, and a host takes whichever it needs:

- `filtersOpen` + `onFiltersOpenChange(open, reason)` — React's usual
  controlled/uncontrolled contract. Pass `filtersOpen` and the page keeps no
  copy of the state; leave it out and nothing changes. The callback fires in
  both modes, so a container that only wants to WATCH the sheet does not have
  to own it, and `reason` says which move it was: `"open"`, `"apply"` (the
  footer committed), `"dismiss"` (the X, the scrim, Escape) or `"consumer"`.
- `filtersHeader` may now be a function handed `{ closeFilters, open }` —
  the close without lifting any state, for the header whose own control ends
  the search it sits inside. The node form is untouched.

The uncontrolled page behaves exactly as before. New exported types:
`SearchFiltersOpenReason`, `SearchFiltersHeader`,
`SearchFiltersHeaderSlotProps`.
