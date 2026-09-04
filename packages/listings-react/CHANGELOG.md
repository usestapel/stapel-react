# @stapel/listings-react

## 0.24.0

### Minor Changes

- 47be22a: listings: characteristics read as sentences with units, badges say what they mean, and a card's photos answer a hover

  Three findings from the live listing page and its cards, all measured, none
  of them a preference.

  **The characteristics list stops being a table.** `<Descriptions column={1}>`
  is a real two-column table, and on a phone — and in the split layout's
  half-width left column — the value cell is narrow enough that a long answer
  wrapped inside it and stacked under itself, beside acres of empty label
  gutter. A spec row is a short question and its answer, not tabular data
  scanned down one axis. `<ListingSpecList>` draws it as a paragraph: a muted
  inline `<span>` label, then the value in the same text flow, wrapping at the
  full measure. `<ListingSpecColumns>` keeps the split layout's two columns —
  of whole ROWS, cut by row count so the category's declaration order still
  reads top-to-bottom, left column first. The label is never a column.

  **A number carries its unit and groups its digits.** The live page read
  "Power 173", "Mileage 20000", "Engine volume 2.0": no unit, no grouping, and
  an invariant decimal point in a Russian storefront. `formatSpecValue`
  (`model/featureText.ts`) typesets `int` and `float` — same value, same
  precision rule, same `postfix1000` switch at a thousand — with the digits
  through `Intl.NumberFormat` and the unit appended. Every other type still
  goes through `@stapel/attributes-react`'s `formatFeatureValue` untouched.

  There is **no generic `unit` key** on a feature definition anywhere in this
  fleet: not on `FeatureDef` (`stapel-attributes/base.py:154-208`), not on
  `IntConfig`/`FloatConfig` (`attributes-react/src/generated/featureDef.ts:163`),
  not on the stored DAO. The unit of a number IS its `postfix`, free text on
  the type's config. `dto_to_dao` copies it at WRITE time
  (`stapel-attributes/types/int/type.py:198`), so a listing published before
  its category gained a unit keeps printing without one for the rest of its
  life — which is exactly the live case. `featureFromDao` now adopts the unit
  keys (`prefix`, `postfix`, `postfix1000`, `unitType`, `unit_m`, `unit_i`)
  from the CATEGORY definition the page already holds, wherever the stored row
  is silent about them; the stored row still wins wherever it said anything,
  the same precedence the option table has always used. `precision` is
  deliberately not adopted: a stored value has already been rounded to the
  precision it was written with. Where nothing declares a unit, the bare number
  stands — none is invented.

  **Card badges say what they mean.** A live card read "Brick · 3 · 9": three
  true facts about a flat and two of them unreadable, because a stored
  `features_badges` element carried the value and nothing that says what the
  value is. stapel-listings 0.21.3's card badge contract adds `label`, `unit`,
  `name` and `presentation` to each element, and `presentation` is the server's
  decision — `value`, `value_unit`, `name_value` ("Floor 3", a space and never
  a colon: a card is a caption, not a form) or `name` for a true boolean, whose
  name IS the badge and whose false twin prints nothing. `cardBadgeText` is the
  one place the four are read, and all three card surfaces call it. Carried as
  a local type extension of `ListingFeatureDao` rather than a regenerated
  schema, for the reason that mirror exists at all — the generated `FeatureDao`
  union is unusable and `features_badges` is a `JSONField`.

  A projection where no element declares a `presentation` is a projection from
  a server older than 0.21.3, and it renders exactly as it rendered before,
  through `<FeatureBadges>` off the stored DAO's own config.

  **A card's photos answer a hover and a swipe.** A card with six photographs
  showed one, and the other five needed a navigation. The media box is now
  divided into as many equal segments as there are photographs, the segment
  under the cursor is the photograph on screen, and the pointer leaving puts
  the first one back — a hover is a look, not an edit. It is gated on
  `(hover: hover) and (pointer: fine)` AND on a `mouse` pointer type, because a
  touch laptop answers the media query and still delivers finger events. On a
  finger, a horizontal drag past 32px and further across than down advances or
  rewinds one photograph; the strip declares `touch-action: pan-y`, so the
  page's vertical scroll stays the browser's at the platform level where no
  handler can argue with it, and a diagonal thumb scrolling a feed changes no
  photograph.

  Neither gesture replaces the strip. Both work by SCROLLING the same
  `<SkinCarousel>` the card already draws, so it stays a focusable scroll
  container the arrow keys move, the slides stay in the document in reading
  order, the dots keep reporting the position — and the card stays ONE link
  target with ONE accessible name, the heart outside it, exactly as the earlier
  ruling left it.

  Size budgets raised with the rationale in the entry names: index 14 → 15 KB
  (measured 14.39) for the two model modules, `/default` 22 → 25 KB (measured
  23.94) for the spec list, the badge renderer and the gallery.

## 0.23.0

### Minor Changes

- 8d50f1c: listings: href builders receive the whole row, and a reopened listing reads its own draft twin

  **`listingHref` and `hrefFor` now receive the row as a second argument.** A
  storefront that addresses listings as `/l/<id>-<title-slug>` had only an id to
  build from — no slug, and the page had to repair the URL with a
  `history.replace` after the fact. `MyListingsPane`'s `listingHref` and
  `FavoritesPane`'s `hrefFor` are now called as `(id, row) => href`, `row` being
  the same card the cabinet row or the favourite grid renders from, `title`
  guaranteed present. `(id) => href` still works unchanged — the id stays the
  first argument.

  **Reopening a listing reads its own draft twin.** `GET /{pk}/draft/`
  (stapel-listings 0.21.1, owner-only) answers the exact `save-draft` response
  shape, closing a gap this pair's own composer named as impossible: no read
  returned the `*_draft` fields, so a draft abandoned mid-edit came back empty
  and a live listing's edit seeded from the published half instead of whatever
  was last typed. `useListingComposer` now tries the draft read first and falls
  back to the published-half seed only when it 404s — nothing was ever saved,
  or the backend predates the route.

## 0.22.1

### Patch Changes

- a609bee: Fixed the seller cabinet stamping "a moderator is looking at this by hand"
  on rows whose lifecycle had already moved past the verdict (D225). A
  `needs_review` moderation verdict now gets the same three-way read as a
  `pending` one: the live-edit sentence while the listing is published, the
  first-review sentence while it is still awaiting its first publish, and the
  "a review was requested but the listing is no longer for sale" sentence for
  a sold/paused/archived/draft row carrying a stale verdict — instead of the
  manual-review sentence printing unconditionally on all four.

## 0.22.0

### Minor Changes

- 9587386: The seller's board is a door in both directions, and every button on it does something

  `MyListingCard.available_transitions` (stapel-listings 0.20.0) is the third
  axis — `status` says where a listing IS, `moderation_status` says what is
  being waited on, and neither answers _what can I do about it_. The dashboard
  was re-deriving that from a local copy of the state table, and got it wrong in
  both directions at once on a live board:

  - **Two of the four buttons on an archived row did nothing.** `canTransition`
    answers `true` for a same-status move — correctly, since the server returns
    early on one — so a SOLD row offered "Mark sold" and an ARCHIVED row offered
    "Archive", both enabled, both clickable, both inert.
  - **There was no way back.** `archive` and `complete` were the whole owner API
    and both are exits, so a seller who marked something sold by a misclick had
    `DELETE` and nothing else. The edges that undo it — SOLD or PAUSED to
    PUBLISHED, ARCHIVED to DRAFT, EXPIRED renewed — were in the machine the
    whole time with no route.

  Now: `POST listings/{id}/transition/` on `ListingsApi`, `useTransitionListing`,
  `OWNER_TRANSITIONS`/`ownerMoves` as the fallback mirror for a surface that
  holds a bare status, and `ListingActionsBag.moves` — the moves the server
  declared, in a stable drawing order, and nothing else. A control that would be
  a no-op is not rendered rather than rendered switched off, because "you cannot
  do the thing you already did" is not a refusal worth a sentence.

  Also here, all measured on the same live board:

  - **`listingHref` / `linkComponent` on `<MyListingsPane>`** — the cabinet held
    ZERO links to a listing, so the one move a seller makes after publishing
    ("did that come out right?") needed a hand-typed URL. A row nobody has ever
    published gets no link: the predicate is the server's own (DRAFT plus
    NOT_SUBMITTED), because a never-published row's public page is a blank one.
  - **A fresh draft is no longer announced as REJECTED.** `moderationNotice`'s
    last branch was an unlabelled fallthrough onto "rejected", so 0.20.0's new
    default `not_submitted` made every newly created draft read "A moderator
    turned this listing down" to somebody who had submitted nothing. Unknown
    verdicts now degrade to silence; `not_submitted` says nothing, because the
    lifecycle already says "Draft".
  - **The refusal stops quoting the wire.** "A listing in status 'draft' cannot
    be moved that way" was printed beside a status tag that said "Draft" in the
    reader's own words two lines above.
  - **The row fits a phone.** Every action is `layout="inline"` except Delete,
    which carries a standing sentence, and the whole list sits in one
    `<PaneGate>` so a refusal is printed once instead of once per row: a
    published row measured 495px of an 844px screen and now measures 376.
  - **The card's photo is cut to the card's own corner** (`--listing-card-radius`
    on the media well, square slides inside it), the place line is ONE line that
    truncates — a two-part district name wrapped and left a row of tiles 24px
    ragged — and the card answers a PRESS, not only a hover, on all three
    surfaces: the phone this is used on reports `(hover: hover)` false, so
    `:active` was the only feedback a finger could ever get. The hover rule is
    now inside `@media (hover: hover)`, where it cannot latch after a tap.

  Contract pin moves to stapel-listings v0.21.0 (`available_transitions`, the
  transition route, `ModerationStatus.NOT_SUBMITTED`, and the public card's
  coarsened coordinates — `geo_precision_km` is optional on the card prop for
  the same reason the engagement fields are: the search document does not carry
  it).

## 0.21.0

### Minor Changes

- 8279cb6: **The picture opens the listing, and the card looks like something you can open.**

  Measured on a live 1440px grid: `<ListingCard>`'s anchor covered only the 267×104 text block. The 267×200 photograph — the largest and most obvious target on the card — sat outside it, with `cursor: auto`, and clicking it left the visitor exactly where they were. The card had no hover state of any kind: `box-shadow: none`, `transform: none`, the border unchanged.

  - `<ListingPhotoStrip href linkComponent>` links each SLIDE. The strip itself stays a sibling of the reading anchor — a swipeable scroller is a control and a link may not contain one — but the picture inside it is now part of the card's target. The slide links are `aria-hidden` + `tabIndex={-1}`, so the card is still one tab stop with one accessible name: a second way to reach a destination, not a second destination.
  - `<ListingCard>` passes its own `href` through and carries `CARD_HOVER_CLASS`, which raises the theme's own `boxShadowSecondary` and the focus colour on the border. antd's `hoverable` was not used: it hard-codes one shadow, cannot state a border, and cannot stand still for somebody who asked their system for less motion — this rule does, under `prefers-reduced-motion`.
  - A surface that passes no `href` to the strip renders exactly as before. `<ListingSerpCard>` passes none: a horizontal swipe is a real gesture on a phone, and it is the gesture that rule was written for.

## 0.20.0

### Minor Changes

- 9c8ee74: listings: the gated heart's reason survives the gesture that opened it, and the view count leaves the specs table

  **The anonymous heart, seventh pass, and the first one with a timeline.** Six walker passes read "tap the heart, nothing happens". The disclosure was there and correct — a popover carrying "Sign in to do this" and the door — and it was, in fact, opening on the tap. The instrumented run on the deployed build says so to the millisecond: `click` at +0 ms, `ant-popover-hidden` dropped at +7 ms, the finger lifts and the emulated hover ends at +10 ms, antd's `mouseLeaveDelay` expires at +110 ms, the leave motion finishes and the overlay is hidden again at +260 ms. A quarter-second flash on a phone is not a disclosure.

  The previous fix made activation MONOTONIC for the duration of the click's own dispatch — a flag set in the capture phase and dropped one microtask later. That is the right rule against the click's own toggle, which is the failure a synthetic click can reproduce, and it is blind to this one: the closer is not part of the gesture, it is a timer a fifth of a second behind it.

  So an activated disclosure now PINS. Once a click, a tap, Enter or Space has opened it, hover-out, blur and the trigger's own toggle may no longer close it; only a dismissal does, and because refusing antd's close takes those away, the component listens for them itself — a pointer down outside both the control and the overlay, or `Escape`. A pointer down INSIDE the overlay does not dismiss, or the sign-in link would be gone between the press and the click that follows it. A hover that was never clicked keeps its old, unpinned behaviour, so a cursor crossing a grid of twenty-four cards does not leave a trail of open popovers behind it.

  Five tests, and the first of them fails on the previous implementation with the deployed symptom.

  **The view count is a fact about the page, not a property of the goods.** It rendered as a `Descriptions.Item` in the same table as the location and the stock — on the measured phone page that put "Views 6" between the colour attribute and "Where it is", roughly 1600px down, read as a characteristic of the phone (walker D106). It now reads on a meta line under the title and above the price, where a reader looks for how much company they have. `data-testid="listings-detail-views"` still holds the bare number; the line around it is `listings-detail-meta`.

  Two consequences worth stating. The specs table renders nothing at all when the listing carries neither stock nor a location — the view count used to hide that empty table by almost always being present. And there is still no favourite COUNT anywhere, because the wire has none: `is_favorited` is a per-reader boolean and the schema carries no aggregate, which the existing contract test pins under all five spellings.

## 0.19.0

### Minor Changes

- a9dbe3e: listings: the heart reports its own outcome, a gated heart discloses on the gesture, and an already-seen card is dimmed — with the engagement overlay that makes any of it visible on a search-served grid

  Three defects measured on a live deployment, plus the engagement axis and the batch read that carries it.

  **The heart gave no feedback.** A signed-in person tapped it and nothing moved: the write went out and the invalidation landed, but the row a card draws from is a prop owned by a list query further up, so the icon kept showing the state from before the tap until that query refetched. `useFavoriteToggle` and `useListingDetail` now predict the next state on the gesture, replace the prediction with the server's own `favorited` when the write lands, and roll it back when the write fails — with the failure stated through the pair's existing `ErrorAlert` rather than left silent. The prediction is tagged with the listing id, because a virtualised grid reuses a hook instance across rows. Saved now draws as a filled accent heart and unsaved as an outline, on the cards and on the listing page.

  `is_favorited: null` — "nobody asked on this person's behalf", which is what every anonymous read sends — renders as the not-favorited outline and never as a third look, while staying distinguishable underneath: `FavoriteToggleBag.known` and `ListingDetailBag.favoriteKnown` are what a caller asks before treating the row as authoritative. `ListingDetailBag.isFavorited` is now `boolean` rather than `boolean | undefined`.

  The wire carries `is_favorited` and no favourite COUNT, so none is drawn. A test asserts that against the generated schema, so the day one lands, rendering it is a decision rather than an invention.

  **An anonymous person's heart was a dead button.** Two causes wearing one symptom. The favourite control is no longer html-`disabled` in any volume on any surface: it carries `aria-disabled` with a live handler and refuses on activation, because an inert button takes no focus, receives no pointer events, and can explain itself to nobody. And `GateReasonPopover` is now a controlled disclosure whose activation is monotonic — an uncontrolled popover triggered by hover and click treated the click as a toggle, so a pointer that rested on the heart and then pressed it closed the only explanation the control had. The existing tests never caught it because a synthetic `click` carries no hover in front of it.

  `<ListingFeedCard>` was the last surface still printing the standing "sign in" caption over its photograph; it now takes `signIn` and `blockedReason` and defaults to the interaction disclosure, since a two-column tile has no line to put a sentence on. A host that wants the standing sentence asks for it with `blockedReason="text"`.

  **A viewed state.** The engagement fields are read through `model/engagement.ts` (`isListingViewed`, `listingViewCount`) and declared as an optional `ListingEngagementFields` extension beside the generated schema, which is emitted from the pinned sibling and not ours to hand-edit. All three cards dim an already-seen listing through one rule in the stylesheet they already share — opacity, so it needs no second colour for dark mode — and the listing page prints the view count when there is one. Absent and `null` are a silent no-op: no dimming, no count, no console noise, no layout shift.

  The flag is `viewed` (stapel-listings 0.16.0/0.17.0 settled it; an earlier draft of this work read `is_viewed` as well, and that hedge is gone). `null` means an anonymous caller — nothing is remembered for a stranger, and `false` would be a claim rather than an absence — so it draws the undimmed card and never claims "not seen".

  **The engagement overlay, which is the half that makes the state visible at all.** On this module's own card list and on the listing page the flags arrive on the row. On the two surfaces a buyer actually scrolls they never do: a storefront's home feed and its SERP are drawn from the SEARCH index, whose stored document can carry neither a flag that differs per reader nor a counter that moves faster than a re-index. Without this, every card on exactly the screens the feature was asked for renders undimmed with an outline heart, and nothing anywhere reports a fault.

  So the pair now speaks `GET /listings/engagement/?ids=…` — one call per page, `{id: {view_count, viewed, is_favorited}}`, `AllowAny` so a signed-out grid is not a second code path. `useListingEngagement` is the read; `<ListingEngagementScope ids={…}>` runs it once and publishes the answer; every card inside looks itself up through `useEngagedListing` and merges the entry over its own row. The cost is per page and the reader is per card, which is why it is a scope and not a prop: an `engagement` prop on the card would make each card responsible for its own answer, and the shortest way to satisfy that is forty requests for a decoration.

  Every failure mode is a silent no-op, deliberately: no scope, an empty page, an id the answer did not carry, a read still in flight, and a read that **failed** all leave the card drawing from its row, with no retry and no error surface. A grid that renders is worth more than a flag. Ids are normalized (sorted, de-duplicated, capped at the server's own `ENGAGEMENT_BATCH_LIMIT`) before both the request and its cache key, so a re-ordered page cannot buy a second request.

  **The contract pin caught up, and the mirrors are gone.** `contract-pins.json` now pins stapel-listings at the 0.17.0 line, so the generated schema carries `viewed`, `view_count`, `ListingEngagement`, `ListingEngagementBatch` and the engagement endpoint. The hand-written mirrors this pair carried while the pin lagged have been deleted: `ListingEngagement` and `ListingEngagementBatch` are now aliases of `Schemas[…]`, and `ListingEngagementFields` picks its field NAMES off `Schemas["ListingCard"]`, so a rename upstream is a compile error here rather than a grid that quietly stops dimming. The test that asserted the schema still lacked the surface — the mirrors' expiry — has been rewritten to assert the derivation instead.

  One deliberate divergence from the generated row survives, and it is load-bearing: the engagement fields are REQUIRED on `Schemas["ListingCard"]` and OPTIONAL on this pair's `ListingCard`, `ListingDetail`, `MyListingCard` and the two pagination envelopes. A generated type is a promise about the contract, not about the bytes a deployment sends — and the pair's most important card source, the search index reached through `renderCard`, cannot supply them at all. Requiring them on the card prop would make the primary consumer unable to satisfy its own type for data no one can produce, which is the very case the overlay exists to answer.

  **Also carried in by the pin bump**, all additive and fixed here rather than left for the next wave:

  - Two new publish refusals, `error.400.listing_location_required` and `error.400.listing_zero_price_not_allowed` (a price of 0 is an empty field, not "free"), now with Russian and Spanish sentences. They arrived English-only and the i18n suite is what caught them; the registry assertion moves 66 → 68.
  - `ListingPriceProps.amount` widens to `string | null | undefined`. `price` is now spelled `string | null` in the schema (D51: a blank price stays null server-side), which is what the component's own `hasAmount` guard has been defending against from the start — the type now says what the runtime already knew.

  **Adopted the substrate's new gate binding.** `@stapel/tokens-antd`'s `GatedControl` now owns "a gated control is never inert" for the whole fleet: it supplies `aria-disabled` in the binding, keeps html `disabled` false, and suppresses the action itself in a capture-phase wrapper. No `tabIndex` rides in the binding and none is needed here: dropping html `disabled` is what restores focus on a native control, and every control this pair gates is one. This pair's three hearts and its composer spread that binding whole instead of deriving `aria-disabled` from `bind.disabled`. Several of this package's tests had been using html `disabled` as a READINESS signal ("wait until the publish button is enabled"), which stopped meaning anything the moment `disabled` became permanently false — they now wait on the gate's own `data-stapel-gated="available"` stamp, which is what they were always trying to ask.

  Bundle budgets move: the headless entry 13 → 14 KB (measured 13.0, for the overlay read, its key and its scope) and the skin 20 → 21 KB (measured 20.38). Both arguments are in `package.json`.

## 0.18.2

### Patch Changes

- The phone SERP card can state a blocked heart's refusal as a gesture (D45).

  `<ListingSerpCard blockedReason="popover">` — the choice the grid card got in
  the desktop pass, now on the one-column card a phone actually uses. A
  signed-out walker measured "sign in to do this" printed fourteen times down
  one search page, once under every card, in the line where a price or a place
  belongs; fourteen copies of one sentence is not fourteen pieces of help. The
  mechanism is this package's existing `GateReasonPopover`: it opens on tap as
  readily as on hover, its anchor is `aria-disabled` rather than html-disabled
  (so the tap is not swallowed), and the sentence stays in the accessibility
  tree wired to the heart. `signIn` puts the door inside the disclosure.

  Default unchanged — a host that says nothing still gets the standing line.
  `<FavoriteHeart>` carries both arms now, so any surface mounting it inherits
  the choice.

## 0.18.1

### Patch Changes

- c9f6b42: Refusals reach the fields on a SUBMIT ATTEMPT, not on a save (D54), and an
  absent price is a sentence, never a zero (D51).

  - `save()` no longer arms `showErrors`. Saves are housekeeping — the flat page
    saves on every blur, a staged host on every step change — and a draft is
    allowed to be incomplete; that is what a draft is. Arming the mirror there
    meant two or three red "field is required" lines under untouched fields
    before the person's first keystroke, on every step they entered. `publish()`
    still arms it, so a refused submit still names every field it refused.
  - `<ListingPrice>` treats a `null` amount off the wire as absence rather than
    reading `.length` off it: with the server keeping a blank price null, the
    card and the detail page now render the catalogue's own no-price line
    instead of throwing or printing a zero. That line is reworded from "price on
    request" to "price not specified" in all three catalogues — a seller who
    skipped the field has not offered to negotiate.

## 0.18.0

### Minor Changes

- e1c517a: The skin component registry — the substrate's second restyle layer (owner
  mandate 2026-08-31; design doc `docs/skin-component-registry.md`).

  `@stapel/tokens-antd/skin` gains `SkinProvider`: a host registers a
  replacement `Button`, `Input` and/or `Dialog` surface ONCE, at the app
  root, and every substrate render below it — `GatedButton`, `ErrorAlert`'s
  retry, `SkinConfirm`'s arms, `RowActions`, `PermissionSheet`, the picker
  footer and search box, `SkinNumberField`, `CountedInput`, `SkinDialog` and
  everything composed on it — draws the host's anatomy instead of antd's.
  Tokens keep answering "what colour"; the registry answers "what IS a
  button". New exports: `SkinProvider`, `SkinButton`, `SkinInput`,
  `useSkinComponents`, and the slot contracts `SkinButtonProps`,
  `SkinInputProps`, `SkinDialogSlotProps` (typed props plus documented
  anatomy duties, checked in dev builds with a loud `console.error` per
  violation). With no provider the markup is byte-identical to 0.14 — pinned
  by pre-change snapshots.

  attributes-react, listings-react and drive-react migrate their default
  skins' direct antd `Button`/plain-`Input` imports to the registry-resolved
  `SkinButton`/`SkinInput` (alias-only import diffs, zero JSX changes) and
  raise their `@stapel/tokens-antd` peer floor to `>=0.15.0`, so a host-level
  registration reskins these pairs completely with no pair wiring.

## 0.17.0

### Minor Changes

- 309890a: The listing page gets a desktop, the blocked heart gets an indoor voice, and
  the taken-down listing gets an honest sentence. All three from one desktop
  walk of a live classified deployment at 1440×900.

  - **`layout="split"` + `aside` on `<ListingDetailPane>`.** Measured: the
    whole listing page was a ~930px single column hugging the start edge, the
    price a 22px line UNDER the title and smaller than it, the right half of
    the screen empty — where the reference design is two columns. The split is
    a CSS grid `minmax(0, 1fr) 380px`: gallery, title, description and specs
    on the left; a sticky buy column on the right with the price LARGE at its
    top (level 2, above everything), then the actions row, then `aside` — the
    host's seller block. Specs render as TWO `<FeatureValueList>` columns in
    the split, halved by row count so category declaration order reads
    top-to-bottom, left column first. The pane's measure widens from the
    one-column `DETAIL_MEASURE` (60rem) to `DETAIL_SPLIT_MEASURE` (75rem) —
    the reading column keeps its line with the buy column beside it. The host
    states the axis (the CategoryPage `subcategories` rule); the default
    `"column"` is byte-compatible, and a column-layout `aside` joins the flow
    directly above `footer`.
  - **`blockedReason: "popover"`** — the third arm on the cards, and a
    `blockedReason?: "text" | "popover"` prop on the pane. Measured: the
    standing "sign in to do this" caption printed under EVERY card, 24 copies
    per screen. The docstring used to argue there is no third setting; the
    honest rewrite is that a pooled scope and a per-card line are both still
    STANDING copy, and the product ruling is that the door belongs on
    interaction. The new arm renders nothing standing: the reason and the
    sign-in door disclose in a Popover on the heart itself, opening on hover
    AND focus AND click/tap — the anchor is `aria-disabled`, never
    html-disabled, so the events actually arrive (the grave the old Tooltip
    died in) — while a visually-hidden copy of the reason stays wired to the
    button via `aria-describedby`, so the refusal reaches assistive tech
    without a pointer.
  - **`withdrawn` on the detail bag, and a fifth sentence on the pane.** A
    taken-down (archived, not deleted) listing answers 404 on the detail read
    while the AllowAny status probe answers 200 — on the live stand the
    probe's whole body was `{"is_deleted": false}` — and the pane fell into
    the generic "could not load / retry" arm: a retry that can never help, on
    a row that is gone on purpose. `useListingDetail` now reports
    `withdrawn` (detail 404 + probe answered + `is_deleted !== true`, guarded
    for a body carrying the flag alone), and the pane's failed ordering is
    removed → not found → withdrawn → generic: the withdrawn arm is an
    `EmptyState` with its own key (`listings.detail.withdrawn`, en/ru/es) and
    NO retry control.

  `/default` budget raised 19 → 20 KB for the second assembly of the money
  page plus the disclosure arm.

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
