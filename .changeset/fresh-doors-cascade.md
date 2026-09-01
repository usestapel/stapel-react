---
"@stapel/categories-react": minor
---

The cascading child selector the tile cap hands over to — `useCategoryCascade`,
`<CategoryCascade>`, `buildCategoryCascade` and the `<CategoryCascadeField>`
skin.

`catalog/tiles.ts` has capped tile navigation at the second level of the tree
since 0.7.0, on the rule that everything deeper is chosen "as a characteristic,
through cascading child selectors". The cap was enforced and the selector did
not exist, so on a live classified catalogue — 3583 categories, 3036 of them
leaves — only 198 rows were reachable, a level-2 page answered `[]` from
`{id}/features/` (features resolve by inheritance, so a category whose own rows
are empty legitimately has none), and its child answered 59. A person was told,
truthfully, that the category has no characteristics, one tap above the ones
that make it usable.

One primitive serves both surfaces, because the owner's model requires the same
gesture when filtering and when posting. The ladder is a pure function of
(index, root, cursor) — a rung is derived from the chain above it rather than
remembered, so changing one cannot leave a stale answer below it. `commit`
is the only difference between the two: `"any"` for a filter (a category path
matches as a prefix, so a parent finds its descendants), `"leaf"` for a composer
(a non-leaf inherits the wrong feature set). Counts per option are a host prop
and are unfilled: no server can currently answer them, and MODULE.md carries the
exact shape asked for upstream rather than a number nobody could check.

`<CategoryPickerField>` is untouched and stays the right control for a search
across a whole catalogue.
