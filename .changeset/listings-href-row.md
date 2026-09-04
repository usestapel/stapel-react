---
"@stapel/listings-react": minor
---

listings: href builders receive the whole row, and a reopened listing reads its own draft twin

**`listingHref` and `hrefFor` now receive the row as a second argument.** A
storefront that addresses listings as `/l/<id>-<title-slug>` had only an id to
build from — no slug, and the page had to repair the URL with a
`history.replace` after the fact. `MyListingsPane`'s `listingHref` and
`FavoritesPane`'s `hrefFor` are now called as `(id, row) => href`, `row` being
the same card the cabinet row or the favourite grid renders from, `title`
guaranteed present. `(id) => href` still works unchanged — the id stays the
first argument.

**Reopening a listing reads its own draft twin.** `GET /{pk}/draft/`
(stapel-listings 0.21.1, owner-only) answers the exact `save-draft` response
shape, closing a gap this pair's own composer named as impossible: no read
returned the `*_draft` fields, so a draft abandoned mid-edit came back empty
and a live listing's edit seeded from the published half instead of whatever
was last typed. `useListingComposer` now tries the draft read first and falls
back to the published-half seed only when it 404s — nothing was ever saved,
or the backend predates the route.
