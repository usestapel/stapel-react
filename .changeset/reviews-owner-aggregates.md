---
"@stapel/reviews-react": minor
---

New hook `useOwnerAggregates(ownerKeys, { targetType? })`, backed by
stapel-reviews 0.6.0's `POST /reviews/aggregates/by-owner`: batch-reads the
rating of up to 100 sellers (or whatever a deployment's `owner_key_for`
resolver names) in one cached, transparently-chunked request. The query key
is the distinct, sorted set of owner keys — reordering or duplicating the
input never refetches — and an empty key set makes no request at all.

This is a real, if partial, answer to the gap this pair's own docs used to
record as unfillable without a host composite: where a deployment resolves
`owner_key_for` for a target type, a page can now fetch every visible
seller's roll-up in one call and feed each entry straight into
`<ReviewAggregate aggregate={…}>` — same two field names, same
`source: "supplied"`, no per-card request. The composite path
(`shop.listing_review_summary`) still exists and is still needed for any
deployment that has not wired the resolver.

New error `error.400.reviews_too_many_owner_keys` (`isTooManyOwnerKeys`,
`{max}`) — unreachable through the hook itself, since it chunks at the
backend's own ceiling, but reachable by a direct `ReviewsApi.aggregatesByOwner`
caller that builds its own request.

Regenerated against stapel-reviews 0.6.1 (a same-day docs-only fix on top of
0.6.0 — the endpoint's path follows the module's own URL style).
