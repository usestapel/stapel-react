# @stapel/reviews-react

The frontend pair for **stapel-reviews**: ratings and reviews of an opaque
`(target_type, target_key)` — a listing, a seller, a course, whatever the host
registered — rendered without any of the four lies the contract makes easy.

Business + state in the main entry, zero visual opinion; the antd skin lives
behind `./default`. Built on `@stapel/core` (typed client + `StapelApiError`
envelope, `LoadState`, `ActionAvailability`, i18n engine, TanStack Query).

## Install

```
pnpm add @stapel/reviews-react @stapel/core @tanstack/react-query react
# for the default skin:
pnpm add antd @stapel/tokens-antd
```

## A review block, in eight lines

```tsx
import { createReviewsRuntime, ReviewsProvider } from "@stapel/reviews-react";
import { ReviewsPanel } from "@stapel/reviews-react/default";

const runtime = createReviewsRuntime({ baseUrl: "/reviews/api/v1" });

export function ListingReviews({ listingId, me }) {
  return (
    <ReviewsProvider runtime={runtime}>
      <ReviewsPanel
        target={{ targetType: "listing", targetKey: listingId }}
        viewerId={me?.id}
      />
    </ReviewsProvider>
  );
}
```

`<ReviewsPanel signIn={{ href: `/login?next=${here}` }}>` (and
`<ReviewFormCard>` directly) puts the door beside "sign in to leave a review":
the reads are anonymous, the POST is not, so the sentence is true at exactly
the moment it appears — and until 0.4.0 it dead-ended, because no pair took a
sign-in href. `signIn` is core's `SignInCta`, `{href}` **or** `{onSignIn}`,
the same prop `@stapel/chat-react` and `@stapel/listings-react` take. Omit it
and the sentence renders alone.

`"listing"` is **your** registry key, not this library's. stapel-reviews ships
an empty `TARGET_TYPES` registry and knows nothing about listings; the shop
composite registers that name in `stapel_shop/preset.py`. This package
therefore exports no target-type constants at all — a guessed one would be
wrong for every deployment but one.

## Four things this package refuses to get wrong

### 1. A zero average is not a zero rating

`GET /reviews/aggregate` answers `{"avg": 0.0, "count": 0}` for a target nobody
has rated — the module's own schema says so in the field description. Rendered
straight into a star row that is **the worst possible score**, printed over a
brand-new listing.

```ts
const summary = ratingSummary(aggregate);
summary.rated; // false — and there is no `avg` on this branch of the type
```

`<RatingBadge>` renders the "no reviews yet" sentence in that arm and never
reaches antd's `<Rate>`. Same class of defect as `data ?? []`.

### 2. "You have already reviewed this" is a **400**

```
error.400.reviews_duplicate_review   ← the duplicate
error.409.reviews_already_responded  ← the module's only 409, about the seller's REPLY
```

A form branching on `status === 409` misses the first and mishandles the
second. `isDuplicateReview(error)` reads the code, and the form turns it into
"you have already rated this" rather than a red banner. This one is still a
live trap in 0.3.0 — it is a documented shape, not a defect the release fixed.

The optimistic pre-check (`findOwnReview` over the loaded rows) exists, and its
hole is documented rather than papered over: the list is published-only, so
under pre-moderation the author's own pending review is invisible **to its
author**, the form offers itself again, and the server is the one that says no.

### 3. A guest reads the reviews; only the write asks them to sign in

Both reads are anonymous since **stapel-reviews 0.3.0**:
`ReviewListCreateView` is `IsAuthenticatedOrReadOnly` (GET open, POST still
needs an author to attribute the review to) and `AggregateView` is `AllowAny`,
both throttled from the module's own settings (`LIST_THROTTLE` 120/min,
`AGGREGATE_THROTTLE` 300/min). Nothing new became visible — both endpoints were
already published-only for a non-moderator.

So `signInRequired` exists on **one** bag, the form's. The read bags have no
such state, and an empty list now means what it says to everybody: nobody has
reviewed this target.

It is answered by the mandate axis BEFORE the click. A storefront that mints
anonymous accounts silently makes the visitor authenticated, so the 401 that
used to carry this stopped arriving — stapel-reviews refuses that session with
`ALLOW_ANONYMOUS_WRITES`' own **403 `error.403.reviews_anonymous_not_allowed`**
instead, because a review from an untraceable account is worthless as social
proof. `<ReviewForm>` therefore reads core's `MandateSource`: `anonymous` and
`guest` set `signInRequired` up front and send nothing, `asking` is a wait
(`reviews.submit.blocked.mandate_unknown`), and `unavailable` — which is also
what a host with no `<MandateProvider>` gets — leaves the form exactly as it
is. `isSignInRequired` reads both spellings of the refusal, so a request that
loses the race still lands on the door instead of a raw key.

The wall is the CLIENT half of `ALLOW_ANONYMOUS_WRITES`, and the two halves are
joined by the host rather than guessed here. A deployment that opens the server
switch also names `REVIEWS_ELEVATION_ACTIONS.write` (`"reviews.write"`) on its
`ElevationSource`; the `anonymous` arm then offers the form and the press mints
the account before the write. Name nothing — every host today — and `covers` is
`false`, the wall stands on both sides, and nothing mints. The `guest` arm is
not an elevation question: there is already an account, so the mandate axis
alone decides it.

> Against the 0.2.2 contract this pair carried the opposite: every endpoint was
> `IsAuthenticated`, a visitor got 401 for the list *and* the aggregate, and
> both read bags had to name that so the empty state would not tell a
> not-yet-registered visitor that a well-reviewed seller has never been
> reviewed. The ask went upstream instead of being worked around, and 0.3.0
> answered it.

### 4. A review that is not published says so

`status` reaches the screen: `pending` and `hidden` rows (visible only to a
moderator who asked for `include=all`) carry a badge, and a status this build
does not know is **named** rather than rendered as an ordinary review. After a
submit, the created row's status decides the sentence — a pre-moderating
deployment tells the author their review will appear once checked, instead of
leaving them to hunt for it.

## The list body, and where its type comes from

`GET /reviews` answers core's `AnchorPagination` envelope:

```jsonc
{ "items": [...], "next_anchor": "2026-08-19T10:00:00Z", "prev_anchor": null,
  "has_next": true, "has_prev": false, "count": 20 }
```

It always did — but `ReviewListCreateView` is a plain `APIView` that
instantiates its paginator inside `get()` instead of declaring a
`pagination_class`, so drf-spectacular's introspection never ran and the schema
declared `200: ReviewResponse[]`; the `anchor` / `limit` / `direction`
parameters were invisible for the same reason. **0.3.0 declares both**
(`components/ReviewPage`, and `direction` with an enum), so the copies this
package maintained in `src/api/types.ts` are **deleted** and `ReviewPage`,
`ReviewListParams` and `ReviewAnchorDirection` are all projections of the
generated schema.

Anchors are `created_at` timestamps (`anchor_field = "created_at"`,
`ordering = "-created_at"`), and paging stops on `has_next`, never on a
cursor rebuilt from the last row — the paginator leaves `next_anchor` `null`
on the last page.

## The seller rating is a display, not a fetch

The product model reviews the **seller for a specific listing**:
`target_type: "listing"`, one review per author per listing. A seller's own
rating is therefore a roll-up across every listing they own — which
stapel-reviews cannot compute (one `(target_type, target_key)` per call, and
`reviews.aggregates_by_keys` is a comm Function for server-side projections,
not an endpoint) and the shop composite can, as
`shop.listing_review_summary`.

So the pair renders the two numbers the composite produced:

```tsx
<RatingBadge
  target={{ targetType: "seller", targetKey: sellerId }}
  aggregate={rollup}          // {avg, count} — the projection's own field names
/>
```

No request is made. **The gap above is now partly closable from this pair
itself**, not only from a host composite: `useOwnerAggregates(ownerKeys,
{ targetType? })` (stapel-reviews 0.6.0, `POST /reviews/aggregates/by-owner`)
batch-reads up to 100 owners' `{avg, count}` roll-ups — across every target
each one owns — in one cached, chunked-transparently request, keyed on the
distinct sorted set of owner keys so a re-render with the same sellers never
refetches and an empty list never fetches at all. It answers ONLY for owners
the write path actually stamped: the ownership link is the review's own
`owner_key`, set by the target type's optional `owner_key_for` resolver, so a
deployment that has not registered one for `"listing"` gets an empty map back
and still needs the composite's `shop.listing_review_summary` roll-up above.
Where a deployment HAS registered the resolver, a page can skip the composite
entirely: fetch once with `useOwnerAggregates`, then feed each entry straight
into `<ReviewAggregate aggregate={…}>` exactly as `rollup` is supplied above —
same two field names, same `source: "supplied"`. One thing to get right at the
call site: an owner ABSENT from the map (nobody has rated them) must still be
SUPPLIED as `{avg: 0, count: 0}`, not left `undefined` — `<ReviewAggregate>`
only skips its own request when `aggregate` is a value, so an `undefined` for
an unrated owner falls through to a per-card fetch instead of the "no request"
path the batch read exists to give.

```tsx
<ReviewAggregate
  target={{ targetType: "seller", targetKey: sellerId }}
  aggregate={ownerAggregates[sellerId] ?? { avg: 0, count: 0 }}
>
  {(bag) => <YourStars bag={bag} />}
</ReviewAggregate>
```

## What is deliberately not here

- **Moderation and the owner's reply.** `POST {id}/moderate` and
  `POST {id}/response` are gated on the target type's **fail-closed**
  `can_moderate` callback and belong to a moderator console and a seller
  console. The reply is *displayed*; the button to write one does not exist,
  rather than existing switched off. Both operations stay in `manifest.json`,
  which lists the whole contract.
- **A nav manifest.** This pair has no route of its own — it renders inside the
  listing detail page and the public seller profile. A "Reviews" menu item
  leading nowhere would be worse than none (the `cdn-react` precedent), and a
  test asserts the absence.
- **A `flows/` layer.** `docs/flows.json` is `[]`; the module annotates no
  `@flow_step`.

## Rating bounds are the deployment's

`RATING_MIN` / `RATING_MAX` are `STAPEL_REVIEWS` settings (library defaults 1
and 5) and no endpoint reports them, so a host that moved them tells the
runtime:

```ts
createReviewsRuntime({ baseUrl: "/reviews/api/v1", ratingBounds: { max: 10 } });
```

The mirror is a UI affordance only — the star row draws that many stars — and
the server stays the authority (`error.400.reviews_invalid_rating`).

## i18n

English ships inline. `./i18n/ru` and `./i18n/es` are opt-in subpaths. There is
exactly one sign-in string left (`reviews.form.sign_in_required`) — the two
read-side ones went out with the 0.3.0 permission change. The 42
cross-cutting error keys come from stapel-core's catalogue through the
generated bundles; the **9 keys stapel-reviews owns are authored by this
package**, because the module ships no `translations/` directory (the
stapel-forms precedent). When upstream ships one, those nine lines are deleted
and nothing else moves.

## Surface

| Layer | Exports |
|---|---|
| api | `createReviewsApi`, `ReviewsApi`, `Review`, `ReviewPage`, `ReviewTarget`, `RatingAggregate`, `ReviewStatus`, … |
| model | `createReviewsRuntime`, `reviewsQueryKeys`, `useReviewList`, `useReviewAggregate`, `useOwnerAggregates`, `useSubmitReview`, `ratingSummary`, `starBreakdown`, `reviewsFromPages`, `findOwnReview`, `reviewVisibility`, `isDuplicateReview`, `isSignInRequired`, … |
| headless | `ReviewsProvider`, `ReviewList`, `ReviewAggregate`, `ReviewForm` |
| default | `ReviewsPanel`, `ReviewListPanel`, `ReviewFormCard`, `RatingBadge`, `ReviewsSkinTheme` |
| i18n | `REVIEWS_I18N_KEYS`, `registerReviewsI18n`, `REVIEWS_ERRORS`, `explainReviewsError` |

More detail: [`MODULE.md`](./MODULE.md), [`llms.txt`](./llms.txt),
[`manifest.json`](./manifest.json).
