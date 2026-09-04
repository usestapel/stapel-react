---
"@stapel/categories-react": minor
---

`GET {id}/features/` reads the two things stapel-categories 0.20.1 added: a `chips` parent with no features of its own answers the EFFECTIVE schema (the intersection of its children's), and says so via an `X-Effective-From` response header — outside `StapelClient.get`'s reach, so this one read goes over a small raw-`fetch` carve-out (`api/featuresRaw.ts`, the one legal home of `fetch` per `stapel/no-raw-fetch`). `useCategoryFeatures` now resolves to `{ features, effectiveFrom }` and `<CategoryFeatures>`'s bag gains `effectiveFrom: "own" | "children"` plus `divergent: boolean` on each entry; `CategoryFeature` gains an optional `divergent?: true` (declared by hand, ahead of the next contract-pins regen). The new `visibleFeatures(features, { chipPicked })` hides a `divergent: true` row until a chip is picked — exported for the composer and the facet rail, not wired to any host here.

`useCategoryCascade`/`<CategoryCascade>` (`commit: "stage"`, unchanged otherwise) takes a `partitionChild` option and echoes it back on the bag, so a host's own partition select (drawn beside the cascade, per the browse contract) can feed `visibleFeatures`'s `chipPicked` from the same bag instead of a second piece of state.

`<CategoryMegaMenu onSelect={(node, kind) => …}>` fires on click/Enter of any item — a rail root (`"root"`), a column's own header link including its `N more` tail (`"child"`), or a third-level link (`"grandchild"`) — additive to navigation, so a host no longer reads `data-category-id` back off the DOM through a delegated listener to learn which row was pressed.

`<CategoryPage measure>` sets the page's content column width (default `CATEGORY_MEASURE`, `64rem`, now exported from `/default`), replacing a host's `!important` override of a value it could not read back.
