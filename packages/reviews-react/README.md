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
"you have already rated this" rather than a red banner.

The optimistic pre-check (`findOwnReview` over the loaded rows) exists, and its
hole is documented rather than papered over: the list is published-only, so
under pre-moderation the author's own pending review is invisible **to its
author**, the form offers itself again, and the server is the one that says no.

### 3. A 401 is not an empty list

**Every** stapel-reviews endpoint is `IsAuthenticated`, including both reads.
A signed-out visitor on a public listing page gets 401 for the review list and
for the aggregate — and the empty state would tell exactly the people who have
not signed up yet that a well-reviewed seller has never been reviewed. Both
read bags carry `signInRequired` as a named state, and the skin says "sign in
to read the reviews".

> **Upstream ask.** Make `GET /reviews` and `GET /reviews/aggregate`
> `AllowAny` (or `IsNotAnonymousUser`, as stapel-cdn's upload endpoints already
> are) so a storefront can show its ratings to visitors. Recorded in
> `contract-pins.json`; the pair does not work around it, because a client
> cannot.

### 4. A review that is not published says so

`status` reaches the screen: `pending` and `hidden` rows (visible only to a
moderator who asked for `include=all`) carry a badge, and a status this build
does not know is **named** rather than rendered as an ordinary review. After a
submit, the created row's status decides the sentence — a pre-moderating
deployment tells the author their review will appear once checked, instead of
leaving them to hunt for it.

## The list body is not what the schema declares

`GET /reviews` declares `200: ReviewResponse[]` and returns core's
`AnchorPagination` envelope:

```jsonc
{ "items": [...], "next_anchor": "2026-08-19T10:00:00Z", "prev_anchor": null,
  "has_next": true, "has_prev": false, "count": 20 }
```

`ReviewListCreateView` is a plain `APIView` that instantiates its paginator
inside `get()` instead of declaring a `pagination_class`, so drf-spectacular
never learns about it — and for the same reason the `anchor` / `limit` /
`direction` query parameters are undeclared too, while `target_type` /
`target_key` / `include` (added in 0.2.2, the release that unblocked this pair)
now are. `ReviewPage` and `ReviewListParams` in `src/api/types.ts` are the
hand-declared shapes, with the upstream ask beside them.

Anchors are `created_at` timestamps (`anchor_field = "created_at"`,
`ordering = "-created_at"`), and paging stops on `has_next`, never on a
cursor rebuilt from the last row.

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

No request is made. **Known gap**: today no HTTP route publishes that roll-up,
so a page that wants a seller rating must be served the two numbers by its own
backend. Publishing them is the composite's job, not this pair's, and inventing
an N+1 loop over the seller's listings here would be neither correct nor
affordable.

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

English ships inline. `./i18n/ru` and `./i18n/es` are opt-in subpaths. The 42
cross-cutting error keys come from stapel-core's catalogue through the
generated bundles; the **9 keys stapel-reviews owns are authored by this
package**, because the module ships no `translations/` directory (the
stapel-forms precedent). When upstream ships one, those nine lines are deleted
and nothing else moves.

## Surface

| Layer | Exports |
|---|---|
| api | `createReviewsApi`, `ReviewsApi`, `Review`, `ReviewPage`, `ReviewTarget`, `RatingAggregate`, `ReviewStatus`, … |
| model | `createReviewsRuntime`, `reviewsQueryKeys`, `useReviewList`, `useReviewAggregate`, `useSubmitReview`, `ratingSummary`, `starBreakdown`, `reviewsFromPages`, `findOwnReview`, `reviewVisibility`, `isDuplicateReview`, `isSignInRequired`, … |
| headless | `ReviewsProvider`, `ReviewList`, `ReviewAggregate`, `ReviewForm` |
| default | `ReviewsPanel`, `ReviewListPanel`, `ReviewFormCard`, `RatingBadge`, `ReviewsSkinTheme` |
| i18n | `REVIEWS_I18N_KEYS`, `registerReviewsI18n`, `REVIEWS_ERRORS`, `explainReviewsError` |

More detail: [`MODULE.md`](./MODULE.md), [`llms.txt`](./llms.txt),
[`manifest.json`](./manifest.json).
