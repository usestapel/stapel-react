# @stapel/reviews-react — module guide

Pairs with **stapel-reviews 0.3.0** (`>=0.3 <0.4`), 4 paths under
`/reviews/api/v1/`. Contract sources: the module's own
`docs/{schema,errors,flows}.json`, pinned in `contract-pins.json` and
regenerated under `pnpm gen:check`.

## Layers

```
src/api/          reviewsApi.ts   the three operations a browser may call;
                                  the one home of path strings
                  types.ts        wire aliases + the two remaining corrections
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

## What 0.3.0 changed here

This pair was built against 0.2.2 and carried two workarounds for it. **Both
are deleted**, because the release answered both asks:

| Was | Now |
|---|---|
| `ReviewPage`, `ReviewListParams`, `ReviewAnchorDirection` hand-declared in `api/types.ts` | projections of `components/ReviewPage` and the generated `reviews_api_v1_reviews_retrieve` query type |
| `signInRequired` on the list bag, the aggregate bag and the form bag; two sign-in arms in the skin; `reviews.list.sign_in_required` + `reviews.rating.sign_in_required` | `signInRequired` on the **form bag only**; one sign-in key (`reviews.form.sign_in_required`) |

The permission change is `IsAuthenticatedOrReadOnly` on the list class
(mirroring stapel-listings' `ListingViewSet`: GET open, POST still needs an
author) and `AllowAny` on the aggregate, both with
`stapel_anonymous_access = ANONYMOUS_ALLOWED` and both throttled from
`STAPEL_REVIEWS` (`LIST_THROTTLE` 120/min, `AGGREGATE_THROTTLE` 300/min) rather
than the project's `DEFAULT_THROTTLE_RATES`. Nothing new became visible to a
guest: both endpoints were already published-only for a non-moderator.

## The sentence and the door

`signInRequired` is true at exactly the right moment — the reads are anonymous
and the POST is not, so the author learns it when there is something to attach
to a name. It is now true BEFORE the click as well: the mandate axis answers
`anonymous` or `guest` and the form says so instead of letting a review be
typed that cannot land. The post-hoc arm stays as the net, and reads two
spellings of the same refusal — 401 for a visitor with no session, 403
`error.403.reviews_anonymous_not_allowed` for the account a storefront minted
for them. Whether the wall stands for a stranger at all is the host's call, not
this pair's: `REVIEWS_ELEVATION_ACTIONS.write` is the client half of
`ALLOW_ANONYMOUS_WRITES`, and a deployment that opens the server switch names
the action too. What it did not have was a next action: the skin printed "sign in to
leave a review" and stopped, and the storefront had to put its own notice a
screen away from the control it was about (Wave D, G-3).

`<ReviewFormCard signIn={…}>` (and `<ReviewsPanel signIn={…}>`, which passes it
down) renders the link INSIDE the element that carries the sentence.
`SignInCta` is core's — `{href}` or `{onSignIn}`, never both — so the prop is
spelled identically in `@stapel/chat-react` and `@stapel/listings-react`; the
LABEL is this pair's (`reviews.form.sign_in`, all three locales), because core
floors only `en` and `ru`. Omitted, the sentence renders alone and carries no
trailing whitespace where the link is not.

## The three contract facts this package still absorbs

### 1. The list body is the pagination envelope — now declared

`ReviewListCreateView` is a plain `APIView` that instantiates
`ReviewAnchorPagination` inside `get()` rather than declaring a
`pagination_class`, so drf-spectacular's pagination introspection never runs.
0.3.0 works around its own limitation the right way — a hand-written
`ReviewPageSerializer` plus explicit `OpenApiParameter`s — so the CONTRACT now
tells the truth and this package types the envelope from codegen.

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

### 4. The reads are anonymous — and the session gate matters MORE for it

The hooks are still gated on `useActiveSessionReady()`, and the reason got
stronger with the permission change rather than weaker. What the server returns
depends on who is asking: a moderator of the target gets pending and hidden
rows for `include=all`, everyone else is narrowed to published *silently*. A
read that raced a bootstrapping session used to produce a visible 401; now it
would SUCCEED as a guest and cache that answer under a key that does not
mention identity. `useActiveSessionReady()` answers `true` the instant the
session settles into any of authenticated / anonymous / unauthenticated, and
immediately when no session-owning module is mounted — so a purely public
storefront waits for nothing.

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
| `refusals.test.ts` | 400 duplicate vs 409 already-responded; the write's 401 vs 403; a non-API fault |
| `list.test.tsx` | the envelope, the `created_at` cursor, no page past `has_next`, the anonymous read and its reachable empty state |
| `submit.test.tsx` | the request body, the duplicate as a named state, the 401 the write still answers, `pending` after submit, the bounds |
| `skin.test.tsx` | no star row for an unrated target, the moderated badges, a guest seeing rows with no sign-in wall, "sign in to leave a review" on a 401 POST, one list request for the composed panel |
| `i18n.test.ts` | every registry code and every UI key resolves in en/ru/es |
| `pair.test.ts` | query keys, the surface's absences (moderate/respond/nav/target constants), the logout hook |
| `demos.test.tsx` | every demo variant renders |
| `prodBundlePurity.test.ts` | no showcase/demo code in the tarball |
