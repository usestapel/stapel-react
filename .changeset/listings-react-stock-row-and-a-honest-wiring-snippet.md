---
"@stapel/listings-react": patch
---

The stock row printed `{count}` at a buyer, and the wiring snippet taught the
banned idiom

Two things the live storefront walk found, both of them the shape of a
sentence rather than a bug in behaviour.

**`<ListingDetailPane>`'s stock row.** `listings.detail.stock` was a whole
sentence — `"В наличии: {count}"` — used as a `<Descriptions.Item>` LABEL, with
the quantity in the value cell beside it. antd renders the label as written, so
the page said `В наличии: {count}: 3`: a raw placeholder in front of a shopper,
on the one row that tells them whether the thing is in stock. The row is now
what a `<Descriptions>` row is — a label cell (`"In stock"` / `"В наличии"` /
`"Disponibles"`, no placeholder; antd draws the colon) and a value cell holding
the number, `data-testid="listings-detail-stock"`. A host that overrode this
key must drop the `{count}` from its own copy.

**MODULE.md §4.1.** The composer's wiring example handed features in as
`features={features.data ?? []}` — the exact expression `stapel/
no-flattened-load-state` exists to refuse, published as the recommended way to
mount the screen. It now reads `loadStateFromQuery` → `loadedRowsOrEmpty` +
`isLoadLoading` / `isLoadFailed`, so "still loading", "this category asks
nothing" and "the schema read failed" stay three answers where the publish gate
can still tell them apart.
