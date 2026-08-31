---
"@stapel/categories-react": minor
---

**`<CategoryTileGrid>` takes an `entries` override, so the tile row can draw rows the carousel endpoint does not serve.**

The carousel bag answers exactly one question: which categories the operator put on the storefront's FRONT PAGE (`carousel_enabled`, `GET /categories/carousel/`). That is the only question a landing asks. A CATEGORY page asks a different one — what is inside this category — whose answer is `useCategoryTree()`'s children, already in the host's hand and not on the carousel endpoint at all. Without a way in, the second surface either re-implemented the tile geometry or drew the wrong rows, and `/c/transport` showed the same five tiles as the home page.

`entries?: readonly CarouselEntry[]` is that way in, and when it is given the component asks the server **nothing**: `<CategoryCarousel>` is not mounted, so the override costs no `GET /categories/carousel/` — the request a "swap the bag's data" implementation would still have fired and discarded. A test asserts that from the wire rather than from the rendered rows, which is the only place the difference shows.

An empty array is a real answer — a category with no children — and draws the same empty state a featureless carousel draws. There is no loading or failed arm for an override, deliberately: the host owns the fetch it drew these rows from, so it owns the two sentences that go with it, and handing this component a `LoadState` would give one load two owners.

`CarouselEntry` is now re-exported from `/default`. It was already part of a skin caller's vocabulary through `renderIcon`; `entries` makes the caller CONSTRUCT one, and reaching into the headless entry for a type you are handed and asked to hand back is a seam with a step in it.

No new i18n keys.
