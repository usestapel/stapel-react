---
"@stapel/reviews-react": minor
---

A seller's reviews, not only their number — and the module's own words for its
refusals. Pinned to stapel-reviews **v0.7.0**.

**The list has a second addressing.** `GET /reviews` takes `owner_key`
INSTEAD of the `(target_type, target_key)` pair: every review of everything one
owner owns, newest first, over the same `-created_at` anchor pagination and the
same rows. `useOwnerReviews(ownerKey, { targetType? })` is the hook,
`<ReviewListPanel owner={{ownerKey, targetType?}}>` and
`<ReviewsPanel owner={…}>` the skins, `<ReviewOwnerList>` the headless half.
The seller page's reviews tab is therefore one request per page — until now a
seller-wide RATING could be read (`useOwnerAggregates`, 0.6.0) and the reviews
it was computed from could not, so the only way to show them was one
target-addressed list per listing, an N+1 this pair refused to ship.

**Exactly one addressing, enforced by the compiler.** Naming both axes is the
new `error.400.reviews_ambiguous_addressing`, so `owner` and `target` are a
union whose unused arm is typed `never` (`ReviewListParams.ownerKey`,
`ReviewOwnerListParams.targetKey`): `<ReviewListPanel owner={…} target={…}>`
does not compile, and a refusal a host could earn by writing one extra prop
stays unreachable from a typed caller. `targetType` inside `owner` NARROWS the
list to one kind of target; it does not address anything.
`isAmbiguousAddressing` / `REVIEWS_ERROR_AMBIGUOUS_ADDRESSING` name the refusal
for the hand-built-request case that remains.

**One row renderer, both addressings.** Each row carries its own
`target_type`/`target_key`, so the reply composer under a row is addressed from
the ROW rather than from the pane — which is what lets the owner axis be a prop
instead of a second panel. `<ReviewsPanel owner={…}>` is the list and nothing
else: no rating line (that endpoint takes one target), no write form (a review
is written about a target and this address names none), no moderation queue
(`can_moderate` answers about one target). `reviews.list.empty_owner` is its
own sentence in all three locales, not the target arm's reworded — "be the
first to say how it went" is an invitation nobody can accept here, and an owner
nobody has reviewed is indistinguishable on the wire from a deployment that
registers no `owner_key_for` resolver, so the empty state claims nothing about
the cause.

**The refusals come from their owner.** stapel-reviews 0.7.0 ships
`translations/errors.ru.json` and `errors.es.json` for all twelve codes it
owns — codes that had no upstream text in any language. `gen:errors` reads the
module's own catalogue instead of standing stapel-core's in for it,
`stapel_reviews` leaves `ERRORS_LOCALE_EXEMPT_OWNERS`, both locale bundles
become complete `Record`s rather than `Partial`s, and the eleven hand-authored
duplicates in `src/i18n/{ru,es}.ts` are DELETED rather than kept beside the
generated ones: a key with two sources drifts and neither file could say which
of the two a screen had shown. `test/i18n.test.ts` gates the deletion over the
FILE, because a key-set check stays green with a duplicate back in place. (The
stapel-listings / stapel-categories precedent.)
