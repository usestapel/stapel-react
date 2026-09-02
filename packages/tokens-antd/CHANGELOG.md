# @stapel/tokens-antd

## 0.12.0

### Minor Changes

- e2ec0f2: The substrate a field-level picker is built out of: one recency hook, four controls.

  `ChoiceChips` also takes the field's `id`, landed on the FIRST chip — the
  group's focus target, the way a radio group's label points at its first
  input — with an explicit per-chip accessible name so the field's label
  cannot override what the chip answers. A composer that reveals "the first
  unanswered field" by element id gets a focusable control, not a wrapper
  `<div>` that swallows the focus call. `SkinNumberField` and `CountedInput`
  accept `ariaRequired` for the same reason: the one attribute a required
  field owes its own control is contract, not a caller's DOM-poking effect.

  Every value kind in the catalogue — 2132 reference selects, 795 inline selects,
  multiselects, numbers with units, VIN-like strings — was being drawn by each
  pair out of raw antd, and the same four decisions were being re-taken with
  different answers per package. They are taken once here.

  **`@stapel/core` — `useRecents(scope, { max })`.**
  The codes a person picked last, most recent first, deduped, capped, surviving a
  reload. Headless on purpose: "the four makes you last chose, on top of the list"
  is the same product rule in an attributes ref editor, a vocabulary term control
  and (next) a search facet, so it cannot live in any one of them and must not
  live in the antd bridge either. It persists through the `PersistStorage` ladder
  that is already here (IndexedDB → localStorage → memory), never touches a
  storage global directly, reads nothing during render (so a server render and
  the client render that must match it are both an empty list), and never throws:
  a refused backend, a full quota or a corrupt stored value costs the memory, not
  the picker. Two controls on one scope share a list without a round trip.

  **`@stapel/tokens-antd/skin` — `ChoiceChips`, `SkinPickerSheet`,
  `SkinNumberField`, `CountedInput`.**
  Four design-system rules, each stated once where every antd skin already
  inherits from:

  - **A handful of options is picked INLINE**, as 44px chips that wrap and never
    truncate a label mid-word. A chip that cannot be chosen states its reason as
    visible text under the row, once per distinct sentence, with
    `aria-describedby` pointing at it — the shape `GatedControl` and `PaneGate`
    already use, because a disabled control receives no pointer events and a
    tooltip on it is an explanation nobody can read.
  - **A LONG list is picked in a bottom sheet with a search box, never a
    dropdown.** `SkinPickerSheet` composes `SkinDialog`, so it is a sheet on a
    phone and a modal above the tablet breakpoint, with the swipe, the focus trap
    and the safe-area padding already solved. Single-select answers and closes on
    the tap; multi-select holds a draft and commits it on a footer button that
    carries the count it is about to keep (and no count at all at zero, where
    "Done · 0" would read as a broken counter). It models four states a `Select`
    never had: loading (the commit is not blocked — what is already chosen is
    still chosen), empty, capped at 200 rows with a tail row that says so, and
    `listStale` — rows that no longer answer what is in the search box are dimmed
    and made inert, so nobody picks the previous query's fourth row believing it
    is this query's. Two pairs had improvised that last one; it is a first-class
    prop now.
  - **A numeric field raises the numeric keypad, wears its unit as a suffix that
    is never part of the value, and treats min/max as a HINT.** `SkinNumberField`
    is deliberately not antd's `InputNumber`, which clamps: typing 9 towards 95 in
    a max-50 field leaves 9, and a blurred 120 becomes 100 with no sentence
    anywhere saying so. Out of range is the caller's validation to display, beside
    the field, in words — and the raw text is kept, so a half-typed `1.` does not
    snap back to `1` and `1.5` can be typed at all.
  - **A length limit is a live counter, never a silent cap.** `CountedInput`
    counts Unicode code points — the unit the backend validates in — and never
    sets the DOM's `maxlength`, which counts UTF-16 units and would stop somebody
    two emoji short of the real limit with no message at all. `normalize` runs
    where foreign text enters (the paste, at the cursor) and once more on blur,
    never per keystroke.

  Demos for all four at 390px, including the states that only exist because
  nothing is being enforced silently: a stale list, a capped list, a number past
  its stated range, a counter reading 19 / 17.

### Patch Changes

- 3d42267: `SkinNumberField` and `CountedInput` accept `ariaRequired` — the one
  accessibility attribute a required field owes its own control, stated as part
  of the contract instead of left to a caller's effect poking the rendered
  input. Absent by default; nothing else changes.

## 0.11.0

### Minor Changes

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

## 0.10.0

### Minor Changes

- 5f9b005: Refusing geolocation is no longer a dead end in the location field.

  A night e2e run on a live storefront found that a seller who declines the
  location pre-prompt cannot file a listing at all: "Not now" closed the sheet
  and left the field empty, the next tap re-asked the same question, and a
  browser prompt that was opened and never answered left the sheet spinning in
  its `prompt` arm forever. Without a place, Publish never enables.

  The measured cause of the last one is a spec detail worth writing down: the
  Geolocation spec stops `getCurrentPosition`'s `timeout` clock while the
  permission decision is pending, so a prompt nobody answers calls **neither**
  callback, ever — verified in Chromium, where an ungranted context never
  settles while the same call under a granted permission rejects with `code: 3`
  after exactly its `timeout`.

  - **`usePermission`** now always settles. `request()` waits for the attempt,
    but gives up once `decisionTimeoutMs` (new option, default 20s) has passed
    _and_ the Permissions API still reports the question open — so an unanswered
    prompt hands control back instead of hanging, while a slow GPS fix the
    person actually allowed is never cut short.
  - **`PermissionSheet`** renders `fallback` in every arm but `granted`, not
    only when the capability is blocked. The way around was previously offered
    only after a refusal had been recorded, which left "Not now" — the answer
    the sheet's own way out invites — as the one answer with nothing behind it.
  - **`LocationField`** treats every exit from the sheet as the door it always
    documented: dismissing it, or an unanswered browser prompt, opens the picker
    on the IP centre. The position only ever centred the map. The pre-prompt is
    also asked once per field rather than on every tap.

## 0.9.0

### Minor Changes

- 746b74e: `SkinCarousel` — the fleet's one swipe primitive, on native scroll-snap.

  A horizontal photo strip is a design-system shape, not a listings feature: the
  result card, the listing page, a category rail and a shop's promo row all want
  the same strip, and the moment two of them hand-roll it a product has two
  different swipe behaviours in it. It joins `SkinDialog` in the substrate for
  the same reason that one is there — `@stapel/tokens-antd` is the package every
  antd default skin already depends on.

  There is no gesture code, and that is the design. The strip is a scroll
  container with `scroll-snap-type: x mandatory` and slides on
  `scroll-snap-align: start`, so momentum, the fling curve, the rubber-band at
  both ends and the tap-that-must-not-become-a-drag are the platform's, tuned
  per OS. What that buys for free: trackpad and shift-wheel scrolling on a
  desktop, the browser's own scroll-into-view when Tab lands on a control inside
  slide four, and a screen reader's normal reading order — the slides are IN the
  document, never swapped by state.

  - `peek` (default on, `SKIN_CAROUSEL_PEEK` = 8%, or a CSS length, or `false`)
    keeps the EDGE of the next slide on screen. That sliver is the only thing
    telling a visitor there is more, and it is what people swipe at.
  - `aspectRatio` fixes the shape of one slide well, so a gallery does not change
    height as each image lands.
  - `dots` draws a position indicator that is `aria-hidden` and holds no buttons:
    a tappable dot needs a name per dot, which is i18n copy the token bridge
    cannot invent, and the strip's list semantics already announce "item 3 of 12"
    in every locale with no key to register. The indicator follows the scroll on
    one rAF-coalesced measurement per frame and re-renders only when the index
    actually changes; a strip with neither `dots` nor `onSlideChange` attaches no
    scroll listener at all.
  - `label` is a REQUIRED prop, the same contract `SkinDialog.dismissLabel`
    states — an unnamed scrollable region is announced as nothing.

  The scrollbar is hidden (`SKIN_CAROUSEL_STYLE_HREF` / `skinCarouselCss()`, one
  hoisted sheet per document), which is only safe because the strip itself is a
  focusable scroll container: a keyboard reaches it and the arrow keys scroll it.
  Colours are `cssVar()` role references carried in `--skin-carousel-*` custom
  properties, so light and dark are correct by construction and one static sheet
  serves a page full of carousels.

  New from `/skin`: `SkinCarousel`, `SkinCarouselProps`, `SKIN_CAROUSEL_PEEK`,
  `SKIN_CAROUSEL_STYLE_HREF`, `skinCarouselCss()`, and the four class-name
  constants (`SKIN_CAROUSEL_CLASS`, `…_STRIP_CLASS`, `…_SLIDE_CLASS`,
  `…_DOTS_CLASS`, `…_DOT_CLASS`).

## 0.8.1

### Patch Changes

- b802daf: The skin repaints when the host brand attribute changes.

  `@stapel/tokens`' generated `tokens.css` keys on two attributes of `<html>` —
  `data-theme` picks the side, `data-brand` picks the scoped ramp
  (`:root[data-brand="…"]`) — and both move the same live `--stapel-<role>`
  values `SkinTheme` builds antd's token bag from. `SkinTheme` subscribed to the
  first and not the second, so a host that resolves its brand at runtime (a site
  provider stamping `data-brand` in an effect, i.e. after the render that already
  built the theme) got antd controls — primary buttons, focus rings, links —
  frozen in the brand the page booted with, until something unrelated re-rendered.

  `SkinTheme` now follows both attributes, and the theme cache is keyed on the
  brand scope as well as on the live brand value (two scoped ramps may share a
  `--stapel-brand` and differ in every other role). New exports for a consumer
  that caches anything built from the live custom properties: `BRAND_ATTRIBUTE`
  and `hostBrandScope()` from the root, `useHostBrand()` and
  `subscribeHostBrand()` from `/skin`. One MutationObserver now serves the whole
  document for both attributes, dispatching per attribute, instead of one per
  mounted skin.

  Hosts carrying a private `data-brand` observer to force the repaint can drop it.

## 0.8.0

### Minor Changes

- 481db42: **A browser permission is now asked for once, in one place, by the substrate.** `usePermission(kind)` in `@stapel/core`; `PermissionSheet` and `PermissionGate` in `@stapel/tokens-antd/skin`.

  A permission prompt is a single line the product cannot write, fired once, with no second chance: _"example.com wants to use your location"_, Allow / Block. Everything that makes it answerable — why we are asking, what happens if you say no, and where the switch is once you have — has to be said BEFORE it, by us. Fire it cold on page load and it is refused by reflex, and a refusal is **permanent**: the browser will not ask again, however many times the button is pressed.

  Nothing in the fleet held any of that. The only permission-aware code that existed was geo-react's `useBrowserPosition`, which owned one kind and one of its four refusals; a chat pair wanting `notifications`, a composer wanting `camera`, a recorder wanting `microphone` each had a `try { … } catch { }` and its own guess about what the catch meant.

  **`usePermission(kind)` — `@stapel/core`, headless.** `geolocation` / `camera` / `microphone` / `notifications`, as five states rather than a boolean:

  - `granted` — use it.
  - `prompt` — not asked yet. Explain first. **Not a refusal**; a product that renders it as one shows an error to somebody who has simply never been asked.
  - `denied` — refused, and terminal. Say where the switch is; offer the way that does not need the capability.
  - `unknown` — the browser will not say in advance (Safari answers `navigator.permissions.query({name: "camera"})` with a `TypeError`; Firefox knows `geolocation` and `notifications` and not the media pair). Ask and find out — a different state from `prompt`, because it cannot be pre-flighted.
  - `unsupported` — no such capability here (old browser, insecure context, no camera on the device), or the DEPLOYMENT turned the offer off with `offered: false`. Render the fallback, not a disabled control: there is nothing the person can do about it.

  Three details the four ad-hoc copies each got differently. `request()` **resolves** with the resulting status and never rejects, because every caller of it is inside a click handler. Notifications are read off `Notification.permission` rather than the Permissions API — synchronous, older, and the one kind whose answer is reliably available everywhere. And there is no "request permission" API for geolocation or media: the prompt appears because you asked for a position or a stream, so `options.requester` lets a caller that already makes that call pass its own, and the browser is asked **once** instead of twice. Without one, the hook makes the smallest call that provokes the prompt — and stops the media tracks afterwards, because the prompt was the point and a live track leaves the recording indicator on.

  **`PermissionSheet` / `PermissionGate` — `@stapel/tokens-antd/skin`.** The pre-prompt is a `SkinDialog`, so it is a bottom sheet on a phone and a modal above it without this file choosing. The way out says "Not now", not "Deny" — the browser has not been asked yet and the button must not read like an answer to it.

  The refusal is handled in the same surface: on `denied` the sheet does **not** close onto a dead end. It swaps to the guidance for turning the capability back on and renders the `fallback` — the way forward that does not need it (a search field where the position would have been, an upload button where the camera would have been). The Allow button is **gone** rather than disabled: `GatedControl`'s rule about showing a blocked control's reason is for gates the person can open, and this one they cannot, from here.

  `PermissionGate` is the whole ask as one element — trigger, pre-prompt, granted content, fallback — and `askOnMount` is **off** by default, because a question nobody invited is the thing this component exists to stop.

  Copy: core's UI floor gains `PERMISSION_COPY_KEYS` — a title, a why and a denied-guidance sentence per kind, in en/ru/es, seeded under every locale by `createI18n`. A pair gets an answerable question with zero wiring; a product with a better sentence passes a prop or registers the same key. The token bridge still invents no English of its own.

  Both size budgets moved deliberately and the reason is recorded in `package.json`: core 12 → 13.5 KB (12.6 KB actual), and the skin subpath stays under its 16 KB at 9.1 KB.

  Exported for the chat wave: `usePermission`, `PERMISSION_KINDS`, `permissionSupported`, `PERMISSION_COPY_KEYS` from `@stapel/core`; `PermissionSheet`, `PermissionGate`, `permissionIsBlocked`, `PERMISSION_ALLOW_TESTID`, `PERMISSION_DISMISS_TESTID` from `@stapel/tokens-antd/skin`.

### Patch Changes

- Updated dependencies [042a088]
  - @stapel/tokens@0.6.0

## 0.7.0

### Minor Changes

- d3c98a1: The third visual pass traced its remaining defect classes to the substrate; this release closes them where they were traced.

  - **A nested bare `SkinTheme` inherits the pin above it.** `mode` resolves `props.mode ?? inherited.mode ?? liveMode`: a demo pinning `mode="dark"` around a self-wrapping surface no longer renders that surface light (search: 16 of 29 dark shots; reviews' sign-in door; geo's `--dark` guard).
  - **The phone touch floor reaches every control.** `PHONE_TOUCH_FLOOR` raises `controlHeightSM` to 44 as well, puts `Rate` stars on a 44px pitch and checkbox/radio boxes at 24px; `phoneTouchFloorCss` (hoisted once, scoped under `[data-stapel-skin-phone]`) gives rate stars, checkbox/radio rows, clickable tags and list/menu rows a 44px hit area.
  - **Status surfaces from the `*-bg` / `*-border` roles.** `toAntdTheme` maps `colorSuccessBg`, `colorWarningBg`, `colorErrorBg`, `colorInfoBg` and their borders/hovers from the token JSON instead of antd's palette derivation — the khaki warning and sage success are gone. `colorPrimaryBg`/`Hover`/`Active` come from `brand-subtle`/`brand-hover`/`brand-active`.
  - **Dark primaries readable.** `colorTextLightSolid` is the `text-on-accent` role (near-black in dark), so a primary button's label holds AA on the lavender dark fill; `Tooltip` keeps a light label in both modes. Tested with a WCAG contrast assertion.
  - **The sheet fits its content up to 90dvh**, body scrolls, footer pinned (`sheetSizingCss`, `SHEET_MAX_HEIGHT`) — no more 378px sheet clipping mid-sentence with the primary below the fold.
  - **New primitives:** `Pane` / `Page` (the measure and padding scale; `PANE_MEASURES`), `StatusTag` (one treatment per status family), `RowActions` (wrap between buttons, never inside a word; overflow into a sheet on a phone), `PaneGate` (one refusal per pane; pools identical per-control reasons through `GateReasonScopeContext`), `ListRow` / `CardHeader` (`min-width: 0`, wrap not truncate, badge and actions slots), `DataTable` (table or cards by element width).

  Additive: every existing export keeps its signature. Peer `@stapel/core >=0.18.1` for the `more` / `actions` floor keys `RowActions` reads.

### Patch Changes

- e617a05: **A dialog is now themed where it is PAINTED.** `SkinDialog` and `SkinConfirm` carry the skin theme into their own portal, so a dialog no longer depends on the caller having wrapped it.

  A dialog portals to `<body>`, so the `ConfigProvider` it paints under is the one above the `<SkinDialog>` ELEMENT — beside the trigger — not the one wrapping the screen's panel. Every pair that did not wrap the dialog itself shipped a dialog on antd's default LIGHT algorithm over a dark app: the third visual pass found it in calendar, docs and chat, and its first reading ("three sheet implementations, one of them theme-aware") was wrong — all three already rendered through `SkinDialog`; only the wrapper differed.

  - `SkinDialog` renders `SkinTheme surface="bare"` around the antd component (so the PANEL, its header, its close button and its footer are on the right algorithm — not only the body) and again inside the portal, where it stamps `data-stapel-skin-mode` on the painted content.
  - The mode is the nearest enclosing `SkinTheme`'s, and the live document mode when there is none — the same order `SkinTheme` itself uses, so a screen that pins `mode="dark"` keeps the pin through the portal.
  - A caller that already wraps its dialogs keeps working and pays nothing: `AppliedThemeContext` makes the nested wrapper a plain `<div>` with no second provider. The outer wrapper is `display: contents`, so it adds no box to the row the trigger sits in.
  - The sheet's grab handle reads `colorFillSecondary` from inside the sheet, so the chrome is painted from the panel's own tokens.
  - No `stapel/dialog-needs-theme` lint rule: a rule could only ask the next pair to write by hand what the substrate now writes for it, and it could not see the case that actually shipped — a `SkinTheme` that is in the file but does not enclose the dialog element. Recorded in `no-bare-dialog`'s docblock.

  Internal: the viewport rule (`useDialogSurface`, `MODAL_MEDIA_QUERY`) moved to `skin/dialogSurface.ts`, since `SkinTheme` and `SkinDialog` now both read it. Both are re-exported unchanged from `@stapel/tokens-antd/skin`.

- 61e8615: The two additive items the account-group builders filed against the substrate.

  - **`useElementWidth(ref, { thresholds })` is exported from `@stapel/tokens-antd/skin`** — the fleet's one element-width measurement. Five packages wrote their own this wave (`billing-react/src/default/elementWidth.ts`, `calendar-react/src/default/useElementWidth.ts`, `docs-react/src/default/useSplitLayout.ts`, `geo-react`'s `TileMap`, `gdpr-react/src/default/DataTable.tsx`), each with its own answer to what a zero width means and what an unmeasured box means. Both are stated once here: zero is not a measurement (a `display:none` box must not stick to its narrow arm), and unmeasured is `undefined` — `width` and every named threshold — so a caller states its own seed (`below.cards ?? phone`) instead of inheriting somebody else's guess. `DataTable` and `Pane` now read it, and `Pane`'s gutter step follows the pane's OWN width rather than the viewport: a 360px column on a desktop gets the tight gutter.
  - **`ErrorAlert`'s actions stack under the message in a narrow box (VC-B6).** antd puts `action` in a column beside the message; below `ACTION_STACK_BELOW` (the `narrow` measure, 576px) of ELEMENT width the retry moves under the message and detail instead, so the sentence keeps the full width of the alert. Measured in Chromium: the message column in a 390px box goes from the squeezed ~110px to 300px, while a 900px box keeps the action column. The alert is wrapped in a measured `<div data-stapel-error-actions="inline|stacked">`; `data-stapel-error="block"` stays on the alert itself.

  Additive: every existing export keeps its signature.

- Updated dependencies [f9d8b66]
  - @stapel/tokens@0.5.1

## 0.6.0

### Minor Changes

- 350f61f: `/skin` becomes the shared skin substrate: the rules every antd default skin inherits instead of re-deciding.

  Nine pairs carried a copied `src/default/theme.tsx`; fifteen carried a copied `ErrorAlert.tsx` in six flavours; nine sites rendered a `Popconfirm` on a phone; blocked controls explained themselves in tooltips nobody can hover. Each of those is a design-system decision re-taken per component, and a decision re-taken is not a decision. This release states each one once, in the package every antd skin already depends on.

  - **`SkinTheme` + `useThemeMode()`** — the ONE self-theming wrapper. `mode` defaults to the document's LIVE `data-theme` (reactive: `useSyncExternalStore` + a MutationObserver), never `"light"`, so a runtime toggle re-themes mounted skins and a dark deployment is dark on the first frame. It paints its own surface (`raised` by default, `base`, or `bare` to opt out) so typography never lands on a host page of the other side, and on a phone it raises antd's `controlHeight` to 44px so every control in every pair is a touch target.
  - **`SkinConfirm`** — a confirmation is a dialog: a bottom sheet on a phone, a small modal on desktop, through `SkinDialog`. Controlled (`open`, `confirming`), `danger` variant (red, cancel focused first, backdrop does not answer), labels from core's floor unless the action names itself.
  - **`ErrorAlert`, `EmptyState`, `LoadBoundary`, `LoadList`** — the union of the fifteen copies' props (`error` described, `thrown` raw, `message`, `onRetry`, `onDismiss`, `action`, `variant="block"|"inline"`), a designed empty state (icon, title, hint, action), and `matchLoad`/`matchList` as components with default loading/failed/empty arms.
  - **`GatedControl` / `GatedButton`** — a control plus its `ActionAvailability` reason as visible text beside it, linked by `aria-describedby`. Never a tooltip: a disabled button is not hoverable or focusable.
  - `useDialogSurface` documents why a DIALOG reads the viewport while everything inside a box measures the box.
  - `THEME_ATTRIBUTE` is exported from the root.

  Peer: `@stapel/core >=0.17.0` (the substrate's copy comes from core's `stapel.ui.*` floor in en/ru/es). `@stapel/eslint-plugin`'s `no-bare-dialog` gains `Popconfirm` in its own release.

- 407a6e3: `SkinConfirm` — a confirmation is a dialog, not an anchored popover.

  `Popconfirm` is the same defect the sheet rule was written for, in a smaller
  hat: it positions itself beside its trigger and sizes itself to desktop prose,
  so on a 390px phone it renders half off-screen or on top of the row being
  confirmed, with its Ok/Cancel targets under the touch minimum — and two of the
  fleet's thirteen sites had one floating over a bottom sheet.

  `SkinConfirm` is a `SkinDialog` with a question, a body and two answers, so it
  is a sheet on a phone for free and needs no second decision about shape. A
  destructive answer sets `maskClosable={false}`, because on a phone the backdrop
  is most of the screen and that particular dismissal is permanent. The
  destructive verb takes its own label rather than reusing the trigger's:
  "Remove" on a row and "Remove" as the irreversible answer are one word doing
  two jobs.

- 308e3d6: `SkinTheme` stops charging per instance, and the design-system scale rides the edge a skin already declares.

  **The cost.** `forms-react` reported its one full-skin test going ~1.8s → past vitest's 30s default on migrating to `SkinTheme`, and guessed the antd theme scope was being regenerated every render. It was not the renders — the memo was already there — it was the boundary: the memo was per COMPONENT, so ten skinned parts on a screen built ten deep-equal-but-distinct `ThemeConfig` objects (fifteen `getComputedStyle` reads each), and a list whose rows wrap themselves built one per row. Every distinct config is a fresh antd `ConfigProvider`, measured at ~9ms of mount apiece in jsdom. The doctrine tells pairs that "parts may wrap themselves AND be wrapped" costs nothing extra, so the substrate now makes that true instead of the pairs paying for it:

  - one config object per distinct answer (mode × phone × the host's live token scope), shared process-wide, keyed on the host's own `--stapel-brand` so a customized or late-arriving `tokens.css` still wins;
  - a nested `SkinTheme` whose answer is the one already applied above it renders its painted root and **no provider at all** — it never touches the cache or the DOM to decide. A nested skin pinning the other `mode` still gets its own, as it must;
  - `toAntdTheme` resolves all fifteen roles through ONE `getComputedStyle` handle instead of fifteen;
  - `useDialogSurface` keeps one `MediaQueryList` instead of building one per render of every consumer — `useSyncExternalStore` asks for the snapshot on every render, and `SkinTheme` is a consumer.

  Measured in `test/skinThemePerf.test.tsx`: 200 self-wrapping rows went 1.8s → 83ms of mount, and the regression is held by counting theme BUILDS (a whole number that does not move with the machine), not by a stopwatch.

  One behaviour nuance: a foreign `ConfigProvider` deliberately interposed between two `SkinTheme`s is no longer overridden by the inner one. `src/default/**` has no such providers by doctrine; a skin that means to override declares it on its own `mode`.

  **The scale.** `@stapel/tokens` is a runtime import of `src/default/**` in twenty packages — `stapel/no-raw-dimensions`' autofix writes it, 274 times this wave — and not one pair declares it; it resolves only because this package depends on it and the tree happens to hoist. Rather than a twenty-first declaration, `spacing`, `radii`, `fontSize`, `fontWeight`, `breakpoints`, `breakpointForWidth`, `mediaQuery` and `cssVar` (plus their types) are re-exported from the root here — the census of what skins actually use. A pair's design-system dependency list stays exactly `@stapel/tokens-antd`, and the `@stapel/tokens` version in play is the one this bridge's colour mapping was built against. `colors`, `elevation`, `typography` and the raw ramps stay where they are: a skin reaching for a hex has left the bridge. The reasoning, and the two rejected alternatives, are in the root export's docblock.

  Also new: `hostBrandFingerprint(mode)`, the one-property probe of the host's live token scope that makes the theme cache safe.

- 95e8eec: A new `/skin` subpath: `SkinDialog`, the one dialog surface the fleet renders through.

  The owner's ruling — on a phone a modal is a bottom sheet; modals are
  tablet/desktop only. That is a design-system decision, and a design-system
  decision re-taken in every component is not a decision: of the eleven `Modal`
  sites in the pairs' default skins, eight rendered a centred desktop modal on a
  390px phone, and the three that got it right had each hand-written their own
  `isPhone ? <Drawer> : <Modal>` branch, giving the fleet three different sheets.

  This package is the only one every antd default skin already depends on, so it
  is the only place the rule can be stated once and inherited by all of them
  without inverting the dependency graph. The root export is unchanged — still
  pure functions, no components; a host that only wants the theme mapping never
  loads a component.

  The sheet is a sheet, not a drawer that comes from the bottom: swipe-to-dismiss
  with a distance threshold and a flick floor, a real `<button>` grab handle so
  the gesture has a keyboard and screen-reader equivalent, safe-area inset
  padding, `overscroll-behavior: contain`, and a `dvh` height cap (mobile
  Safari's `vh` is the tallest the viewport ever gets, so a `90vh` sheet hides
  its own footer under the browser chrome). `dismissible={false}` draws no way
  out at all — for the one shape that genuinely has none — rather than an
  affordance that is offered and inert.

  The surface is read through `useSyncExternalStore` on one `matchMedia` against
  `@stapel/tokens`' own `tablet` breakpoint, so the FIRST client render is
  already right; `useBreakpoint()` returns `undefined` until an effect runs,
  which painted a desktop modal for a frame on every phone. `useDialogSurface()`
  is exported for a skin that cannot use the component (an imperative
  `Modal.confirm`) and must still obey the same rule from the same source.

  Geometry sits on `.ant-drawer-content-wrapper`, the one panel element antd 5
  and antd 6 name identically (`styles.content` is deprecated in 6 and warns).

## 0.5.0

### Minor Changes

- 3ac8297: fix: the error surface a 500 puts on screen — readable, and in the user's language

  Two defects an owner hit behind a backend 500 on a live sandbox, both fixed at
  their root rather than at the one alert that showed them.

  **The alert was unreadable on a dark deployment.** `@stapel/tokens-antd`'s
  `readLiveCssVar` served the host's LIVE `--stapel-*` custom properties for
  whatever mode the caller asked for — but those properties resolve through the
  document's active `data-theme`, so they are the DOCUMENT's mode, not the
  caller's. A default skin defaulting `mode` to `"light"` inside
  `<html data-theme="dark">` therefore got antd's LIGHT algorithm (deriving
  `--ant-color-error-bg: #fff2f0`, near-white) welded to a LIVE DARK
  `--ant-color-text: #f4f5f7` — measured 1.00:1 contrast.

  - `resolveThemeMode()` (new export) reads the same `data-theme` attribute
    `@stapel/tokens`' `tokens.css` keys its dark block on. `mode` is now optional
    on `toAntdTheme`/`toAntdThemeConfig` and defaults to it.
  - `readLiveCssVar` serves a live value only when the document is in the mode
    being asked for; otherwise the compiled-in default for the REQUESTED mode.
    The bridge can no longer emit a blended theme.
  - Every `@stapel/profiles-react` default skin defaults `mode` to
    `resolveThemeMode()` instead of `"light"`, so it self-themes with no host
    wiring. Pass `mode` explicitly to pin a side.

  **The alert showed `Request failed with status 500`.** That is
  `parseErrorEnvelope`'s own diagnostic for a response with no error envelope (a
  Django 500 under `DEBUG=False` returns HTML) — the HTTP client's internals, in
  English, on a Russian UI. The one-dialect machinery existed but had no rung a
  query/mutation-driven skin could reach, and no catalogue behind the codes core
  itself mints.

  - `@stapel/core` now ships an error FLOOR (`stapel.http.*`,
    `stapel.transport.failed`, `stapel.error.unknown`) in en and ru, seeded by
    `createI18n` under every locale before any caller bundle — a host wires
    nothing, and any pair or host bundle registered later still wins the key.
  - `useErrorText()` (new export) folds ANY thrown value into that dialect in one
    call, which is what a skin holding `error: unknown` needed.
  - `formatFlowError` exposes the error's HTTP `{status}` to templates and widens
    core's OWN `stapel.http.<status>` codes to a class-wide `stapel.http.5xx`
    entry. Real backend codes are never widened — two different 404s stay two
    different states.
  - Default skins across profiles-react, auth-react, notifications-react and
    workspaces-react now render `useErrorText(...)` instead of `error.message`.

## 0.4.0

### Minor Changes

- a86ced9: §68 — colour tokens move to a neutral, design-system-agnostic role dictionary (`surface`/`surface-raised`/`surface-sunken`/`surface-overlay`, `text`/`text-muted`/`text-subtle`/`text-on-accent`, `border`/`border-subtle`/`focus-ring`, `brand`/`brand-hover`/`brand-active`/`brand-subtle`, `link`/`link-hover`, and `success`/`warning`/`error`/`info` × `{base, -bg, -border, -on}`). Breaking, shipped as minor per the postmortem versioning law (alpha, no stable consumers frozen on the old names yet):

  - **Old ad-hoc names are gone**: `accent`, `background-*-subtle`, `upperground-*`, `icon-*`, `text-invert`, `overlay`, and the whole L3 component-token tier (`button-primary-bg`, `card-bg`, `card-border`, `link-text`, ...) no longer exist. No compatibility alias layer — the dictionary is flat now: a role name IS the CSS var suffix (`--stapel-<role>`, no more `--stapel-color-<role>` + separate `--stapel-<component>`).
  - **The generator ships as a bin**: `@stapel/tokens` now exposes `stapel-tokens` (package.json `bin`), so a host runs it directly (`npx stapel-tokens --theme ./stapel.theme.json --out ./dir`) instead of vendoring/forking the engine. The engine itself moved from an unpublished `scripts/tokens-lib.mjs` into the published `src/gen/`.
  - **Merge-contract**: a host's `stapel.theme.json` deep-merges OVER `theme.default.json` (`mergeTheme`, unit-tested) — the host wins on every leaf it defines, everything else falls through to the default.
  - **Versioned Tailwind adapters** (owner follow-up, "Tailwind 5 won't break us"): the generator always emits a version-independent stable core (`tokens.css`, plain `--stapel-<role>` vars) plus addressable adapters — `tailwind@4` (default, `@theme`, no RGB) and `tailwind@3` (legacy, RGB triplets + a `theme.extend.colors` config snippet), both owned in the bin so a host never forks either. A future `tailwind@5` is one more adapter, additive.
  - **tokens-antd / tokens-mui** read the new roles directly (`colors["brand"]`, `colors["surface-raised"]`, ...) — the old `bridgeColorRoles` indirection table is gone since the neutral dictionary already speaks the bridges' vocabulary. `tokens-antd` keeps its live-CSS-var read (a host's brand colour flows through even to antd's seed-token derivation) and gains `colorTextTertiary`/`colorBgElevated` mappings (`text-subtle`, `surface-overlay`).

  Not published — versions bumped and changeset queued for the coordinator to publish after acceptance.

### Patch Changes

- Updated dependencies [a86ced9]
  - @stapel/tokens@0.5.0

## 0.3.0

### Minor Changes

- 6ef6c44: Fixed the theme-bridge root cause behind a live report: a deployment's
  customized brand colour never showed up in any default skin, which kept
  rendering Stapel's own stock colour (`#4657d9`) regardless of what the host
  configured.

  `toAntdTheme`/`toAntdThemeConfig` used to resolve every colour role from
  `@stapel/tokens`' compiled-in `colors` snapshot — frozen at THIS package's
  own publish time to `@stapel/tokens`' OWN default theme. A host customizing
  its brand colour does so exactly as `@stapel/tokens`' README prescribes (copy
  `theme.default.json` → `stapel.theme.json`, edit the `ramps`, `pnpm
gen:tokens`) — which regenerates the HOST's own `tokens.css` custom
  properties, never this published package's compiled JS.

  `role()` now reads the live `--stapel-color-<role>` custom property off
  `document.documentElement` at call time (the exact value the host's
  regenerated `tokens.css` sets, already resolved through whichever
  `data-theme` is active) and falls back to the compiled-in default only where
  there is no DOM to read (SSR, tests, a host that never loaded `tokens.css`).
  No API change — same `toAntdTheme(mode)`/`toAntdThemeConfig(mode)` signature;
  every default skin that already wraps itself in
  `<ConfigProvider theme={toAntdThemeConfig(mode)}>` (or a host that does) now
  actually reflects the host's brand colour with zero code changes on their
  end.

## 0.2.0

### Minor Changes

- 48188d9: New package: **`@stapel/tokens-antd`** — the Ant Design leg of the token bridge
  (frontend-guidelines §2.4; owner decision §38 T3). `toAntdTheme(mode)` projects
  `@stapel/tokens` L2 core tokens onto an antd `ConfigProvider` `theme.token`;
  `toAntdThemeConfig(mode)` adds the light/dark algorithm so antd's derived
  neutrals flip too. Pure functions reading the ONE shared role table in
  `@stapel/tokens` (no colour decisions of its own), so it and `@stapel/tokens-mui`
  cannot diverge. `antd` is a peer dependency. Mapping-table tests included.

### Patch Changes

- Updated dependencies [48188d9]
- Updated dependencies [2c22f06]
  - @stapel/tokens@0.4.0
