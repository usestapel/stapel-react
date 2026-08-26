# @stapel/reviews-react

## 0.4.0

### Minor Changes

- 80617e9: The moderation queue and the seller's reply exist on a screen. The default
  skins are the product, so they are now in the showcase.

  stapel-reviews has shipped `POST {id}/moderate` and `POST {id}/response` since
  0.1 — a hide/publish verdict with an emitted fact, and the target owner's
  single reply. This pair documented their absence as a scoped boundary ("they
  belong to consoles this pair does not ship"), and the fleet consequence was
  that no user anywhere could reach either: the backend shipped, the console did
  not. Both are wired now, and the argument for omitting them turns out to be the
  argument for including them — the `can_moderate` callback is **fail-closed**, so
  the server is the authority and a mis-offered control costs a 403, not a leak.
  What the client owes is the other half: the control is never offered blindly,
  and where the host has not armed it, it renders switched off **with its reason
  beside it** rather than removed. A seller whose ownership callback is mis-wired
  now sees a bug report instead of a page that quietly has no reply button.

  - **`ReviewModerationPanel`** — the queue. Every row badged with the state it is
    in, both verdicts gated on where that row stands (re-applying a state is an
    upstream no-op that answers 200, so "Already hidden" is said _before_ the
    click instead of a button that appears to do nothing), a moderation reason
    that rides into the fact and is shown to nobody, and a confirmation on hide
    because hiding also removes the review from the rating — a bottom sheet on a
    phone via `SkinConfirm`, never a `Popconfirm`.
  - **`ReviewResponseComposer`** — the reply, shown and written by the same
    component, because on the page they are one thing. The one-shot rule is
    stated while the box is still empty: the module stores at most one `Response`
    and ships no endpoint that edits or deletes it, so a composer that discovered
    that afterwards would be a text box that silently turns out to have been the
    last word. An empty reply is blocked client-side — `RespondRequest.body`
    defaults to `""`, so the server would store a blank reply and then refuse
    forever to replace it.
  - **`include: "all"` stops lying by omission.** The view narrows a
    non-moderator's request to published-only with no error and no marker in the
    body, so a host that passed the prop to the wrong viewer got a quietly
    incomplete list. `ReviewListBag.scope` now separates what was _requested_
    from what can be _vouched for_ — `granted: "all"` only when a non-published
    row is actually on screen, which is proof — and the skin prints the sentence
    when nothing proves the grant.
  - **Reviews have dates.** `renderDate` was a slot, and the result was a review
    list with no dates in it anywhere the host had not written a formatter. The
    pair ships a short absolute date in the reader's locale
    (`formatReviewDate` / `useReviewDateFormat`); the slot survives on top for a
    host that wants relative time.
  - **The count is a plural.** `reviews.rating.count` was one flat string, so
    English said "1 reviews" and Russian dodged it by putting the numeral last.
    It is a CLDR family now (`REVIEWS_I18N_PLURALS`, through core's `tPlural`),
    with the paucal Russian actually needs.
  - **On the shared substrate.** The pair's own `theme.tsx` and `ErrorAlert.tsx`
    are deleted in favour of `@stapel/tokens-antd/skin`'s `SkinTheme`,
    `ErrorAlert`, `EmptyState`, `LoadList`/`LoadBoundary`, `GatedButton` and
    `SkinConfirm` — so the reactive-mode fix, the 44px phone control height and
    the designed empty state arrive here instead of being re-decided. Zero
    hardcoded dimensions; every gate reason is visible text with the control's
    `aria-describedby` pointing at it, never a tooltip on a control that cannot
    fire one.
  - **The showcase renders the product.** All seven `/default` exports have a
    skin demo at phone _and_ desktop with distinct seeded states; the debug
    harness (`DemoCard`, `StepBadge`) that rendered a state dump in place of
    every screen is deleted, and demo fixtures carry prose instead of i18n keys
    that used to print as the text of a review.

  **Breaking (pre-1.0 minor):** `ReviewsSkinTheme` and this pair's `ErrorAlert`
  are no longer exported from `./default` — import `SkinTheme` / `ErrorAlert`
  from `@stapel/tokens-antd/skin`. `REVIEWS_I18N_KEYS.ratingCount` moved to
  `REVIEWS_I18N_PLURALS.ratingCount` and is resolved with `tPlural`, not `t`.
  Peer floors rise to `@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`.

## 0.3.2

### Patch Changes

- d778c54: The rating's absence and the review list's absence are no longer the same
  sentence.

  `reviews.rating.none` and `reviews.list.empty` both read "No reviews yet" in
  every catalogue, and both render on any page that mounts the aggregate above
  the list — a client storefront's listing page printed the identical words
  twice, forty pixels apart, which reads as a rendering bug rather than as two
  facts. The aggregate now says "No rating yet" / «Оценок пока нет» /
  "Todavía no hay valoración".

## 0.3.1

### Patch Changes

- The floor states what the imports already require: `@stapel/core >=0.16.0`

  `SignInCta` and `SignInCtaProp` first shipped in `@stapel/core@0.16.0`, and
  this package has imported them since. The declared peer floor still said
  `>=0.15.0`, which npm would have honoured — installing a core with no such
  exports, and failing the host's typecheck on symbols this package's own
  `.d.ts` references.

## 0.3.0

### Minor Changes

- 3e2e2a3: A blocked control now carries the door, not just the reason: `signIn`

  `actionBlocked` ended the grey-rectangle incident by making every switched-off
  control state its reason. It did not end the next one. "Sign in to save this",
  "sign in to leave a review", "sign in to message the seller" are reasons whose
  next action is a LINK, and no pair took one — so the storefront had to put its
  own notice a screen away from each of the three controls it was about, and
  named it a gap rather than shipping it (Wave D, G-3).

  All three now take the same prop, core's `SignInCta`:

  ```tsx
  <ListingCard listing={row} signIn={{ href: `/login?next=${here}` }} />
  <ReviewsPanel target={target} signIn={{ href: `/login?next=${here}` }} />
  <StartChatButton sellerId={sellerId} signIn={{ onSignIn: () => openModal() }} />
  ```

  `{href}` **or** `{onSignIn}`, never both. Omit it and the reason renders alone,
  with no trailing whitespace where the link is not — a host with no sign-in
  route is a supported host.

  Two more things each pair had to fix to make the door reachable:

  - **listings**: the favourite's reason lived only in a `title` on a DISABLED
    button, which receives no pointer events in any browser — core's own
    `actionGate.ts` calls that "a reason nobody can read". It is now text beside
    the heart (`listings-card-favorite-blocked`), with the link inside it. The
    heart is still never hidden from a visitor.
  - **chat**: `StartDirectChat` had no mandate gate at all, so a visitor could
    press "message the seller" and collect a 401 — a refusal delivered at the one
    moment it is useless. The axis is now the first arm of its `firstBlock`, read
    through core's `MandateSource` seam. `member` may write; `guest`/`anonymous`
    are told to sign in; `asking` says we are still asking. `unavailable` stays
    AVAILABLE on purpose: that is what core answers outside a `<MandateProvider>`
    too, and a host that never wired the axis must not lose its button — "we
    could not ask" is not "you may not". This raises chat-react's `@stapel/core`
    floor to `>=0.15.0`, where `useMandate`/`matchMandate` shipped.

  The link's LABEL is each pair's own (`listings.card.sign_in`,
  `reviews.form.sign_in`, `chat.start.sign_in`), in all three locales — core
  floors `en` and `ru`, and these pairs also ship `es`.

## 0.2.0

### Minor Changes

- 23eeaff: New pair: `@stapel/reviews-react` — ratings and reviews of an opaque
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
