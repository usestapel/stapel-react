---
"@stapel/categories-react": minor
---

The catalogue walk is SERVER-DRIVEN: one small request per rung, and the tiles
hand over to the cascade instead of to nothing.

Measured on a live 3583-row classified catalogue, the whole-tree sync every
surface mounted cost **36 requests / 1.4 MB / 20.2 s** before a category picker
could draw its first select; one rung of `GET {id}/children/` costs **1 request
/ 1-4 KB / 0.25-0.39 s**. The tree is only "already in memory" once somebody
has waited twenty seconds for it.

- `useCategoryCascade` reads `GET {id}/children/` per rung and takes the chain
  a deep value implies from that value's own `tn_ancestors_pks`
  (`GET {id}/`, 300 bytes). A ROOTED ladder — the one a category landing
  mounts — never touches the catalogue. The rungs above a pending one stay on
  screen, so the ladder grows downward rather than blanking.
- `<CategoryPage subcategories="tiles">` past the depth cap now renders the
  CASCADE. It rendered nothing, which on that catalogue left 2924 of 2924
  active leaves — every category that has any characteristics — unreachable by
  browsing from a phone, while the same URL at 1440px descended in three taps.
- `<CategoryPage categoryId={…}>` is the fast address: two small reads, no
  catalogue. `slug` still resolves against the sync, because the server has no
  slug lookup. `onNarrow` / `narrowValue` report a cascade choice to the host.
- `<CategoryBreadcrumbs categoryId={…}>` builds the trail from the server's own
  ancestry, one 300-byte read per crumb.
- New reads: `retrieve` on the API, `useCategory`, `useCategoryRows` and
  `useCategoryLevels`.
- `useCategoryCascade` takes `roots` — the escape hatch for the one rung the
  server cannot answer (there is no roots endpoint and no `tn_parent` filter).
  Both that and a slug lookup are recorded in MODULE.md as upstream asks.

Breaking, pre-1.0: the cascade bag and `CategoryCrumb` carry `Category` rows
rather than built `CategoryNode`s (a node can only come from a whole tree, and
needing one is the same as needing all of it); `buildCategoryCascade` and
`cascadeReachedLeaf` take fetched rungs plus a chain of ids; `SubcategoryForm`
gains `"cascade"`.
