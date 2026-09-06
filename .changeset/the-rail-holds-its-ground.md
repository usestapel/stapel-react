---
"@stapel/search-react": minor
---

search: the rail holds its ground while the next facet answer lands (p43)

**CLS 0.0586 on a partition press.** The rail itself survives — the pair has run
`placeholderData: keepPreviousData` for three releases, so nothing unmounts —
and what the reading measured is the window after it: `facet-group-make` and
`facet-group-model` changing size as the new axis's facets arrive, each taking
every group under it along.

The panel could not tell a skin that the answer in hand was the previous one, so
nothing could hold still. Now it can:

- `useFacetPanel` reads its envelope with
  `loadStateFromQuery(query, { keepPrevious: true })` (`@stapel/core` 0.26.0),
  and `FacetPanelBag` carries **`refreshing`** — `true` exactly while a newer
  answer is in flight over an older one, never on a first load;
- `<FacetPanelPane>` declares **`data-facets-refreshing`** on the rail
  (`search-facets`), always `"true"` or `"false"` so a host's rule has one
  attribute to hang on instead of racing the pair's queries to work it out;
- every facet group **stands on the height it was last settled at** while that
  is on: its own last measurement, taken in an effect and held in a ref, applied
  as a `min-block-size` floor and published as `data-reserved`. A floor and never
  a cap — a group that needs more room still takes it — and it is released with
  the answer, so no group is permanently stuck at the tallest it has ever been.
  Nothing is measured, and nothing reserved, while refreshing: a reserved box
  would otherwise remember its own reservation and the floor could only ratchet
  up.

`<FacetGroupControl>` takes the same `refreshing` prop, defaulted off, so a host
mounting one directly is unchanged.

The `@stapel/core` peer floor moves to `>=0.26.0` for the `keepPrevious` option.

Measured with dependencies held constant, this package's src before and after:
`dist/default` 31.43 → 31.51 KB (80 B), limit 31.5 → 31.75 KB.
