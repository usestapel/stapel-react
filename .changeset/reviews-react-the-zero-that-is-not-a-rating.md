---
"@stapel/reviews-react": minor
---

New pair: `@stapel/reviews-react` — ratings and reviews of an opaque
`(target_type, target_key)`, with the four lies the contract makes easy
refused once, here, instead of being rediscovered per host.

- **A zero average is not a zero rating.** `GET /reviews/aggregate` answers
  `{"avg": 0.0, "count": 0}` for a target nobody has rated, and its own schema
  says so. `ratingSummary()` reports `rated: false` there — and has no `avg` on
  that branch of the type — so a star row cannot be drawn from it. Same class
  as `data ?? []`: a number that was never measured, displayed as if it had
  been measured and found to be the worst possible score.
- **"You have already reviewed this" is a 400.** It is
  `error.400.reviews_duplicate_review`, while the module's ONLY 409
  (`error.409.reviews_already_responded`) is about the seller's reply — so a
  form branching on the status misses the first and mishandles the second.
  Every refusal here is read by CODE. The optimistic pre-check
  (`findOwnReview`) exists and its hole is written down: the list is
  published-only, so under pre-moderation the author's own pending review is
  invisible to its author and the server is the one that says no.
- **A guest reads the reviews; only the write asks them to sign in.** Both
  reads are anonymous (`IsAuthenticatedOrReadOnly` on the list class — GET
  open, POST still needs an author to attribute the review to — and `AllowAny`
  on the aggregate, both throttled from the module's own settings). So
  `signInRequired` lives on the form bag alone, where a 401 is still the honest
  answer, and an empty list means what it says to everybody. Nothing new became
  visible to a guest: both endpoints were already published-only for a
  non-moderator.
- **A review that is not published says so.** `pending` / `hidden` rows carry a
  badge, a status this build does not know is named rather than rendered as an
  ordinary review, and the submit outcome reports the created row's status so a
  pre-moderating deployment can say "it will appear once checked".

The list envelope comes from codegen. `GET /reviews` returns core's
`AnchorPagination` envelope and always did, but `ReviewListCreateView`
instantiates its paginator inside `get()` instead of declaring a
`pagination_class`, so drf-spectacular used to render the response as a bare
array and its `anchor`/`limit`/`direction` parameters not at all.
stapel-reviews 0.3.0 declares both (`components/ReviewPage`, and `direction`
with an enum), so `ReviewPage`, `ReviewListParams` and `ReviewAnchorDirection`
are projections of the generated schema rather than copies this package
maintains.

The seller-level rating is a DISPLAY, not a fetch: reviews target the seller
for a specific listing, so a seller's rating is a roll-up the module cannot
compute (one `(target_type, target_key)` per call) and the shop composite can
(`shop.listing_review_summary` → `{avg, count}`, the owner's field names on
purpose). `<RatingBadge aggregate={…}>` renders those two numbers with no
request; publishing them over HTTP is the composite's job and is recorded as an
open gap rather than faked with an N+1 loop.

Surface: `createReviewsRuntime`/`ReviewsProvider`, three read/write hooks, the
pure `rating`/`list`/`refusals` readers, three headless bags, and an opt-in
`./default` antd skin (`ReviewsPanel`, `ReviewListPanel`, `ReviewFormCard`,
`RatingBadge`). en/ru/es, with the 9 module-owned error keys authored by the
pair because stapel-reviews ships no `translations/`. Pinned to stapel-reviews
0.3.0 (`>=0.3 <0.4`).

Not in scope, and not by omission: `POST {id}/moderate` and
`POST {id}/response` are both gated on the fail-closed `can_moderate` callback
and belong to a moderator console and a seller console; the reply is displayed
and the button to write one does not exist rather than existing switched off.
No nav manifest either — the pair renders inside somebody else's route.
`manifest.json` still lists the whole contract.
