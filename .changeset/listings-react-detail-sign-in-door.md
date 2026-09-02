---
"@stapel/listings-react": patch
---

`<ListingDetailPane>` takes `signIn` — the same `SignInCta` seam its three
card skins already take — and renders the container's sign-in door beside the
blocked favourite's reason. Measured on a live storefront: the pane's heart
said "sign in to do this" with the nearest sign-in a screen-corner away,
which is exactly the gap `signIn` closed on the cards.
