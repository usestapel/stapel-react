# @stapel/reviews-react — module guide

Pairs with **stapel-reviews 0.2.2** (`>=0.2 <0.3`), 4 paths under
`/reviews/api/v1/`. Contract sources: the module's own
`docs/{schema,errors,flows}.json`, pinned in `contract-pins.json` and
regenerated under `pnpm gen:check`.

## Layers

```
src/api/          reviewsApi.ts   the three operations a browser may call;
                                  the one home of path strings
                  types.ts        wire aliases + the four documented corrections
                  generated/      openapi-typescript, drift-gated
src/model/        runtime · context · queryKeys · queries · mutations
                  rating.ts       the aggregate, READ (the zero that is not a rating)
                  list.ts         pure readers over loaded rows
                  refusals.ts     the refusal vocabulary, keyed by CODE
src/headless/     ReviewsProvider · ReviewList · ReviewAggregate · ReviewForm
src/default/      the antd skin, `./default` subpath
src/i18n/         keys · ru · es · errorsMap + generated/
```

`rating.ts`, `list.ts` and `refusals.ts` are pure: no React, no fetch, no
storage. That is what lets the whole "what does this number mean" question be
tested without a DOM, and what lets an SSR render call them directly.

There is **no `flows/` layer** (`docs/flows.json` is `[]`, the module annotates
no `@flow_step`) and **no `nav/` layer** (this pair owns no route — see below).

## The four contract facts this package exists to absorb

### 1. The list body is the pagination envelope, not the declared array

`ReviewListCreateView` is a plain `APIView`. It instantiates
`ReviewAnchorPagination` inside `get()` rather than declaring a
`pagination_class`, so drf-spectacular describes the 200 as
`ReviewResponse[]` while the wire carries
`{items, next_anchor, prev_anchor, has_next, has_prev, count}`. Same cause,
same effect for `anchor` / `limit` / `direction`: undeclared, though
`target_type` / `target_key` / `include` were declared in 0.2.2.

`ReviewPage` and `ReviewListParams` (`api/types.ts`) are the hand-declared
shapes. Upstream ask: give the view a `pagination_class`, or declare the
envelope with `@extend_schema`.

Two properties of the paging are load-bearing:

- the anchor is a **`created_at` ISO timestamp**, because
  `anchor_field = "created_at"` and `ordering = "-created_at"`;
- `has_next` is the authority. The paginator leaves `next_anchor` `null` on the
  last page, so a cursor rebuilt from the last row would re-request it forever.

### 2. `avg` is `0.0` when `count` is `0`

`services.aggregate` returns exactly that, and `AggregateResponse` documents
it. `ratingSummary()` is the single reader, and its type has no `avg` on the
unrated branch — a skin cannot reach a number to draw there even by accident.
`starBreakdown(rounded, max)` then splits a real average into full/half/empty
counts against the DEPLOYMENT's ceiling, not a hardcoded five.

### 3. The duplicate refusal is a 400, and the 409 is about something else

| Code | Status | Means |
|---|---|---|
| `error.400.reviews_duplicate_review` | 400 | this author already reviewed this target |
| `error.409.reviews_already_responded` | 409 | the review already has the **owner's reply** |

`model/refusals.ts` holds a predicate per refusal, each comparing a
`FlowError.code` folded through core's `toFlowError`. `test/refusals.test.ts`
asserts both directions, so the trap is documented in the suite.

Note also that the duplicate only exists where the target type sets
`one_per_author: true` — the registry default is `False`
(`registry.resolve_policy`), and the shop preset turns it on for `listing`. No
endpoint reports the policy, so the client cannot pre-compute the rule; it
handles the answer.

### 4. Every endpoint is `IsAuthenticated`, including the two reads

A signed-out visitor gets 401 from the review list and from the aggregate. The
read hooks fire anyway — a client-side gate must not refuse what the server
would allow, and whether an anonymous session means a 401 here is a deployment's
business — but the refusal is surfaced as `signInRequired`, never as an empty
list. Upstream ask in `contract-pins.json`.

The hooks ARE gated on `useActiveSessionReady()`, which is a different
question: a read that races a bootstrapping session would report the 401 for
the length of the bootstrap.

## The target is two strings, and the pair invents neither

`target_type` is a key the host registered in `STAPEL_REVIEWS["TARGET_TYPES"]`
(built-ins: `{}`); `target_key` is an opaque host string the module stores and
groups by but never parses. Both are in every query key, because `target_key`
alone is not an identity — two registries can key different things with the
same string.

This package exports no target-type constants. `test/pair.test.ts` asserts the
absence.

## The seller roll-up

Product model (storefront spec fork F5): a review targets the SELLER for a
specific listing — `target_type: "listing"`, `unique(author, listing)` — and
the seller's rating is a roll-up across their listings. stapel-reviews cannot
compute it; the composite does, as `shop.listing_review_summary`, whose
`read()` answers `{avg, count}` in both local and remote mode *using the
owner's field names on purpose*.

`<ReviewAggregate target={…} aggregate={…}>` renders those two numbers with no
request. Known gap: no HTTP route publishes the roll-up today, so the host's
own backend must serve it.

## Not on the surface

| Operation | Why not |
|---|---|
| `POST /reviews/{id}/moderate` | `can_moderate` is fail-closed; a moderator console, which this pair is not |
| `POST /reviews/{id}/response` | same gate; the reply is DISPLAYED in the MVP and the write is a seller console (spec §4.4) |

Both remain in `manifest.json`, which lists the whole contract. Adding either
later is additive.

## Tests

| File | What it pins |
|---|---|
| `rating.test.ts` | the zero that is not a rating, in every arm; the projection shape reads the same |
| `refusals.test.ts` | 400 duplicate vs 409 already-responded; 401 vs 403; a non-API fault |
| `list.test.tsx` | the envelope, the `created_at` cursor, no page past `has_next`, 401 ≠ empty |
| `submit.test.tsx` | the request body, the duplicate as a named state, `pending` after submit, the bounds |
| `skin.test.tsx` | no star row for an unrated target, the moderated badges, sign-in vs empty, one list request for the composed panel |
| `i18n.test.ts` | every registry code and every UI key resolves in en/ru/es |
| `pair.test.ts` | query keys, the surface's absences (moderate/respond/nav/target constants), the logout hook |
| `demos.test.tsx` | every demo variant renders |
| `prodBundlePurity.test.ts` | no showcase/demo code in the tarball |
