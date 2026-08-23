# @stapel/listings-react — module guide

Pairs with **stapel-listings 0.6.1** (`>=0.6 <0.7`), 12 paths under
`/listings/api/v1/`. Contract sources: the module's own
`docs/{schema,errors,flows}.json`, pinned in `contract-pins.json` and
regenerated under `pnpm gen:check`.

## Layers

```
src/api/        listingsApi.ts   the 14 operations a storefront calls; the one home of path strings
                types.ts         wire aliases + the one hand-mirrored shape (the stored DAO)
                generated/       openapi-typescript, drift-gated
src/model/      status.ts        the two axes → one caption, 9 × 4, asserted
                transitions.ts   the server's whitelist, mirrored (UX only; the 409 is the verdict)
                draft.ts         the *_draft twin ↔ the composer's values
                features.ts      the stored DAO projection → what attributes-react formats
                validation.ts    the mirror, and the split of the two publish 400s
                mineSource.ts    THE GAP: no owner-scoped list endpoint exists
                runtime · context · queryKeys · queries · mutations
src/flows/      registry.ts      zero-flow shim (the module annotates no @flow_step)
src/headless/   ListingsProvider · ListingDetail · ListingComposer · MyListings
                Favorites · ListingActions · useMandateGate
src/default/    the antd skin, `./default` subpath
src/i18n/       keys · ru · es · errorsMap + generated/
src/nav/        manifest.ts
```

Everything in `model/` except the hooks is pure — no React, no fetch — which
is what lets the status table, the draft conversions and the mirror be tested
without a DOM, and what lets an SSR render call them directly.

## 1. Two axes, and the divergence 0.5.0 introduced

`status` (nine states) is the lifecycle and the ONLY thing that decides public
visibility: `Listing.objects.published()` filters on it alone,
`INDEXED_STATUSES` is `{published}`, and the model says so out loud ("no
visibility-reads-moderation_status coupling", `models.py`).
`moderation_status` (four states) is the content verdict and decides nothing
about visibility.

```
first publication       status draft   → PENDING,   moderation → pending
                        nothing public until a verdict arrives

editing a LIVE listing  status published (UNCHANGED), moderation → pending
                        the edit is visible immediately; a rejecting verdict
                        later lands as PUBLISHED → BLOCKED
```

`model/status.ts` produces both halves of the sentence from BOTH fields, once.
`test/status.test.ts` walks all 36 combinations, and names the four that look
contradictory. `liveUnderReview` is a named boolean rather than an inference a
caller repeats.

The moderation axis is shown to the OWNER and to nobody else: a buyer has no
use for "changes under review", and showing a stranger that a listing was
refused would leak a verdict about someone else's content.

## 2. Contract deltas — what the schema does not say

### 2.1 The discriminator was broken in 0.6.0 and is fixed in 0.6.1

0.6.0 declared `discriminator: {propertyName: "type", mapping: {"null":
ConvertibleUnitDao}}` — one bogus entry instead of the ten type slugs — and
openapi-typescript answers that by stripping `type` from every member and
re-adding a synthetic discriminant, so the generated `IntDao` said
`type: "IntDao"` where the wire sends `"int"`. `@stapel/categories-react` hit
the same defect and routed around it through attributes-react's hand-mirrored
types. **0.6.1 emits the ten slugs**, so this pair's `Schemas["FeatureDao"]`
and `Schemas["FeatureDto"]` discriminate on the real values and ARE the wire
types it uses; `ListingFeatureType` is derived from the union rather than
hand-listed, so a type added upstream widens it automatically.

What still comes from `@stapel/attributes-react` is the BEHAVIOUR — the value
editors, the client mirror, the formatter — which is the spec's L0 seam and
never was a workaround.

### 2.2 A stored DAO carries `slug`; the schema's `FeatureDao` does not

`features` / `features_title` / `features_badges` are
`ListingFeaturesOutputField`, a plain `serializers.JSONField` whose OpenAPI
*description* is swapped for the DAO union by an extension. A JSONField
filters nothing: what reaches the wire is what `build_features_list` stored,
and that is `{**dao, "slug": slug}` (`services/features.py`). The slug is
load-bearing — it is how a card keys a badge and how a refusal finds its
control — so `ListingFeatureDao` mirrors the runtime shape and says why.

A row WITHOUT a slug is treated as malformed and counted
(`unreadableFeatureCount`), never silently dropped: a synthesized index would
key a badge to a position that moves whenever the category does.

### 2.3 The DAO carries its type's config inline — and that is the good news

`prefix`, `postfix`, `precision`, `trueLabel`, `maxSelected`, … all ride along
beside `value`, which is why `<ListingCard>` can format "1200 W" from the row
alone. A grid of forty cards costs one query and no category read. The one
thing a DAO does not carry is `select`'s `options` table, so an option value
falls back to its raw form — which is a translation KEY when the config is
translatable (the default), so a host whose bundle carries the catalogue's
copy still reads a word.

### 2.4 The publish 400 has two shapes

An invalid draft answers a BARE `ValidationBatchResult` (no
`localizable_error`, no envelope), which core wraps as `stapel.http.400` with
the batch on `StapelApiError.body`. A promotion that then fails
(`REQUIRE_IMAGE_ON_PUBLISH` with no photo) answers the ordinary
`error.400.publish_validation_failed`. `publishRefusal` branches on the BODY,
not the status: a caller that branched on `status === 400` alone would put a
sentence under a feature control.

### 2.5 The description's refusal is already keyed like a control

`services.publish.validate_draft` inserts `validate_description`'s row at the
front of the same list, and that row's slug is literally `"description"`
(`stapel_attributes/validation.py:726`) — the same key the mirror files its
own length refusal under. One routing table covers both.

## 3. Upstream asks

| # | Ask | Why it matters here |
|---|---|---|
| 1 | An owner-scoped list (`?owner=me`, or a `my/listings` action) | Without it a seller cannot be shown their own drafts by any call the contract offers. Today: an injected `MyListingsSource`, and a named failure when there is none. `src/model/mineSource.ts`. |
| 2 | A read that returns the `*_draft` twin | `GET /{pk}/` serializes the PUBLISHED fields only, so a draft abandoned and reopened later comes back empty. Editing a live listing is unaffected. |
| 3 | `_get_own` in front of `update` / `partial_update` | Both are the plain `ModelViewSet` implementations under `IsAuthenticatedOrReadOnly` over `Listing.objects.all()`: **any authenticated caller can write any listing's draft fields through `PUT`/`PATCH`.** Every other owner operation checks ownership. This pair declines both and uses `save-draft`, which performs the same write with the check — so nothing is lost, but the endpoints remain reachable by anything else that speaks the contract. |
| 4 | A `published()` filter (or an owner check) on `retrieve` | The detail endpoint answers 200 for a draft, a rejected and a blocked listing to anyone holding the id. The pair reports `publiclyVisible` from `status` and says which situation the reader is in, but it cannot stop the read. |
| 5 | A public read-by-reference for stored images | `Listing.images` is opaque `<type>/<hash>` and nothing in this fleet resolves a stranger's reference (stapel-cdn's `file/exists/` is owner-scoped). Today: a host-supplied `resolveImage`. |
| 6 | `slug` declared on `FeatureDao` | See §2.2 — it is on the wire and absent from the schema. |

## 4. The three seams, and why none of them is an import

`@stapel/cdn-react` and `@stapel/categories-react` are L2 pairs, and L2 pairs
never import each other (the monorepo README states the direction). So:

- **the gallery** is a structural `ListingImagesBag` — two members, satisfied
  by `useUploadQueue()`'s bag. `bag.refs` IS the value of `images_draft` (same
  order, first tile the cover) and `bag.settled` is the submit gate. That pair
  wrote its bag to this contract on purpose (its §13.6 note 9);
- **the category schema** is a plain `readonly FeatureDef[]`, plus
  `renderCategoryPicker` for the chooser (see below);
- **a stored image reference** is resolved by a host-supplied
  `ListingImageResolver`;
- **navigation** is core's `LinkComponent` — a component taking a plain `href`.
  Not react-router: there are several routers and a library that picks one
  picks it for every host.

`@stapel/attributes-react` IS a dependency; it is L0, like `@stapel/image`.

### 4.0 How a card opens is one contract, and the type enforces it

`href` and `onOpen` were two optional props, and a card given both navigated
TWICE for one click: the handler ran, the container routed, and the browser
then followed the anchor still sitting on the button. The storefront worked
around it by passing `onOpen` alone — which cost the most linkable element in
the app its anchor (no middle-click, no "open in new tab", nothing for a
crawler) and was named as gap G-2 rather than shipped as a preference.

`ListingCardOpenProps` is now a three-armed union — `{href, linkComponent?}`,
`{onOpen}`, or neither — so exactly one navigation mechanism reaches the DOM
and "both" does not typecheck. `linkComponent` rides on the link arm because
it IS the link; handing one to a callback card would be two answers to one
question again. `<FavoritesPane>` takes the same union one level up
(`hrefFor` / `onOpen` / `linkComponent`), so a pane cannot re-introduce
upstream what the card refuses.

`test/cardNavigation.test.tsx` asserts on the DOM, not on the props: an anchor
and no handler, a button and no `href`, a `linkComponent` and no `<a href>` at
all, plus two `@ts-expect-error` cases for the combinations that used to
compile.

### 4.1 The category seam has to run in both directions

A seam that only goes one way is not a seam. Until 0.3.0 the chooser arrived
as `categorySlot: ReactNode` and the composer's category moved only through
`bag.setCategory` — which a node handed in from outside cannot reach. There
was no `onCategoryChange` either, so the container could neither set the
category nor learn it, and `features` — the schema OF the chosen category,
which is the entire reason the slot exists — was unreachable rather than
withheld. The screen could not be mounted at all (storefront Wave D, G-1).

Two ways in, both shipping in 0.3.0:

- `renderCategoryPicker({ value, setCategory })` — the render-prop shape
  `<CategoryPage renderListings>` already uses in the sibling pair;
- `category` / `onCategoryChange` — controlled, for the container that holds
  the id anyway.

`categorySlot` still renders (nothing that passed it breaks) and is
deprecated.

**The features wiring, end to end, and it is the container's:**

```tsx
const [categoryId, setCategoryId] = useState<number | null>(null);
const query = useCategoryFeatures(categoryId);      // @stapel/categories-react
const features = loadStateFromQuery(query);         // @stapel/core

<ListingComposerPage
  category={categoryId === null ? "" : String(categoryId)}
  onCategoryChange={(id) => setCategoryId(id === "" ? null : Number(id))}
  renderCategoryPicker={({ value, setCategory }) => (
    <CategoryPickerField
      value={value === "" ? null : Number(value)}
      onChange={(id) => setCategory(id === null ? "" : String(id))}
    />
  )}
  features={loadedRowsOrEmpty(features)}
  featuresLoading={isLoadLoading(features)}
  featuresError={isLoadFailed(features) ? features.error : undefined}
/>
```

`features={query.data ?? []}` is what this snippet used to say, and the fleet's
own `stapel/no-flattened-load-state` forbids it: `?? []` collapses "still
loading", "loaded and this category asks nothing" and "the schema read failed"
into one empty array, and the publish gate downstream then cannot tell the
three apart. `loadStateFromQuery` keeps the discriminant and
`loadedRowsOrEmpty` is the sanctioned way to hand a non-discriminating
consumer its rows, with the state — not a flattened array — answering the two
flags beside it.

`useCategoryFeatures` returns `UseQueryResult<readonly CategoryFeature[]>` and
`CategoryFeature` IS `FeatureDef` (categories-react re-exports the L0 type
rather than mirroring it), so nothing converts. The three props travel
together on purpose: `features={[]}` alone would say "this category asks
nothing", which during the read is a lie the publish gate must not repeat.

Category ids cross this seam as STRINGS because that is what
`Listing.category` carries on the wire; the picker speaks numbers, and the two
lines above are the whole conversion — done once, in the container, where both
halves are visible.

### 4.2 A stated reason needs a next action

`actionBlocked` ended the grey-rectangle incident: every switched-off control
states its reason. It did not end the next one. "Sign in to save this" is a
reason whose next action is a LINK, and no pair took one — so the storefront
put its own notice a screen away from the three controls it was about (Wave D,
G-3), and the card's reason lived only in a `title` on a disabled button, which
receives no pointer events in any browser.

Both halves are closed here: the reason renders as text beside the heart, and
`signIn` — core's `SignInCta`, `{href}` or `{onSignIn}` and never both — is
rendered inside the same element. `<StartChatButton>` and `<ReviewFormCard>`
take the identical prop, so a container writes the destination once.

The LABEL is this pair's (`listings.card.sign_in`, all three locales) rather
than core's: core floors `en` and `ru`, and this pair also ships `es`.

## 5. Gates and their reasons

Every write in the pair is behind an `ActionAvailability`. The mandate axis is
read through core's `MandateSource` seam — never derived here, because a
storefront's derivation is "is there a session?" and a tenant app's is
`@stapel/workspaces-react`'s. `matchMandate` has five required arms, so the
two `unresolved` outcomes cannot fall into the refusal's branch: "we have not
finished asking" and "we could not ask" are both distinct from "you may not".

The lifecycle mirror (`model/transitions.ts`) is a COPY of
`LISTING_TRANSITIONS`, not a summary of it, and it may never block what the
server would allow. The 409 stays the verdict, rendered as the named refusal
it is with `params.from_status` in the sentence.

## 6. Locales

`stapel-listings` ships no `translations/` directory, so 21 of the 63 registry
codes have no upstream catalogue. They split by owner: 42 cross-cutting
`stapel_core` codes are generated from core's catalogue, the 9
`stapel_listings` codes are authored in `src/i18n/{ru,es}.ts` (nine lines to
delete when upstream localizes), and the 12 `stapel_attributes` codes are
deliberately left to `@stapel/attributes-react`. `test/i18n.test.ts` asserts
over the UNION of the two bundles a host actually registers, so nobody can
make it pass by copying the other package's keys in.

## 7. Tests

142 in 8 files (138 under `test`, 4 under `test:pack`). The ones that carry
the weight:

- `status.test.ts` — the 9 × 4 table, the tab grouping (including BLOCKED,
  which `my_counters` counts in no tab at all), and the transition mirror;
- `draft.test.ts` — the payload, in both directions: type tagging from the
  category schema, blanks omitted rather than nulled, the countable/stock
  cross-field rule, code-point length, the two kinds of publish 400;
- `compose.test.tsx` — the submission against the wire: the row is created
  with the category and nothing else, the gallery's refs go out in order, the
  save happens BEFORE the publish, a `ValidationBatchResult` lands on the
  control that caused it, and the two publish outcomes are told apart by what
  the server answered;
- `detail.test.tsx` — four absences and four sentences, the owner-only
  moderation axis, and the favourite control blocked-but-visible for a
  visitor;
- `mine.test.tsx` — the named gap, real counters beside it, and no badge at
  all for a count that failed to load.
