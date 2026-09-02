# @stapel/listings-react

## 0.16.0

### Minor Changes

- 6bf6f2d: The edit screen speaks the edit's own language. On an already-published
  listing the composer's primary read like first publication and "Save draft"
  beside it silently parked the edit in the draft twin — a seller's first round
  of edits was lost to that pair of labels. On the live-edit arm
  (`bag.isLiveEdit`) the primary now reads "Save changes"
  (`listings.compose.republish`, re-worded in en/ru/es), the quiet exit reads
  "Stash as draft" (`listings.compose.save_live`, new), and its confirmation
  names the fate: "Changes stashed as a draft — the published listing is
  unchanged" (`listings.compose.saved_live`, new). A draft keeps the draft
  words on both buttons.

## 0.15.1

### Patch Changes

- 47b23c8: `<ListingDetailPane>` takes `signIn` — the same `SignInCta` seam its three
  card skins already take — and renders the container's sign-in door beside the
  blocked favourite's reason. Measured on a live storefront: the pane's heart
  said "sign in to do this" with the nearest sign-in a screen-corner away,
  which is exactly the gap `signIn` closed on the cards.

## 0.15.0

### Minor Changes

- The redacted feature stub reaches the spec table and never reaches an editor

  stapel-listings 0.12.0 redacts `features` per viewer: a row whose value the
  reader may not see arrives as a value-free stub — `{slug, type, name, order,
visibility, redacted: true, present}` and no `value` key at all — kept in place
  and in order rather than dropped. `ListingFeatureDao` now types `visibility`,
  `redacted`, `present` and `verification`.

  `model/features.ts` routes the markers deliberately instead of letting them
  arrive through `config`'s index signature: `visibility` is lifted onto the
  built `FeatureDef`, where it is a genuine canon field and where
  `isPublicFeature` reads it, and `redacted` / `present` / `verification` ride
  the value envelope, which is where `@stapel/attributes-react`'s predicates read
  them. All four join `ENVELOPE`, so none of them reaches a type's config. A
  stored `visibility` this build does not recognise is read as `staff`, not as
  public. `featureFromDao` produces a usable view for a stub rather than dropping
  the row, and `unreadableFeatureCount` does not count one: the field's existence
  is exactly what the stub is there to state.

  **The split that protects stored data.** `featuresDtoFromDaoList` is what seeds
  a composer reopening a published listing, and it now DROPS a stub. Seeding an
  editor from one would put `undefined` under the seller's own slug and the next
  save would write that back — blanking a stored VIN the seller never touched and
  cannot see was blanked. A reopened composer belongs to the owner, whose read is
  unredacted, so a stub arriving there means something upstream already went
  wrong; it fails safe rather than taking the other twenty answers down with it.
  The new `featureValuesForDisplay` is the other half: same shape, opposite job,
  a separate function rather than a flag so the destructive default is not one
  forgotten argument away.

  The `@stapel/attributes-react` peer floor rises to `>=0.9.0`: the redaction
  predicates this release reads (`isRedactedValue` and friends) land there, and
  a range that still admitted 0.5.0 would resolve to a build without them.

  `<ListingDetailPane>` reads the spec table through `featureValuesForDisplay`,
  so a withheld row keeps its position and reads "Provided by the seller"; its
  title line filters redacted views before formatting. Both are belts — the
  server keeps hidden values out of `features_title` and `features_badges`
  entirely, and `formatFeatureValue` refuses a stub besides — but the title line
  is where a leaked identifier would be read out loud.

## 0.14.1

### Patch Changes

- The imported rule corpus and the vocabulary examples are source-neutral.

  `test/fixtures/rules-corpus/imported/` replaces the directory named after the
  external marketplace the corpus was imported from, and both files were
  regenerated upstream (stapel-attributes 0.7.1) with a synthetic option
  vocabulary and structural notes. The rewrite is injective per case, so the
  TypeScript evaluator is still measured against exactly the same 3890 rules at
  both polarities — 7780 frames, 15 730 feature-state expectations, the same
  effect mix and the same shape gate. `scripts/gen-rules-corpus.mjs` copies the
  `imported` set, and the `stapel-attributes` contract pin moves to v0.7.1.

  Examples and demo data drop the source's name too: the worked vocabulary is
  `phone-models` / `car-models` / `phone-catalog` across the attributes,
  vocabularies, search and listings pairs. Comments, READMEs and changelog prose
  say "an imported external catalogue" where they used to name the marketplace.
  No runtime behaviour, exported API or wire shape changes.

## 0.14.0

### Minor Changes

- The desktop result card is a list row, and it has the phone card's gallery

  Measured on a live 1440px result page in "list" view: **one offer per screen**
  — a 974×835 card of which the photograph was 974×731 — showing a SINGLE photo,
  with no carousel, and that photo inside the card's own link. The phone card,
  measured in the same run, was correct on every count: three photos per card,
  dots on all of them, a 17px peek, and the strip a sibling of the anchor.

  Two changes, both to `<ListingCard>`, and the second to `<ListingSerpCard>` as
  well.

  **The photos are a strip, outside the anchor.** `<ListingPhotoStrip>` is now
  the one gallery both card surfaces draw: a `SkinCarousel` over every stored
  photo, peeking and dotted above one photo, one slide for a listing with none.
  It sits BESIDE the anchor rather than inside it, because a swipeable strip is a
  control, a link may not contain one, and a horizontal swipe that ends inside an
  `<a>` is a swipe the browser may deliver as a click — the defect that made the
  desktop gallery unreachable. The "the card is the link" ruling is otherwise
  untouched: the price, the title, the badges and the place are still inside one
  real `<a href>` whose accessible name is the title.

  **The card lays out as a row when it is wide enough to be one.** Above
  `LISTING_CARD_ROW_MIN` (560px of the CARD's own inline size, asked with a
  `@container` query and never a viewport breakpoint) the strip moves beside the
  reading column at a fixed `LISTING_CARD_ROW_MEDIA` (260px), so several offers
  fit a screen. In a grid the column is never that wide, so nothing about a grid
  changes.

  New from `@stapel/listings-react/default`: `ListingPhotoStrip`,
  `LISTING_CARD_ROW_MIN` and `LISTING_CARD_ROW_MEDIA`. The frame's own class
  names (`CARD_QUERY_CLASS`, `CARD_FRAME_CLASS`, `CARD_MEDIA_CLASS`,
  `CARD_MAIN_CLASS`, `CARD_BLEED_CLASS`) stay on the module, beside
  `cardTargetCss`, where the other card surfaces read them.

  Demos photograph both cards at both widths — a 320px grid cell and a 960px list
  row — and the suite asserts the structure the layout acts on plus the rule text
  a browser applies.

## 0.13.0

### Minor Changes

- 5397813: The composer asks what is being sold before it asks about the parcel

  `<ListingComposerPage>` had two section orders chosen by the form's width, and
  the narrow one put the category's characteristics directly under the category
  picker. On a leaf with a handful of attributes that was an improvement; on an
  imported one it was a funnel with nothing left in it. Measured at 390x844 on a
  live classified deployment: 32 fields between the category and the title, so
  `Title` sat at y=5575, `Price` at y=5871 and `Photos` at y=6245 of a 7308px
  form — the seller was asked for the parcel's weight, its length and "what the
  goods are measured in" before being asked what the thing is or what it costs.

  There is now ONE order, at every width, and it belongs to the component:

      category → title → description → price → currency → where → photos →
      the category's characteristics → the listing's own options

  Measured on the showcase's own composer story at 390 (five attribute rows, not
  32): title moves 993 → 314, the first attribute row 412 → 1266, and the page
  shortens 2227 → 2071px.

  - `COMPOSER_STACKED_BELOW` is gone, and with it the width measurement that
    chose between the two orders. `COMPOSER_DETAILS_PLACEMENT` replaces it: a
    constant, exported because `data-placement` on the characteristics region is
    what an e2e suite reads to prove the order has not regressed.
  - The discoverability the narrow order was reaching for is kept by the two
    things that do not move the questions around — "take me to the first empty
    field", which now also OPENS whatever disclosure the field is folded inside,
    and a shorter region.
  - `<FeatureFields>` takes `groupCollapse` (`"none"` by default, unchanged for
    every existing host; `"auto"` in the composer). Under `"auto"` each named
    group is a native `<details>` that starts open when it asks something
    required or something already answered, and closed otherwise — so identity
    groups are open and the delivery dimensions and wholesale terms are one tap
    away under their own headings. The rule reads the SCHEMA and never a list of
    group names: groups are admin-authored text in the deployment's language.
  - The group order the catalogue emits is untouched.

## 0.12.0

### Minor Changes

- 0eab206: A published listing prints its option COPY wherever the copy exists, and the
  composer's characteristics step is reachable on a phone.

  **The copy.** A `select` DAO carries the chosen values and the display config,
  never the option table — the table lives on the CATEGORY, and not needing it
  is what lets a card draw a badge without a category read. A row written before
  the server started snapshotting labels therefore had nothing to resolve
  against, and the STORAGE SLUG reached the screen: a live classified deployment
  printed `b-u`, `bez-defektov` and `ne-rabotaet-vspyshka` on its spec rows.
  `featureFromDao(dao, { categoryFeatures })` adds the third and last source of
  copy, with the precedence written out: a row carrying its own `options` table
  is left alone, then the row's own `labels` snapshot, then the CATEGORY's
  option table, then the raw value. The snapshot wins over the category on
  purpose — it is what the listing was PUBLISHED with, and the whole reason the
  server takes one is that a category edited afterwards must not silently
  restate an old listing. A category def is used only when slug AND value type
  match, so a renamed feature is ignored rather than forced, and a value the
  catalogue no longer declares still prints itself rather than vanishing or
  being invented. `hierarchical_select` gets the same repair, its tree adopted
  whole because no positional snapshot can describe one. `<ListingDetailPane>`,
  `<ListingCard>`, `<ListingSerpCard>`, `<ListingDetail>` and `useListingDetail`
  take the optional `categoryFeatures`; a host that wires nothing is unchanged.

  **The composer.** On a 390px viewport the characteristics of the chosen
  category began about 1.8 viewports below the fold, under a 700px photo
  dropzone, with no step indicator and nothing saying they existed — while the
  footer counted ten unfilled required details, none of them on screen.

  - Below `COMPOSER_STACKED_BELOW` the characteristics render directly under the
    category choice and ABOVE the photos; at or above it they stay where they
    were. The threshold is measured on the FORM's own width via `useElementWidth`
    — a composer in a 400px panel on a desktop is a narrow composer — and an
    unmeasured element falls to the wide arm.
  - The placeholder said "loading the category's characteristics" when nothing
    was in flight and no category had been chosen. That is now its own fourth
    state with its own sentence, en/ru/es.
  - `ListingComposerBag.firstUnsatisfied` names the first refused field in the
    form's own order, and the closed gate renders a real button (accessible
    name, focus AND scroll) that takes the person to it. A count of ten with
    nothing on screen is a dead end.
  - A field showing a refusal now drops its hint instead of stacking on it: the
    refusal is the more specific statement and the one just earned.
  - The whole attribute region carried exactly one test id. `attributes-fields`,
    `attributes-group-<group>`, `attributes-group-<group>-heading` and
    `attributes-row-<slug>` (with `featureSectionTestId` / `featureRowTestId`
    exported) make it measurable, and the row id sits on the same element with
    or without a host `renderRow`.

- 9a123b9: A stored `select` prints its option copy, not the storage slug.

  A DAO carries the value and the display config, never the option table — the
  table lives on the category, and not needing it is what lets a card render a
  badge without a category read. `formatFeatureValue` resolves an option's copy
  out of `config.options`, so with no table it fell through to `String(value)`
  and the SLUG reached the screen: a live classified deployment printed
  "Condition: b-u" on its spec rows and a subtitle of three slugs on its cards.

  The identity table `featureFromDao` synthesized (`{value: v, label: v}`) only
  ever answered for a TRANSLATABLE catalogue, whose labels are its keys. The
  catalogues that produced those screens set `translatable_options: false` and
  carry literal copy on the category, so `t("b-u")` returned `"b-u"` and there
  was nothing else to fall back to.

  - `featureFromDao` now builds the option table from the DAO's write-time
    `labels` snapshot — the `string[]` positionally aligned with `value` that
    `ref_select` has always carried and that `select` carries from the
    stapel-attributes release which snapshots option copy. The copy a listing was
    published with is the copy it prints, whatever the category has become since.
  - A row written before that release carries no `labels` key and keeps the
    identity table exactly as it behaved: a translatable catalogue still reads
    out of the host's bundle, and a non-translatable one still shows the slug
    until the listing is re-projected. A visible slug gets fixed; an invented
    label ships wrong.
  - A snapshot whose length differs from `value` is dropped WHOLE rather than
    paired over its overlap, which is the engine's own rule: one option's copy
    printed against another option's value does not look wrong.
  - `ListingFeatureDao` declares `labels?: readonly string[]`.

  Minor rather than patch: the fix rides on a new optional wire field and changes
  what every listing surface renders. `ListingCard`, `ListingSerpCard`,
  `ListingDetailPane` and the `ListingDetail` headless bag all split their DAOs
  through this one function, so no surface needed its own patch — and a host
  snapshotting card or detail output will see the labels change.

- 8d1e20f: The phone dock stops truncating its labels, stops covering the footer, and the
  phone SERP gets a one-line toolbar instead of four stacked rows.

  **A compact label for a compact chrome.** `NavEntry.shortLabelKey` (core) is an
  optional second i18n key a manifest declares when its menu label cannot fit a
  dock cell. A five-item dock at 390px gives each destination about ten
  characters, and a label written for a menu row ellipsizes mid-word — a
  destination a person has to guess at, which is the one thing a dock must not
  produce. A key and not a length hint, because which words survive the cut is a
  translator's judgement: the useful short form of "Post a listing" is the verb,
  of "My listings" the noun, and no truncation rule finds either. `resolveNav`
  carries it through, `<NavDock>` prints it and keeps the LONG label as the
  link's accessible name; `listings-react` declares one for `compose` and `mine`.
  The dock also drops its inter-cell gap and one inset step — 24px given back to
  five labels — and `scripts/gen-nav-manifest.mjs` validates the new field.

  **The clearance belongs to the page, not the content.** The island is fixed
  over the last thing on the page, and the last thing is the footer. Reserving
  `DOCK_CLEARANCE` on `<Layout.Content>` cleared the final card and left the
  footer's legal links permanently under the island. `<PublicShell>` reserves it
  on the page column instead, and only when `dockRenders(nav)` says an island
  will actually be drawn — a one-entry nav used to get a strip of empty page
  under a dock nobody rendered.

  **A phone toolbar that is one row.** `<SearchResultsPane header="compact">`
  gives the toolbar its own line and puts the count directly above the cards as
  their caption, with the heading visually hidden but still in the document
  outline; the banner shape (heading | count + toolbar) is unchanged and
  remains the default. `<SortSelect compact>` drops the caption and the 200px
  floor so the control shares a row, and moves the blocked `distance` option's
  REASON into the option's own label — on a phone, where that refusal is most
  common, a separate reason row costs a band of viewport above the first result.
  `<FilterChips>` takes `geoChip={false}` for a surface that already states the
  location above it (the phone SERP mounts `<LocationSummaryLine>`, and the two
  together asked about one filter twice), and renders NOTHING when it would be a
  row of one button — a free-text query has no category, so the server returns no
  facet plan, and the row was a lone circle floating between two working filter
  affordances. `<LocationSummaryLine>` says "Filters", not "All filters": that
  end of the row shares 390px with a place name.

  **Tiles say which category they are.** `<CategoryTileGrid>` draws the
  category's own initial where art is missing, instead of a muted disc. A live
  catalogue put nine identical grey discs on one landing — every category there
  carries an empty `carousel_icon`, which is the state every catalogue is in
  until somebody uploads art — and a grid of them reads as nine images still
  loading. A letter cannot be mistaken for a pending image, and every tile
  differs from every other.

  **`visuallyHidden`** (tokens-antd `/skin`) is the fleet's one off-screen-but-
  announced style. It was written twice before, in `calendar-react` and
  `search-react`, and the two disagreed on `clip-path` versus the deprecated
  `clip`; both now import it.

### Patch Changes

- e738b83: Regenerated against the contracts the fleet actually installs.

  `contract-pins.json` moves stapel-search 0.4.0 → 0.7.0 and stapel-categories
  0.7.0 → 0.9.0 — the two pins the freshness gate reported as three and two
  minors behind, and the two versions a live classified deployment now runs. A
  pair regenerated from a stale pin is internally consistent and wrong about the
  wire, which is the whole reason the gate exists.

  What the regeneration brings in:

  - `search-react`'s `GET /suggest` grows `categories[]` — a destination per row
    with its full ancestor path, the number of LIVE listings behind it and a
    `category` string to pass verbatim to `/query`, ranked by that count. The
    answer is now public and conditional (`Cache-Control` + `ETag`), which is
    what makes a per-keystroke read reasonable.
  - `categories-react`'s feature-config union gains `group` — attributes v2's
    container type, whose config holds its children as raw dicts each
    discriminated by its own `type`, plus an optional `repeat`. The pair's
    discriminator contract test pins thirteen members instead of twelve; it
    checks in both directions on purpose, and this is the direction that was
    supposed to fire.
  - `calendar-react` and `search-react` raise their `@stapel/tokens-antd` peer
    floor to the release that first ships `visuallyHidden`, which both now
    import. The monorepo cannot catch that by building — in here every package
    compiles against the workspace peer, never against its own declared floor —
    so only a consumer installing at the floor would have found it, after the
    release.

## 0.11.0

### Minor Changes

- 5f9b005: A refused save is read on the control that caused it, not as a wall.

  `save-draft` and `create` answer a bad field with the ordinary error envelope
  carrying `params.field`, not with the publish batch — and only the batch had a
  door into the composer's per-control routing. So a draft refused for one
  over-precise coordinate painted two identical "Validation error" plaques over
  the footer (a publish saves first, so both failures were the same 400) and
  left all thirty-odd controls clean. The field name was in the response the
  whole time, and is often the only thing in it that says what went wrong: a DRF
  code the error registry does not know collapses to the generic
  `error.400.validation_error`, whose sentence is "Validation error" and nothing
  else.

  - New `envelopeFieldErrors(thrown)` maps an envelope's API field name onto the
    control that holds it — including both halves of the coordinate pair onto
    the one location field — and is exported for hosts that render their own
    composer.
  - `useListingComposer().fieldErrors` now carries save/create refusals as well
    as publish-batch ones.
  - `ListingComposerPage` banners only what has nowhere else to go: a refusal
    that reached a control is read there, once.

## 0.10.0

### Minor Changes

- c887a5a: **The pair gets its two phone card surfaces: `<ListingSerpCard>` for a one-column result page and `<ListingFeedCard>` + `<FeedGrid>` for a home feed.** Both on `/default`. `<ListingCard>` is untouched — the desktop grid card stays exactly what it was.

  **Three cards, not one with a `variant`.** They differ in READING ORDER and in what may live inside the card's anchor, not merely in size, and a mode switch would have produced one component nobody could photograph either arm of. What they DO share is shared for real: one `CardTarget` (the three-armed link/button/neither union, so the double-navigation defect has one place to come back in), one `<FavoriteHeart>` (one hook, one gate, one `aria-pressed`, one refusal), one `<ListingPhoto>`, one `<ListingPrice>`.

  **`<ListingSerpCard>` — the price is first, and the photo strip is outside the anchor.** On a one-column result the photo is already full-bleed above the text, so the first LINE is where the eye lands, and on a classified that line is the price: large and bold, title at regular weight under it, the host's muted spec line under that, then the stored badge projection. The photos are a `<SkinCarousel>` (peek and dots when there is more than one, neither when there is not) and it sits as a SIBLING of the card's anchor, never inside it — a `<SkinCarousel>` is a scroll container with its own tab stop, and a horizontal swipe that ends inside an `<a>` is a swipe the browser may deliver as a click. Putting the strip in the anchor would mean every attempt to look at photo two navigated to the listing.

  Two slots at the trailing edge and under the text: `actionsRail` (the container's call and chat controls, with the favourite heart added at its end) and `sellerSlot`. **The caveat `sellerSlot` ships with, stated rather than discovered:** `<RatingBadge>` FETCHES — one request per card, twenty requests for a decoration on a page of twenty results. A container drawing a list should render the seller's name plus a bare `<Rate>` from an aggregate the row already carries, and nothing at all when the row carries none. It is outside the anchor because a seller's name is usually a link, and a link inside a link is neither valid nor operable.

  **`priceTrend` is a seam over data that does not exist yet, and says so.** `{ oldPrice, direction }` renders the ref's struck previous price and a NAMED arrow (`role="img"`, not `aria-hidden` — the arrow is the whole message). The search projection carries no price history, so nothing on a live deployment fills it today: **wave gap G-2**, and the follow-up is on the stapel-listings/stapel-search projection. It ships anyway because the alternative is re-laying-out the card the day the field lands; the demos show it against fixture data and label it as fixture data.

  **`<ListingFeedCard>` — borderless, and the one surface where the heart floats.** No antd `Card`: the photo IS the card and the rhythm of the grid separates one from the next, because twenty bordered boxes on a 390px screen is twenty frames around the only thing anyone is looking at. Two lines of title then a clamp (as a real CSS rule — `-webkit-line-clamp` does not survive an inline style object, which is how a clamp goes missing unnoticed), bold price, muted place, and an optional `badgeOverlay` on the photo's leading corner.

  `<ListingCard>` argues at length that the heart belongs in a row UNDER the card and not on the photograph, because a blocked favourite states its reason as text. That argument is right, and this card does not repeat its conclusion for a reason it writes down instead of hiding: a 2-column feed tile has no line to spare, and a full row of "Sign in to save this" under each of twenty tiles is not twenty pieces of help — it is the feed. The fleet already has the mechanism, and it is not "hide the reason": **a container should wrap `<FeedGrid>` in a `<PaneGate>`**, whose `GateReasonScope` pools identical reasons and renders each once with every control's `aria-describedby` still pointing at that single copy. Unscoped, the reason still renders, visibly, over the photo.

  **`<FeedGrid>` is two columns and no masonry.** `repeat(columns, minmax(0, 1fr))` — not the results pane's `auto-fill, minmax(280px, 1fr)`, which collapses to ONE column on a 390px phone, exactly where the ref calls for two. No masonry polyfill and no CSS `columns`: every photo is drawn in the same 4:3 well so the tiles line up on their own, and multi-column would have walked a keyboard and a screen reader down the whole left column before the top of the right one. `columns` defaults to 2; a wider surface passes its own number, so desktop is not this wave's consumer and is not broken either.

  The `@stapel/tokens-antd` peer floor rises to `>=0.9.0` — the release that introduces `SkinCarousel`.

  New keys in en/ru/es: `listings.card.photos`, `listings.card.price_was`, `listings.card.price_dropped`, `listings.card.price_raised`.

## 0.9.1

### Patch Changes

- 417dc45: The composite `group` kind — a bordered, repeatable subform.

  stapel-attributes 0.6.0 registers a thirteenth builtin type: one feature
  holding a small TABLE. Its value is a list of rows keyed by child slug, and its
  `config.fields` are full feature definitions of the ordinary kinds — which is
  the shape 2 468 fields of the imported catalogue corpus carry (a discount ladder is
  "from N units, M % off", up to five steps) and that no other kind could hold.

  **attributes-react**

  - `GroupEditor` in `BUILTIN_VALUE_EDITORS`: one bordered box per row, the
    children as cells, add and remove controls honouring `repeat.min`/`max`. A
    cell is drawn by its child's OWN editor through the same resolution ladder a
    top-level row uses, so a host's registered editor is used inside a group too,
    and a kind that reaches the loud notice at the top level reaches it in a cell.
    `repeat: null` is a single-row group: no add, no remove, no row numbers.
    Phone and desktop come from the column's measured width (`useTouchFloor`),
    not a viewport query — the add/remove controls take the 44px floor in a
    narrow composer column on a full desktop.
  - `props.id` lands on the CONTAINER, as `role="group"`. A composite has no
    primary control, and putting the row's id on the first cell would give that
    one `int` two labels and make the row's label read as a question about it.
  - The mirror (`validateFeatureValue`) judges the row count against `repeat` and
    then every cell through its child's own rule. The refusal that comes back is
    the CHILD's own code — `above_maximum` for a discount over 30 % — because the
    engine adds no error vocabulary for a group and neither does the mirror.
  - `formatFeatureValue` reads a stored table: each cell through its child's type,
    cells joined by `", "` and rows by `"; "`, with the stored `name` winning over
    the config's and a cell the config no longer declares keeping its raw value.
  - `GroupConfig` / `GroupRepeat` are generated from the §68 canon
    (`docs/feature-def.schema.json`), not hand-written, and re-exported from the
    main entry. Three i18n keys (`attributes.group.row` / `.add_row` /
    `.remove_row`) in en, ru and es.
  - Nothing here recurses: a child of type `group` is a refused config upstream
    (nesting depth is 1) and simply resolves to the notice here, and a child
    carrying `rules` is refused upstream too — so there is no per-row rule pre-pass
    and no `narrowConfig` inside a cell.

  **listings-react**

  No composer code changed, which is the claim: the bag holds a value keyed by
  slug whatever its shape, `<FeatureFields>` resolves the editor, and the mirror
  judges the rows. `test/composerRules.test.tsx` now pins that — a composite draws
  with the builtins, an empty mandatory one blocks the publish, a cell outside its
  child's bounds blocks it, and the table reaches the wire under the group's own
  slug. The `@stapel/attributes-react` peer floor moves to `>=0.5.0`, the release
  that can draw one.

## 0.9.0

### Minor Changes

- 9708eb3: The composer reads the rules, the catalogue's defaults, and the vocabulary
  source.

  - **A category's defaults reach a blank draft.** `initialFeatureValues` is
    applied when the schema lands, only for slugs the draft has no answer for —
    a reopened listing outranks a default, because a default is a suggestion and
    an answer is not. It runs once per feature SET, so a default is not re-seeded
    over a field the person then cleared.
  - **The publish gate's required check is the RULE STATE.** A mandatory feature
    the rules hid no longer blocks a publish for an answer nobody can give, and a
    feature a `require` rule turned on blocks one though `mandatory` is false.
  - **A missing vocabulary source blocks through the "unsupported" channel.** The
    composer reads `useVocabularyClient()` and hands it to `unsupportedTypes`, so
    a `ref_select` with nothing to resolve it raises the same
    `listings.compose.blocked.unsupported_type` a type with no editor raises.
    One dead control, one reason, no second channel — wire
    `<VocabularyClientProvider>` around the composer and it goes away.

  `featureFromDao` narrows `translate` to the canon's closed vocabulary
  (`all` / `title` / `none`) instead of passing any string through.

  Requires @stapel/attributes-react >= 0.4.

### Patch Changes

- d1125bc: Regenerated against the attributes-v2 contract pins: stapel-categories 0.7.0,
  stapel-listings 0.10.0, stapel-search 0.3.1.

  What moves in the wire types: `FeatureCompact` and `ResolvedFeature` gain
  `rules`, `description`, `example`, `default`, `hints` and `group` — the form
  metadata an imported catalogue actually carries, which is what
  `<FeatureFields>` draws sections, help lines, placeholders and hints from
  instead of a host's hand-written table; `Category` gains `external_id`; the two
  vocabulary-backed value types (`ref_select`, `ref_hierarchical_select`) appear
  in the type enums; and the error registry gains
  `error.400.feature_invalid_rules`.

  search-react's regen is contract metadata only — the facet mapping for the two
  ref types (`term` / `path`, and no `closed_options` for any config carrying an
  `optionsRef`) is decided server-side in stapel-search 0.3.1 and reaches this
  pair as facet rows, not as a new surface.

## 0.8.1

### Patch Changes

- 41d2a78: The composer's `locationPicker` slot documentation now points at `@stapel/geo-react`'s `LocationField` rather than `LocationPickerField`, and says why the difference matters.

  No code changed: the slot contract (`{ value: { lat, lon, address? }, onChange }`) already fits both, which is what a slot is for. But the two components are not interchangeable from the person's side. `LocationPickerField` is a button — "Choose on the map" — that prints its answer underneath itself, so a form somebody has just filled in goes on looking empty, and the question names the mechanism instead of the thing being asked. `LocationField` is a field: it states the question while empty and holds the chosen place inside itself once it is not, and one tap runs the ladder behind it — the permission pre-prompt before the browser's one-shot prompt, the server's IP guess when that is refused, then the map.

  The adapter in the docblock is the copy-pasteable one for the new shape.

## 0.8.0

### Minor Changes

- 5c6126d: Auto-anonymous: a gated action can mint an identity instead of refusing.

  A marketplace visitor who has not registered could read the catalogue and do
  nothing with it. Saving a listing and writing to a seller are the two acts the
  product exists for, and both answered "sign in first". They no longer do: the
  press mints a guest account silently and then performs the act.

  - `@stapel/core` gains the elevation seam — `ElevationSource`,
    `<ElevationProvider>`, `useElevation(action)`. It is per-ACTION on purpose.
    The mandate axis is untouched by a mint, so a minted guest stays
    `"anonymous"` and every action a deployment did not name keeps its wall.
  - `@stapel/auth-react` gains `createAuthRuntime({ autoAnonymous: { actions } })`
    and `createAnonymousElevation`, implementing that seam over
    `POST /anonymous/`. It never mints on render, collapses concurrent presses
    onto one mint, and persists a `device_id` so a reload does not abandon the
    first guest along with what they saved.
  - `@stapel/listings-react` exports `LISTINGS_ELEVATION_ACTIONS` and
    `useElevatableMandateGate`; the favourite heart takes the named action.
    Publishing deliberately does not.
  - `@stapel/chat-react` exports `CHAT_ELEVATION_ACTIONS`; "message the seller"
    takes the named action.
  - `@stapel/reviews-react` exports `REVIEWS_ELEVATION_ACTIONS` and now refuses a
    mandate-less visitor BEFORE the click rather than after it. It also
    recognises `error.403.reviews_anonymous_not_allowed`: a signed-out visitor
    is refused with 401 and a minted guest with 403, and both mean "you need an
    account", so `isSignInRequired` reads both.

  `@stapel/auth-react` also gains `<AuthPanel showGuestEntry>`. With the axis
  open the backend advertises `registration.anonymous` and the panel would draw
  "Continue as a guest" — on a host that mints automatically that button mints a
  session and leaves the person on the sign-in screen, which is the silent
  control that got the capability switched off somewhere once already. The
  server's statement stays true; the host says whether it is obtained by
  pressing that.

  WHICH actions may mint is a host's list, not a library default. A host that
  wires nothing sees no change: every gated control refuses exactly as before.

- 62c70ac: The classified layout, in the default skins.

  Built where the doctrine says the product lives, so every future classified
  deployment gets it rather than rebuilding it.

  - `shell-react` — `NavDock`, a floating translucent island rather than a flat
    bar: inset from every edge, real border and shadow, safe-area aware. The
    glass is progressive enhancement, not the design — the opaque elevated fill
    is the base and the blur is swapped in only inside an `@supports` for
    `backdrop-filter`, so text contrast never depends on transparency being
    available. Destinations are the first five top-level nav entries in the
    order the manifest already declares, so there is no second selection axis.
    Real links, `aria-current`, and the badge count folded into each link's
    accessible name.
  - `search-react` — a phone gets a scrollable chip row instead of one
    "Filters" button, each chip opening its own `SkinDialog`, and chips carry
    the CHOICE rather than the group name. A desktop gets a sticky full-height
    rail. Both render through one `FacetGroupControl`, so the rail and the
    sheets cannot drift into two implementations — and a group's shape is
    derived from the schema keys the composer's editor already reads
    (`maxSelected: 1` → pills, `hierarchical_select` → indented children)
    rather than a new presentation flag. Plus a list/grid view switch, which is
    not URL state because it changes how an answer is drawn and never what it
    is.
  - `listings-react` — the whole card is one real anchor: photo, price, title
    and location inside it, the favourite heart a sibling button outside it so
    the link cannot swallow it. The separate "open" control is gone and its
    i18n key is retired. Middle-click, open-in-new-tab and crawlers still work,
    and the anchor's accessible name is the title alone.

  Parts of the reference layout that do not fit a generic contract are slots
  with a stated reason rather than invented content: "notify me about new ones"
  (a saved search has an owner, a schedule and a consent record this pair has
  none of), the breadcrumb (a walk up a tree search cannot see), and map view
  (a `SearchView` whose tiles belong to geo-react).

## 0.7.0

### Minor Changes

- 456b30a: The composer stops drawing labelled voids, and a price is money.

  **NC-ORPHANFIELD.** `SlotPlaceholder` is nothing in a production build — but
  the `Form.Item` around it still drew its label, so a production composer with
  unfilled slots rendered "Category", "Currency" and "Where it is" over empty
  space and a "Photos" heading over air. A label is a promise that a control
  follows it: the new `SlotField` renders the whole field or none of it, and the
  Photos section renders no heading when it has no body. `slotVisibility="visible"`
  pins the development view on, so a production-built showcase can still
  photograph the named placeholders (the `unwired` story does).

  The price row stops asking the currency question twice: the `RUB` addon inside
  Price now appears only when no `renderCurrencyPicker` is wired.

  **Money.** `<ListingPrice>` renders every price through
  `@stapel/currencies-react` — `formatMoney` when the host mounted no catalogue,
  `useMoney().format` when it did (which is how a rouble price gets `₽` in a
  locale that has no glyph for it). It was `` `${price} ${currency}` `` — an ISO
  code, no grouping, a forced `.00`, and the same string in every language. The
  dependency is an OPTIONAL peer: absent, only the pure arm ever mounts.

  **Gated noise, pagers and plurals.**

  - `my-listings` refuses as a PANE: a visitor got the blocked notice above a tab
    bar still advertising "Active 2 · Drafts 3". Now one state, no dashboard.
  - "This app has no screen for editing a listing yet" is a fact about the BUILD;
    it was printed once per row. Said once by the pane, and the button it refuses
    is not drawn.
  - The favourites pager rendered "Previous" twice — the keyset gates name the
    missing page with the button's OWN label key, so the blocked button printed
    the word and its "reason" printed it again. Each direction now renders only
    when its page exists, with a real page indicator (`pageNumber`, new on the
    bag) between them.
  - "**1** of your listings **were** taken down" goes through `tPlural`.
  - The publish gate said "Fix the highlighted fields first" while nothing was
    highlighted: the mirror reaches the fields only after a publish attempt. Before
    that it now says how many required details are still empty.
  - `listings.compose.blocked.unsupported_type` no longer interpolates the editor
    type: `size_grid` is this build's vocabulary and a seller can do nothing with
    it.

  The composer footer leads with its primary (`Publish`, large) and demotes
  "Save draft" to a text button; the dashboard and favourites gain measures so a
  1280px window stops stranding row actions across 560px of nothing.

## 0.6.0

### Minor Changes

- 80617e9: The composer stops improvising controls nobody can use, the detail page gets a primary action, and the skin moves onto the shared substrate.

  **Contract (stapel-listings 0.7.1).** `geohash_draft` is server-computed and `readOnly`: `Listing.save()` stamps it from `lat_draft`/`lon_draft` through `geo.geohash_encode`, and a value sent in the body is discarded. `schema.ts` regenerated, `draftPatchFromValues` no longer sends the field, and the two doc comments that asserted the opposite (`model/draft.ts`, `ListingComposerPage`) now state the contract.

  **Four named slots, no invented controls.** `renderCategoryPicker`, the new `renderCurrencyPicker`, the new `locationPicker` (`{ value: {lat, lon, address?}, onChange }` — the shape `@stapel/geo-react`'s `<LocationPickerField>` fills, adapter documented on the type) and `gallerySlot` each render `<SlotPlaceholder name=…/>` when unfilled. Gone with them: the text box asking for a numeric category id, the text box asking for a currency code, the two decimal boxes labelled Latitude and Longitude, and the "Photos" heading over nothing. `renderLocationPicker` stays for a picker that also resolves `location_id`. `categorySlot` (deprecated: a node cannot reach `setCategory`) is removed.

  **A primary action on the money screen.** `contactSlot` is the buyer's ("message the seller", from the container's chat pair); the OWNER gets Edit and Take down instead and no longer sees "save to favourites" on their own listing. `onEdit` is a real prop on both the detail pane and the dashboard, and its absence is a _gate_: the Edit button that was permanently enabled and inert now states that this app has no editing screen.

  **Delete asks first** — `<SkinConfirm>`, one per list, a bottom sheet on a phone. It used to fire on the first click.

  **Shared substrate.** `src/default/theme.tsx` and `src/default/ErrorAlert.tsx` are deleted; every surface wraps in `<SkinTheme>` (reactive `data-theme`, 44px controls on a phone) and errors/empties/gates come from `@stapel/tokens-antd/skin`. **Breaking:** `ListingsSkinTheme` and `ErrorAlert` are no longer exported from `/default` — import `SkinTheme` / `ErrorAlert` from `@stapel/tokens-antd/skin`. `ListingCardBlockedReason` loses its `"tooltip"` arm: a disabled antd button never fires the events a tooltip needs, so that setting hid the reason rather than quietening it.

  **Phone geometry.** The dashboard row is a thumbnail plus a `min-width: 0` column whose four actions wrap instead of clipping at 390px (and no longer split "Draft" mid-word); status has one treatment — a tag carrying the tone with the moderation sentence beneath it, not three kinds of full-bleed bar; galleries and grids are element-relative (`auto-fit`/`auto-fill`) instead of `width: 320`/`240`; forms and pages carry a measure.

  **Smaller things.** A visitor's favourites page shows one state with a sign-in door instead of a blocked notice over a spinner; pagers render only when there is a page to go to; the media placeholder is a themed aspect-ratio box with a camera glyph, not a `#d9d9d9` slab; `language` is seeded from the UI locale; `saveSoon()` makes a picker's "choosing IS the commit" save carry the value it just wrote; stored `select` values resolve through the host catalogue instead of printing `demo.condition.used` at people; and `registerListingsI18nRu/Es` now also register `@stapel/attributes-react`'s bundle, so the twelve refusals this pair deliberately does not author are no longer English on a translated page.

  Ten default-skin components, six demos, every one with a phone variant and seeded steps.

## 0.5.0

### Minor Changes

- d778c54: `<ListingComposerPage renderLocationPicker>` — ask a seller WHERE, not for
  their latitude.

  The composer asked for a location label and a raw `lat` / `lon` pair, which is
  a question no advert-poster on any marketplace can answer, and it is why
  `location` was empty on every listing on the client fleet that found it. The
  pair still cannot ask for an address — that needs a geocoder, a geocoder is the
  deployment's, and a library that picked one would pick it for every host — so
  the question is a slot, shaped like `renderCategoryPicker` beside it. It
  carries the whole `ListingLocation` composite including `geohash`, which only
  the resolver has and which this pair still refuses to compute. Unfilled,
  nothing changes: the label and the coordinates are exactly what shipped before.

  `<ListingCard blockedReason>` — how loudly a blocked favourite states itself is
  a decision about the SURFACE.

  `"text"` (default, unchanged) prints the reason and the sign-in door. `"line"`
  keeps the sentence and drops the repeated door; `"tooltip"` moves the reason
  onto the control it is about, where the existing `<span>` wrapper keeps it
  reachable by pointer and by keyboard. On one card the full version is help; on
  a grid of twenty-four it was the loudest thing on the landing page — twenty-four
  doors to the one place the header already links. Same argument, and same shape,
  as `<SearchResultsPane degradationNotice>`.

  `<ListingPhoto>` memoises the host resolver on the image reference instead of
  calling it in render.

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
