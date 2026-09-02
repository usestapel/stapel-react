---
"@stapel/categories-react": minor
---

`<CategoryPage>`'s `"pane"` arm on the id path renders the level it already
holds and never starts the catalogue sync.

Hosts pass BOTH addresses — `categoryId` (the cheap one) and `slug` (the
canonical URL) — and the pane arm used to pick `<CategoryTreePane slug>`
whenever a slug was present, resolving it through the full multi-page
catalogue sync for rows that `GET {id}/children/` had ALREADY loaded to gate
the page. Measured on a live classified deployment: ~36 requests and 13.2
seconds of skeletons under "Subcategories" on a cold desktop landing, while
the same host's list page drew the widget in 0.4 s from per-level reads. It
was the last surface still paying for the catalogue with the id in hand.

- The pane arm now renders the titled list directly from the level the page
  holds when `categoryId` resolved it; `<CategoryTreePane>` remains the
  slug-only fallback, byte-for-byte unchanged.
- Per-row "N subcategories" chips come from `useCategoryLevels` — one small
  cached children read per row, priming the same cache every other rung
  reads. Rows render immediately; a count not yet landed (or refused) draws
  no Tag and no chevron — quiet, never a skeleton gate, never a zero standing
  in for an unknown. A count that lands >0 draws exactly what the catalogue
  path draws.
- The row markup is extracted into an internal `<CategoryLevelList>` shared
  by both arms, so the two sources cannot drift apart visually. Not exported:
  hosts compose the pane or the page, not a third bare list.
