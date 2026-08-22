# @stapel/listings-react

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
