---
"@stapel/orders-react": minor
---

`orders.add_to_cart` embeds into `page.actions` on `listings.detail` with
`routeProps: { purchasableKey: "id" }` and `props: { purchasableType: "listing" }`,
so a project with the listings pair gets the button on the listing page. The cart
and checkout nav entries use the shell's `ShoppingCartOutlined`. `manifest.json`
carries the pair's `testids`, and the pair ships `flows.json` (`stapel.flows/1`:
`cart` and `purchase`) for a preview walker, exported as `./flows.json`.
