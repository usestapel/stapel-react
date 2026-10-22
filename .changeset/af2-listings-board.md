---
"@stapel/listings-react": minor
---

`<ListingBoardPane>` and `useListingBoard`: the public board, paged, narrowed to categories (`categoryIds`, sent as `?category_id=`, stapel-listings 0.27.0). It is the default grid for `CategoryPage`'s `renderListings` on a deployment without the search module. `ListingsApi.list` takes `ListingBoardParams`. Contract pin to stapel-listings 0.27.0.
