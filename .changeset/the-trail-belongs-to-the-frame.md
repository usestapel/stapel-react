---
"@stapel/categories-react": patch
---

categories: the breadcrumb trail belongs to the frame, not to the address bar

**One row still blanked on a partition press.** `<CategoryPage keepPrevious>`
holds the whole frame across a sibling change — the heading, the sub-category
chrome and whatever the host rendered into `renderListings` all stand while the
new category's two reads are in flight. `<CategoryBreadcrumbsBar>` was handed
the RAW `categoryId` anyway, so it started the new category's own reads
immediately, went `loading`, and drew a lone `ant-skeleton-input-sm` where root
→ current had been. A held frame with a hole punched in the one row above it is
the rebuild `keepPrevious` removed, just narrower.

- `<CategoryPage>` hands the bar the row the FRAME holds
  (`source.state.data.current.id`), falling back to the address when there is
  nothing held — a first mount, or `keepPrevious={false}`. The trail now names
  the category the rest of the page is drawing, and moves when the frame moves.
- `<CategoryBreadcrumbsBar keepPrevious>` and `<CategoryBreadcrumbs
  keepPrevious>` — both default `false`, so a bar mounted alone in a header is
  byte-for-byte unchanged. `<CategoryPage>` passes its own. The kept trail
  refreshes IN PLACE and carries `data-stapel-load-refreshing="true"`
  (`<LoadBoundary>`) until the newer rows land, which is what covers the case
  the held row cannot: a jump to a category whose ancestors are not already in
  the cache.
- A first load is still the skeleton (there is nothing behind it to keep), and
  a REFUSAL is still never held — `useKeptLoad`'s rules, not new ones.

`test/keepPrevious.test.tsx` proves it structurally: across a sibling press the
trail's ELEMENT IDENTITY holds, so no skeleton can have rendered at any point
without the assertion catching it, and a `MutationObserver` counts the
`categories-breadcrumbs-loading` nodes on every mutation batch rather than at
the two moments a synchronous assertion happens to look.

A storefront holding a partition press can go back to the blanket "no loading
boundary" assertion.

Measured, dependencies held constant: `dist/index.js` 10437 → 10445 B (limit
10.45 KB, held — 5 B of room left), `dist/default/index.js` 17614 → 17713 B
(limit 17.8 KB, held).
