---
"@stapel/listings-react": minor
---

`ListingDetailPane` renders the `page.actions` slot: `slots={{ "page.actions": … }}`
takes a node or a render function called with the page's route params (`{ id }`),
and draws it in the reader's buy box under the contact control
(`listings-detail-page-actions`). This is where other pairs' embeds scoped to
`listings.detail` land, such as `orders.add_to_cart`. The owner's buy box does not
draw it.
