# @stapel/listings-react

## 0.4.0

### Minor Changes

- 8b96c58: **«Мои объявления» has rows.** The dashboard's biggest named hole, closed at both ends.

  `GET /listings/` answers `published()` and takes no owner parameter, so a seller's own DRAFTS were unreachable by any call the contract offered. This pair recorded the gap rather than papering over it — an injected `MyListingsSource`, and a NAMED failure when a host had not wired one, because "we cannot ask" and "you have no listings" are different sentences. **stapel-listings 0.7.0** answers it with `GET my/listings/`: the caller's own rows in every status, `?status=` for a set, the same `IDAnchorPagination` envelope the other two owner reads use. The pin moves `v0.6.1 → v0.7.0` and the generated surfaces with it (13 paths, 64 error codes).

  - **`ListingsApi.myListings(params)`** — one keyset page of the caller's own listings. `params.status` is a SET of lifecycle statuses (a dashboard tab is one), sent as a single comma-separated value; omit it for all nine.
  - **`defaultMyListingsSource(api)`** is what `useMyListings` runs on now, narrowed per tab from `MY_LISTINGS_TAB_STATUSES` — the SERVER's own groupings, so a tab's rows and its `my/counters` badge cannot describe different sets. `MyListingsSource` survives as a seam for a deployment that keeps its rows elsewhere.
  - **`MyListingCard` / `PaginatedMyListingCards`** — the owner's row: the public card plus `moderation_status` and the `*_draft` twins. The pane no longer passes `"approved"` as a stand-in for the second axis, so a LIVE listing whose edit is under review finally says so on the dashboard — the one combination 0.5.0 made possible and `status` alone cannot express.
  - **`model/mine.ts`** (`myListingTitle` / `myListingPrice` / `myListingImages` / `showsDraft`) — the published value when there is one, the draft twin otherwise, in one place. Without it the drafts tab is a column of blank rows: `title`/`price`/`images` are the PUBLISHED fields and stay empty until a publish promotes them. A row showing its draft says which it is showing.
  - **`MY_LISTINGS_UNTABBED_STATUSES`** and a takedown block above the tabs. `blocked` is counted by `my/counters` in no tab at all, so folding it into one would make a badge and its rows disagree and leaving it out would hide the listing whose owner most needs to know. The pane fetches it beside the tabs; "no takedowns" and "we could not check" are told apart.
  - **Per-tab empty states** — "no drafts" and "nothing sold yet" are different sentences.
  - Every status-moving write now invalidates the owner's ROWS as well as the counters (`listingsQueryKeys.allMine()`); invalidating one and not the other is the shape of the bug where the badge says 2 and the tab shows 3.

  **Breaking (0.x minor):** `MY_LISTINGS_SOURCE_MISSING` and the `listings.mine.source_missing` i18n key are **removed**. There is no failure state left to name — a missing source is no longer possible — and keeping the export would have been a comment about something that no longer happens. `useMyListings().rows` is likewise never `failed` for a wiring reason; `MyListingsBag` gains `blockedRows`.

  The 0.6.1 → 0.7.0 span also carries 0.6.2's two authorization fixes, which retire upstream asks 3 and 4: `PUT`/`PATCH` now pass `_get_own`, and `GET /{pk}/` resolves through `visible_to`, so a stranger's draft 404s instead of answering 200. The pair's `publiclyVisible` report stays — it is now addressed at the one reader who still reaches an unpublished listing there, its owner.

## 0.3.1

### Patch Changes

- 67793b0: The stock row printed `{count}` at a buyer, and the wiring snippet taught the
  banned idiom

  Two things the live storefront walk found, both of them the shape of a
  sentence rather than a bug in behaviour.

  **`<ListingDetailPane>`'s stock row.** `listings.detail.stock` was a whole
  sentence — `"В наличии: {count}"` — used as a `<Descriptions.Item>` LABEL, with
  the quantity in the value cell beside it. antd renders the label as written, so
  the page said `В наличии: {count}: 3`: a raw placeholder in front of a shopper,
  on the one row that tells them whether the thing is in stock. The row is now
  what a `<Descriptions>` row is — a label cell (`"In stock"` / `"В наличии"` /
  `"Disponibles"`, no placeholder; antd draws the colon) and a value cell holding
  the number, `data-testid="listings-detail-stock"`. A host that overrode this
  key must drop the `{count}` from its own copy.

  **MODULE.md §4.1.** The composer's wiring example handed features in as
  `features={features.data ?? []}` — the exact expression `stapel/
no-flattened-load-state` exists to refuse, published as the recommended way to
  mount the screen. It now reads `loadStateFromQuery` → `loadedRowsOrEmpty` +
  `isLoadLoading` / `isLoadFailed`, so "still loading", "this category asks
  nothing" and "the schema read failed" stay three answers where the publish gate
  can still tell them apart.

  **The peer floor states what the imports already require.** `LinkComponent`,
  `SignInCta` and `SignInCtaProp` first shipped in `@stapel/core@0.16.0`, and
  this package has imported them since; the declared floor still said
  `>=0.15.0`. It now reads `>=0.16.0 <1.0.0`.

## 0.3.0

### Minor Changes

- 88a8be4: The composer's category seam runs in both directions, so `/new` can be mounted

  A seam that only goes one way is not a seam. `ListingComposerPage.categorySlot`
  was a `ReactNode`, and the composer's category moves only through
  `bag.setCategory` — which a node handed in from outside cannot reach. There was
  no `onCategoryChange` either, so a container could neither set the category nor
  learn it, and `features` — the schema OF the chosen category, the entire reason
  the slot exists — was unreachable rather than withheld. The screen rendered and
  could not be used; the storefront named it a gap instead of shipping it (Wave
  D, G-1).

  Two ways in, and `categorySlot` keeps rendering (deprecated, nothing breaks):

  ```tsx
  <ListingComposerPage
    category={categoryId === null ? "" : String(categoryId)}
    onCategoryChange={(id) => setCategoryId(id === "" ? null : Number(id))}
    renderCategoryPicker={({ value, setCategory }) => (
      <CategoryPickerField
        value={value === "" ? null : Number(value)}
        onChange={(id) => setCategory(id === null ? "" : String(id))}
      />
    )}
    features={features.data ?? []}
    featuresLoading={features.isPending}
    featuresError={features.error ?? undefined}
  />
  ```

  `renderCategoryPicker({ value, setCategory })` is the render-prop shape
  `<CategoryPage renderListings>` already uses in the sibling pair. `category` /
  `onCategoryChange` make the hook controlled on that one field, for the
  container that holds the id anyway — it must, because
  `useCategoryFeatures(id)` is keyed by it. `onCategoryChange` fires either way:
  it is the wire the schema read is asked for on.

  `useListingComposer` takes the same two options, so a host with its own skin
  gets the same seam.

  The README's example is now the wiring that works, and
  `test/composerCategorySeam.test.tsx` gates it against the props declaration —
  this pair documented `<MediaGalleryField bag={…}>` for a whole release while
  the package had no such prop, and nothing in the suite could tell.

- 9230f5f: `<ListingCard>`: one click, one navigation — and a `<Link>` it can be handed

  `href` and `onOpen` were two optional props and the card rendered BOTH when
  both were given: the handler ran, the container routed, and the browser then
  followed the anchor still sitting on the button. Two navigations for one click.
  The storefront's workaround was `onOpen` alone, which cost the most linkable
  element in the app its anchor — no middle-click, no "open in new tab", nothing
  for a crawler to follow (Wave D, G-2).

  `ListingCardOpenProps` is now a union with three arms and no fourth:

  ```tsx
  <ListingCard listing={row} href={`/l/${row.id}`} />                       // an anchor
  <ListingCard listing={row} href={`/l/${row.id}`} linkComponent={Link} />  // the host's <Link>
  <ListingCard listing={row} onOpen={(id) => navigate(`/l/${id}`)} />       // a button
  <ListingCard listing={row} />                                            // no open control
  ```

  Passing `href` and `onOpen` together no longer typechecks, and neither does a
  `linkComponent` on the callback arm — `linkComponent` IS the link.

  `linkComponent` is `@stapel/core`'s `LinkComponent`, a component taking a plain
  `href`, so this pair stays router-agnostic and a container keeps a real anchor
  while the click stays inside the SPA:

  ```tsx
  const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
  ```

  `<FavoritesPane>` takes the same union one level up (`hrefFor` / `onOpen` /
  `linkComponent`), so a pane cannot re-introduce upstream what the card refuses.

  Breaking only for a caller that passed both props — which is the defect this
  release removes, and which had no correct behaviour to preserve.

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

- fcc9f1e: Two axes, both on screen — the storefront's long pole

  `@stapel/listings-react` is the pair for stapel-listings: the listing page, the
  submission flow, the seller's dashboard, and favourites.

  The module has two independent state axes and 0.5.0 made them genuinely
  diverge. `status` decides whether anyone can see a listing and nothing else
  does; `moderation_status` decides nothing about that. Editing a LIVE listing
  keeps `status: published` and moves only the moderation axis, so "published,
  and we are reviewing your changes" is a real state — one a dashboard that
  derived either field from the other could not say, because it would either
  hide a listing buyers are reading or never tell its owner their edit is being
  screened. `model/status.ts` produces both halves of the sentence from both
  fields, once; the 9 × 4 table is asserted.

  A publish refusal is per-field and arrives in an unusual envelope: an invalid
  draft comes back as a BARE `ValidationBatchResult`, while a promotion that
  fails afterwards comes back as the ordinary one. `publishRefusal` branches on
  the body rather than the status, and `featureErrorsBySlug` adds the `field`
  the fleet's routing convention reads — so "this box is wrong" never degrades
  into "something is wrong".

  Three contracts meet on the composer and none of them is an import. L2 pairs do
  not import each other, so the gallery arrives as a two-member structural bag
  (`@stapel/cdn-react`'s `refs` IS `images_draft`; its `settled` is the submit
  gate), the category schema as a plain `FeatureDef[]`, and a stored CDN
  reference through a host-supplied resolver — because no contract in this fleet
  resolves a stranger's reference, and inventing `${cdnBase}/${ref}` would be
  writing a contract nobody agreed to. `@stapel/attributes-react` is a real
  dependency; it is L0, and it owns the editors, the mirror and the formatter.

  Four things the pair says out loud rather than papering over:

  - **there is no owner-scoped list endpoint.** `GET /listings/` answers
    `published()` and takes no owner parameter, so a seller's drafts are
    unreachable. The counters are real and are shown; the rows come from an
    injected source, and with none the dashboard reports a NAMED failure instead
    of an empty grid;
  - **no read returns the `*_draft` twin**, so an abandoned draft reopens empty
    and the composer says so. Editing a live listing is unaffected — the
    published half IS the listing;
  - **`PUT`/`PATCH` skip the ownership check** that every other owner operation
    in the module performs, so they are absent from `ListingsApi`;
    `save-draft` does the same write with the check;
  - **`GET /{pk}/` has no `published()` filter**, so a draft answers 200 to
    anyone with the id. The pane reports it instead of dressing a draft up as a
    shop page.

  Also here: the card another pair renders (badges formatted from the stored DAO
  projection, so a grid of forty costs one query and no category read); a soft
  delete that reads as "this listing was removed" rather than as a typo, using
  the AllowAny status probe that still answers for it; favourites (owner verdict
  F7) with the heart blocked-and-explained for a visitor rather than hidden; and
  ru/es carrying the UI copy, not only the error keys, because the storefront is
  ru-first and a half-translated submission form is visible immediately.

  Generated against stapel-listings **0.6.1** — the release that fixed
  `FeatureDto`/`FeatureDao`'s `discriminator.mapping` from one bogus `"null"`
  entry to the ten type slugs, which is what makes the generated union usable as
  the wire type at all.
