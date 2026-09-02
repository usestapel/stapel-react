# @stapel/core

## 0.23.0

### Minor Changes

- e2ec0f2: The substrate a field-level picker is built out of: one recency hook, four controls.

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

## 0.22.0

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

## 0.21.0

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

## 0.20.0

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

- 042a088: The host decides the brand, at runtime: `SiteProvider` / `useSite` / `fetchSite`.

  A product served under two domains had no honest way to say which one it was
  being looked at from. The brand was a build-time fact in three places at once
  — the `<title>` in `index.html`, a `SITE` constant, an i18n key — so a second
  domain made every one of them wrong on half the traffic, and the only fixes
  available were a second image or an nginx header, which is a fleet fork of the
  one thing that must stay identical across deployments.

  `@stapel/core` now carries the seam instead:

  - `fetchSite(client)` reads `GET <baseUrl>/site/` — public, no auth header,
    the document `stapel_core.sites` serves: host, whether the registry matched
    it, locale, the brand (key, name, title, logo, theme, legal strings) and the
    SEO verdict for that host.
  - `<SiteProvider client fallback>` renders the `fallback` on the FIRST frame
    and replaces it when the answer lands. There is no empty first frame and no
    flash of a generic shell; a failure keeps the fallback, warns once, and
    never throws into the tree — a branding document being unreachable must not
    blank the page a visitor came for.
  - It reflects the answer onto `<html>`: `data-brand="<brand.theme>"`, which is
    what a `stapel-tokens --scope` stylesheet is addressed by, and `lang`, which
    a screen reader reads and no `<meta>` replaces.
  - `useSite()` throws outside a provider — a screen whose content IS the brand
    has nothing honest to draw without one. `useOptionalSite()` returns `null`
    instead, for library code that PREFERS a site: it is why
    `@stapel/shell-react`'s `<PublicShell/>` can default its brand slot without
    breaking every host that mounts no provider.

### Patch Changes

- Updated dependencies [042a088]
  - @stapel/tokens@0.6.0

## 0.19.0

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

## 0.18.1

### Patch Changes

- d3c98a1: - **Backend codes that name their status fall back to the HTTP floor.** `error.503.service_unavailable`, `error.500.server` and their kin reached the glass raw wherever a package's catalogue lacked the key. `describeFlowError` now tries `stapel.http.<status>` then `stapel.http.Nxx` for an `error.<status>.<slug>` code — after the exact key and the backend's own localized message, before the raw code — and quotes `HTTP <status>` beside the generic sentence. Codes that do not name a status (`auth.otp.invalid`) keep the documented last resort. `httpStatusFloorKeys(code)` is exported.
  - UI floor: `STAPEL_UI_KEYS.more` ("More") and `STAPEL_UI_KEYS.actions` ("Actions") in en/ru/es, for the substrate's row-actions overflow.
- Updated dependencies [f9d8b66]
  - @stapel/tokens@0.5.1

## 0.18.0

### Minor Changes

- 350f61f: The runtime half of the shared skin substrate: a UI floor in three locales, a synchronous `useBreakpoint`, a slot placeholder, and an optional i18n seam.

  - **UI floor (`stapel.ui.*`, en/ru/es)** — `STAPEL_UI_KEYS` (retry, dismiss, confirm, cancel, loading, the empty-state title, the unfilled-slot sentence), seeded by `createI18n` under every locale exactly like the error floor, so `@stapel/tokens-antd/skin` renders a real sentence with zero host wiring and a host overrides any key by registering it later. The error floor gains **`es`** alongside `en`/`ru`; `CORE_ERROR_LOCALES` now lists all three.
  - **`useBreakpoint()` is right on the first client render.** It reads through `useSyncExternalStore` (window width, subscribed to `resize` and to the two breakpoint media queries) instead of an effect, so `AppShell`/`PublicShell` no longer paint the phone drawer on a desktop for one frame. `undefined` is returned only on the server and the hydration pass that must agree with it. The return type is unchanged.
  - **`SlotPlaceholder`** — an unfilled render slot renders a visible, named, dashed box in development and nothing in production, never silent nothing. Design-system-free (tokens custom properties only) so the headless layer that declares a slot can stand in for it. `isDevBuild()` is the switch, readable by anyone.
  - **`useOptionalI18n()`** — the nearest engine or `null`, for a component that owns its copy props and merely floors them when a host is present.

### Patch Changes

- 308e3d6: `toFlowError` is idempotent, and `isFlowError` is exported.

  It recognised `StapelApiError` and collapsed everything else to the fallback code — including a `FlowError` it had produced itself. A flow machine's refusal state carries a `FlowError`, not the thrown value, so every screen that reads a refusal OFF A MACHINE and hands it to the pair's own fold before asking a code predicate about it got the fallback code back: `isErrorCode(refused, "moderation.report.already_reported")` answered `false` for every refusal, and the screen silently rendered the generic sentence instead of the one written for that situation. Invisible wherever a pair's copy reads like the backend's own text, which is why it survived until moderation-react's wave-D screens, whose two refusal sentences differ from the backend's.

  A `FlowError` now passes through unchanged (same object identity); a `StapelApiError` still goes down the real fold, so its `message` and `language` are read the way `formatFlowError` needs them; anything else still collapses to `fallbackCode`. The guard excludes `Error` instances on purpose — `StapelApiError` carries `code`/`params`/`status` too — and is exported as `isFlowError` for pairs that need the same question answered.

  Pairs carrying a local idempotence wrapper in `src/flows/errors.ts` (moderation-react) can delete it and call core's directly.

- 308e3d6: The i18n engine grows formatters: dates, relative times, durations and numbers, at the APP's locale.

  Sixteen pairs had independently written the same `src/model/format.ts` — `useWorkspaceFormat`, `formatInstant`/`formatDuration`, `formatReviewDate`, `useAuthDateFormat`, and a dozen more — and nine of wave B's request files asked, in nearly the same words, for it to live here. The brief's own rule ("dates through core's i18n helpers **if they exist**") was satisfied by nothing existing: the engine shipped `t`/`tPlural` and nothing numeric.

  The copies did not all decide alike, which is the real cost: an unreadable instant rendered as `null`, as `undefined`, as the raw ISO string or as an empty span depending on the pair; a "date" was `dateStyle: "medium"` here and `{year, month: "short", day}` there; the relative/absolute cutoff moved; and a malformed locale tag threw in some and was caught in others.

  - `formatDate` / `formatDateTime` — month named, never `08/09`; per-call shape override.
  - `formatRelative` — `Intl.RelativeTimeFormat` with `numeric: "auto"`, `now` injectable so a test is not a race, and a cutoff (default one year) past which it hands back to a date, because "in 4 years" is not something anyone can act on.
  - `formatDuration` — seconds, as a `clock` timecode (`1:02:03`) or in the reader's `units`.
  - `formatNumber` — thousands separated the way the reader's language separates them.
  - `createFormat(locale)` and `useFormat()` — every method bound to one locale; the hook follows a runtime language switch, so dates move with the sentences. It uses `useOptionalI18n`, so it renders outside a provider instead of throwing: a date is not a translated string.

  Every function answers `null` for an instant or a number it cannot read, and degrades an unknown locale tag to the runtime default instead of throwing — the contract `pluralCategory` already held. `Intl` instances are cached per locale and shape, so a 200-row list constructs one, not 200.

  Deliberately not here, and why, in the module header: money (a currency contract, `@stapel/currencies-react`'s), bytes (a two-line caller of `formatNumber`), and anything that returns a sentence (those are keys). Migration for the per-pair copies: `SCRATCH/wave-b/SHARED-API.md` §9.

## 0.17.0

### Minor Changes

- bd7d3b0: `tPlural` / `useTPlural` — counted copy that is right in more than one language

  The i18n engine did `{param}` substitution and nothing else, so every counted
  sentence in the fleet was one string with one ending. On a live storefront that
  reads as "Примерно 1 объявлений" — the estimate line above the results, correct
  for 5–20 and wrong for every 1, 2, 3 and 4 a page actually shows. English hides
  the defect (two forms, and `{count} results` is wrong only at 1); Russian has
  four forms and shows it on the first page load.

  **One mechanism, and it is the one the lint already speaks.** A plural message
  is catalogued as one FLAT key per CLDR category —

  ```ts
  "search.results.count_exact.one":   "{count} объявление",
  "search.results.count_exact.few":   "{count} объявления",
  "search.results.count_exact.many":  "{count} объявлений",
  "search.results.count_exact.other": "{count} объявления",
  ```

  — and rendered by naming the FAMILY:

  ```tsx
  const tPlural = useTPlural();
  <span>{tPlural("search.results.count_exact", { count })}</span>;
  ```

  `stapel/i18n-key-exists` has had `pluralFunctionNames: ["tPlural"]` since it
  shipped: a `tPlural(…)` call's first argument is a family and the rule demands
  `<key>.other` in the generated registry, where a `t(…)` call demands the key
  verbatim. The runtime now spells it the same way, so a plural rendered through
  the wrong function is a lint error rather than a page that prints a raw key.
  The alternative — an object message `{one, few, many, other}` — was rejected on
  purpose: it widens `I18nDictionary` for every consumer and every generated
  catalogue, and the lint would still need teaching the shape, which is two
  halves that can drift.

  `pluralCategory(locale, count)` is exported for a skin that needs the category
  itself. It is `Intl.PluralRules`, never a hand-rolled `n === 1 ? … : …`, and an
  unusable locale tag degrades to English instead of throwing — a plural is copy,
  and copy must not be able to crash a render.

  **Nothing that exists moves.** `I18nDictionary` is still `Record<string,
string>`, `getBundle` is unchanged, and `tPlural` falls back `<key>.<category>`
  → `<key>.other` → `<key>` → the key, so a host bundle written before this
  release still renders its single flat string instead of a raw key. Bundles gain
  plural forms when they are ready to, one family at a time.

## 0.16.0

### Minor Changes

- 301804d: Two host seams a skin needs and a library must not choose: `LinkComponent` and `SignInCta`

  Wave D mounted nine pairs in one container and both absences showed up as
  defects the same afternoon.

  **`LinkComponent`** — `categories-react`'s breadcrumbs, tree and carousel
  rendered plain `<a href>`, so every click on category chrome threw the SPA
  away and rebuilt it; `listings-react`'s card rendered `href` AND called
  `onOpen`, which navigated twice for one click. A pair cannot import a router
  (there are several, and a library that picks one picks it for every host), so
  the host hands the anchor in:

  ```tsx
  const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
  ```

  The props are a plain `href`, `children`, `className`/`style`/`onClick`,
  `aria-label` and a `data-*` index signature — the last is what keeps a pair's
  own test hooks reaching the DOM through the host's component.

  **`SignInCta`** — `actionBlocked` ended the grey-rectangle incident by making
  every switched-off control state its reason, but "sign in to add this to
  favourites" is a reason whose next action is a LINK, and no pair took one.
  Three pairs each rendered the sentence and stopped, leaving the visitor to
  find the header themselves. `SignInCta` is `{ href }` **or** `{ onSignIn }` —
  never both, which is the same two-navigations-for-one-click defect wearing a
  different hat — and `SignInCtaProp` is the mixin so the prop is spelled the
  same in every pair that has a door.

  Both are TYPES: no runtime, no router, no antd, no change to the bundle. The
  copy is deliberately NOT here — each pair ships the link's label in its own
  bundle, because core floors `en` and `ru` while those pairs also ship `es`.

  Consumers' peer floors on `@stapel/core` are unchanged in this wave: the
  symbols are unreleased, so `check:peer-floors` has nothing to measure against
  yet (it refuses to guess, by design). The floors move to `>=0.16.0` in the
  wave AFTER this one tags.

## 0.15.0

### Minor Changes

- 6356af8: `StapelClient` query parameters accept an ARRAY, and repeat the key instead of
  collapsing it.

  `{ "f.brand": ["bosch", "makita"] }` now becomes `?f.brand=bosch&f.brand=makita`,
  in the given order. Repetition is a contract some backends actually specify —
  stapel-search reads a repeated `f.<slug>` as OR within a slug and different
  slugs as AND (`stapel-search/query.py`) — and the builder used `set`, so the
  second value silently replaced the first. The only alternative for a pair that
  needs it was to hand-build its URL: a second query encoder next to this one,
  outside its escaping and outside `stapel/no-string-paths`.

  An empty array contributes nothing, exactly like `undefined`: "no filter" and "a
  filter with no values" must not produce different URLs. Single values keep their
  existing `set` behaviour, so nothing already shipped moves.

- f73dfab: The mandate axis becomes a seam, plus the two bones every upload shares

  `MandateSource` / `MandateProvider` / `useMandate` / `useMandatePrincipal`
  split READING the mandate axis from DERIVING it. Until now the only
  derivation lived in `@stapel/workspaces-react`, so a surface that merely
  wanted to know "does this person hold a mandate?" had to import the
  multi-tenant machinery — impossible for a public storefront, which has no
  workspace list to ask. Core takes the provider of the axis and never learns
  what a workspace is. Outside a provider, `useMandate()` answers
  `unresolved / unavailable` naming the missing wiring: not a throw that blanks
  the subtree, and not a principal invented out of a wiring bug. The provider
  compares the answer before republishing, so a source that rebuilds its state
  every render (every query-backed one does) cannot re-fire the effects that
  watch the axis.

  Two upload primitives join core, both endpoint-free — the shared bones under
  three DIFFERENT upload contracts (cdn multipart, docs presign+finalize,
  recordings session+PUT+finalize), which stay in their own pairs:

  - `putToForeignOrigin(url, blob, opts)` — the bare PUT at an object store,
    with none of the transport's auth binding, folding a non-2xx into
    `StapelApiError{code: "stapel.http.<n>"}` instead of handing back a
    `Response` that every caller re-wraps differently.
  - `useObjectUrlPreview(file)` — a local preview whose `revokeObjectURL` is
    structural: replace, clear and unmount all balance by construction.

## 0.14.0

### Minor Changes

- e25e9a6: The mandate axis, and a nav contract that can express it.

  stapel-core 0.27 made the backend's principal three-valued — anonymous, a
  registered **guest** holding no mandate anywhere, and a member — plus an
  explicit _undetermined_ outcome for when the answer cannot be obtained. The
  frontend had one bit. A guest satisfied "authenticated", was handed every
  installed module's nav entry, mounted every screen, and collected a 403 per
  click: controls that lead to a refusal, at library level.

  `mandate.ts` carries the vocabulary. `MandateState` is `anonymous | guest |
member | unresolved`, and the fourth value is deliberately NOT a principal:
  **"we could not ask" must never render as "you may not".** The type enforces
  that three ways rather than asking politely — `unresolved` carries no
  principal to read, it carries a REASON (`asking` = a wait, `unavailable` = an
  error with something to say), and `matchMandate` takes five REQUIRED arms, so
  letting a wait fall into a refusal's branch does not compile. It is the same
  mechanism `matchList` uses, for the same reason.

  `NavEntry` gains `surface: "public" | "member"`. `requiresAuth` stays and
  still means what it meant — it is the alias half (`true` → member), so every
  manifest written before the axis keeps its meaning — but it could only ever
  say "needs a session", and a session is not a mandate. `surface` says the
  part it could not: a meeting joined by link is public to an authenticated
  person. `navEntrySurface()` is the one place the derivation lives;
  `navSurfaceVisibleTo()` is the whole rule, and it takes a
  `MandatePrincipal` — `"unresolved"` is not assignable, so a caller whose
  mandate has not settled cannot get a verdict out of it at all.

  `useActiveSessionStatus()` exposes the status the session store already
  held. `useActiveSessionReady()` answers "may a query fire", which is one bit
  and rightly so; the axis needs the distinctions underneath it, and deriving
  them from a boolean is impossible.

## 0.13.0

### Minor Changes

- 400f9e6: The absence of a result is no longer spelled the same way as a result.

  `LoadState<T>` puts the data BEHIND a discriminant (`loading` | `ready` with
  `data` | `failed` with `error`), `loadStateFromQuery(query)` adapts a TanStack
  result into it, and `matchList` renders one with FOUR required arms — loading,
  failed, empty, ready — so "there is nothing here" cannot share a branch with
  "we could not find out". `matchLoad`, `mapLoad`, `bothLoaded`, the three
  guards and the deliberately-unpleasant `loadedRowsOrEmpty` escape hatch ship
  alongside.

  `loadStateFromQuery` reads `query.status` and not `query.isLoading`, which is
  its own bug fix: `isLoading` is `isPending && isFetching`, so it is FALSE for
  a query that has not been enabled yet, and every session-ready-gated list hook
  in this fleet therefore reported "not loading, no error, zero rows" for the
  whole session bootstrap.

  `ActionAvailability` closes the other half: a control that is switched off
  states its reason. `actionBlocked(code)`, `actionBlockedByFailure(error)`,
  `requireLoaded(state, …)`, `firstBlock(…)` and the `useActionGate` hook, which
  returns `{disabled, reason, detail}` — flat strings a skin renders as TEXT
  beside the control, because a disabled button receives no pointer events and a
  tooltip on one is a reason nobody can read. There is no way to spell "blocked,
  reason unknown": the union has no such member. Core's i18n floor gains
  `stapel.action.blocked.loading` and `stapel.action.blocked.load_failed` in en
  and ru, worded to say that WE failed to load something — never that the thing
  is absent, and never blaming the person.

  `@stapel/eslint-plugin` gains `stapel/no-flattened-load-state`, on at `error`
  in the recommended preset: `query.data ?? []`, `x.data?.y ?? []`, `data || {}`
  and friends are the line that manufactures the lie, and it is now a lint error
  everywhere outside the api/transport layer.

  Why: on 2026-08-09 a backend route was mounted one path segment too deep, the
  workspace-list endpoint answered 404 to every request, and the frontend
  rendered "you have no workspaces" and greyed out the upload button with no
  explanation — for hours, with the failure visible in the network tab the whole
  time. The distinction was available (the bag carried `isError` beside the
  array) and every skin flattened it anyway, because the array was reachable
  without mentioning the error. So this ships as a type and a lint rule rather
  than a convention.

## 0.12.0

### Minor Changes

- c5c0a11: Error copy: the human sentence no longer carries the HTTP status; the status
  moves to a separate technical detail.

  Core's floor copy for the codes core mints itself used to splice the status
  into the sentence — every 5xx entry ended in a bare `" (500)"`. That reads as
  a diagnostic, not as product copy, and the owner rejected it on sight
  (2026-08-09). Deleting the number was not an option either: no Stapel backend
  emits a request id, so the status is the ONLY correlation handle a person can
  quote to support.

  So it moved out of the sentence and into a second field:

  - `describeFlowError(error, bundle, opts)` returns
    `{message, detail}` — `message` is the complete human sentence, `detail` is
    the plainly-technical `"HTTP 500"` a skin renders in muted, small type
    beside it. `detail` is `undefined` when there is nothing worth quoting: no
    status, a transport fault that never reached a backend (`status: 0`), or a
    specific backend code whose sentence already says what happened.
  - `useErrorDisplay(fallbackCode?)` and `useDescribeFlowError()` are the hook
    forms, for `unknown` and `FlowError` inputs respectively.
  - `formatFlowError` / `useErrorText` / `useFormatFlowError` are unchanged and
    still return the sentence alone — a skin that renders only the message keeps
    correct, complete copy. The detail is additive, never load-bearing.
  - The detail template is the bundle key `stapel.error.detail`
    (`DETAIL_ERROR_KEY`, `"HTTP {status}"` in en and ru), so a host can override
    it like any other string — and it is where a request id goes when a backend
    starts emitting one.

## 0.11.0

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

## 0.10.0

### Minor Changes

- `@stapel/core` now self-describes: it ships a generated `manifest.json` and `llms.txt`, closing the gap where it was the only one of the 8 dependent pairs without a machine-readable description of its own surface. `scripts/gen-manifest.mjs` gained an explicit "no backend" mode (`MANIFEST_MODULE=""`) for packages, like core, that have no Django/DRF counterpart.

## 0.9.0

### Minor Changes

- 75f5d5f: **One error dialect.** A thrown value reaches a call site in one of two
  shapes: `StapelApiError` (what `createStapelClient` throws — has `.status`),
  or the RAW envelope `{localizable_error, error, params}` — the parsed response
  BODY, rethrown by any second transport (`if (error) throw error` over an
  openapi-fetch-style `{ data, error }` result), which has **no `.status` at
  all**. Call sites papered over the split with `(e as { status?: number
})?.status === 404` — a branch that can never be true on the second dialect,
  with the cast silencing the only check that would have caught it.

  Core now owns the discrimination, so no consumer has to invent it again:

  - `isStapelApiError(value)` — the typeguard;
  - `isErrorEnvelope(value)` — the raw dialect, recognised;
  - `errorCode(value)` / `errorStatus(value)` — read the code/status from
    EITHER dialect (`errorStatus` also recovers the status the code itself
    carries: `error.404.…`, `stapel.http.503`), `undefined` when genuinely
    unknowable;
  - `hasErrorCode(value, ...codes)` and `errorCodePredicate(...codes)` — the
    named-state predicate factory (`const isFeatureDisabled =
errorCodePredicate("error.404.feature_disabled")`), so two DIFFERENT 404s
    stay two different states, which `.status === 404` can never express;
  - `toStapelApiError(value, fallbackStatus?)` — the fold a second transport
    applies at its single rethrow point (`throw toStapelApiError(error,
response.status)`) so its call sites only ever see dialect 1;
  - `TRANSPORT_ERROR_CODE` — the honest code for "never reached the backend"
    (no invented HTTP status).

  **Behaviour change — network traffic.** The default query client's `retry`
  predicate now reads `errorStatus(error)` instead of `(error as {status?:
number}).status`. A 4xx that arrives as the raw envelope was previously
  invisible to the predicate and got retried twice; it is now recognised and
  **not retried**. Requests that were fired three times are fired once. Nothing
  that was retried before and _should_ be still is: 5xx and status-less faults
  (network, abort) keep the `failureCount < 2` budget. Minor, not patch — this
  changes what goes over the wire in consuming apps; a host that depended on the
  extra attempts must set its own `retry` on the `QueryClient` it passes in.

  Covered by a test that mocks the WIRE (a real 404 envelope through a real
  second-transport rethrow), not the module — see CONTRIBUTING.md
  "Mock the wire, not the module".

## 0.8.1

### Patch Changes

- 8c4f9c2: An unreachable backend no longer logs the user out.

  Owner-reported live incident (2026-07-26, app.ironmemo.com mid-redeploy):
  "сервак явно не отвечал, но фронт меня выкинул на sign-in page. Ну да, не
  получилось отрефрешиться или auth/me вызвать, но это же не повод сессию
  терминейтить, юзера не разлогинило, бэк прилёг."

  A refresh had two outcomes — success, or "session lost" — so every way of
  _not_ getting an answer (fetch threw, DNS/TLS failed, the request timed out,
  nginx answered 502/503/504 because the upstream was restarting, the service
  5xx'd on its own crash) was filed under the same verdict as a clean 401, tore
  the session down, ran the logout hooks, purged user-scoped storage and fired
  the host's redirect-to-login policy. On a signed-in user whose credential was
  perfectly valid.

  Only the auth service can retire a credential, and only by answering. So
  there is now a third outcome, `REFRESH_UNAVAILABLE`: no verdict was obtained,
  the session is left exactly as it was, `refresh()` still resolves `false` (the
  caller's request genuinely got no token and should surface its own error), and
  `session:refresh-unavailable` is emitted for hosts that want an "offline /
  reconnecting" affordance. The next attempt, once the backend is back, simply
  succeeds. A `doRefresh` that _throws_ is treated the same way — an exception is
  not evidence a credential is dead, and the old behavior turned any bug in the
  refresh path into a forced logout.

  `@stapel/auth-react` classifies: 401/403 (and other 4xx that are genuine
  rejections) are verdicts; transport failures, 5xx, 408 and 429 are not. 429
  especially — being rate-limited is a "come back later", and logging the user
  out over it is exactly backwards. The same rule now governs the token-adoption
  path: a `me()` that never reached the server keeps the tokens instead of
  discarding them. A COLD start against a dead backend still settles (quietly,
  no banner) so nothing gated on `whenReady()` hangs.

## 0.8.0

### Minor Changes

- cff85d2: New `createMeCachePersister` (`query.ts`) — a selective, localStorage-backed persister for "/me-class" queries only (current user, current profile, …), distinct from `createStapelQueryClient`'s existing per-user namespace persistence: on a cold load the user id isn't known yet, so per-user namespacing can't help render a last-known `/me` before the network responds.

  - Persists ONLY the caller-named query keys (matched by prefix, e.g. `authQueryKeys.me()`, `profilesQueryKeys.me()`) to one fixed `localStorage` entry — `dehydrate`d selectively via `shouldDehydrateQuery`, not the whole query cache.
  - Hydrates SYNCHRONOUSLY at construction time, before the caller's first render, so `useQuery` calls for those keys already see cached data on mount (true cache-first paint, not an async fill-in a tick later).
  - Wiped on logout through the SAME registry `createRepository(namespace, { scope: "user" })` uses (`__registerWipeWhenActive`, `session.ts`) — no bespoke clear call, no separate contract to keep in sync. Fires on both explicit `logout()` and involuntary `sessionLost()`.
  - SSR-safe: every `localStorage` touch is guarded, so this is a no-op on the server.
  - Lives in `query.ts`, already the sanctioned `no-raw-storage` home alongside `storage.ts`/`repository.ts`.

  `<StapelProvider>` gained an optional `meCacheQueryKeys` prop that wires this in for the host with one line — e.g. `<StapelProvider meCacheQueryKeys={[authQueryKeys.me(), profilesQueryKeys.me()]} .../>`. Hydration runs inside the same synchronous `useState` lazy initializer that builds the `QueryClient`, before the provider's children ever mount. Omitting the prop skips /me cache-first persistence entirely (default: off) — fully backward compatible.

## 0.7.0

### Minor Changes

- fdaf339: Add the shared navigation-manifest contract types (`NavEntry`, `NavRoute`, `NavComponentRef`, `NavPlacement`, `NavPlacementLevel`, `PackageNavManifest`), exported from the package root. Ф1 lib-side foundation for the scripted-fullstack navigation contract (owner directive: one scripted command with no LLM produces a working navigated fullstack): a pair declares its screens' nav entries in `src/nav/manifest.ts` against these types, `scripts/gen-nav-manifest.mjs` validates and emits `nav-manifest.json`, and `@stapel/shell-react`'s `resolveNav` (new package, separate changeset) turns installed manifests + a project's overrides into the tree a shell renders. Pure data types — no React, no I/O — so the same contract works at scaffold codegen time and at runtime.

## 0.6.2

### Patch Changes

- Updated dependencies [a86ced9]
  - @stapel/tokens@0.5.0

## 0.6.1

### Patch Changes

- c20f56f: Fixes a live-incident race (owner-diagnosed finisher, миттудей): `AuthSession.logout()` used to await the server-side revoke call BEFORE any local teardown. In the window between the server honoring that revoke and this session getting back around to tearing itself down, a parallel authenticated request (e.g. a Navbar still holding a stale `useWorkspaces` query) would 401, retry its own refresh against the now-revoked token, fail, and race a `sessionLost('expired'/'revoked')` teardown in ahead of the explicit logout — rendering a "session expired" banner on a logout the user asked for themselves.

  Two changes, combined:

  - `@stapel/core`'s `SessionManager.logout()` now holds a `loggingOut` guard for its full duration (set synchronously before its first `await`). `sessionLost()` is a no-op while that guard is up — in addition to its existing idempotent no-op once already `"unauthenticated"` — and now reports which case applies via its return value (`Promise<boolean>`: `true` only if it actually performed a teardown).
  - `@stapel/auth-react`'s `AuthSession.logout()` now runs the local teardown (`sessionManager.logout()` + `onTeardown('logout')`) FIRST — instant, no network dependency — and treats the server revoke as best-effort afterward. `settleRefreshFailure` only calls `onTeardown(reason)` when `sessionLost()` reports it actually tore the session down, so a racing refresh failure during an in-flight logout never fires a contradictory `onTeardown('expired'|'revoked')`.

## 0.6.0

### Minor Changes

- 6ef6c44: Session-lifecycle fix for a live incident (2026-07-17): a query hook with no
  manual `enabled` gate could race a session still bootstrapping — right after
  an external event set fresh auth state this JS runtime hadn't caught up to
  yet (e.g. a QR `session_share` scan setting httponly cookies via a plain
  redirect) — and read a live session as "expired".

  - **`SessionStatus` gains `"initializing"`** — a 4th, DISTINCT state from
    `"unauthenticated"`. `"unauthenticated"` means "checked, no session";
    `"initializing"` means "haven't checked yet". `createSessionManager` is now
    born `"initializing"` by default (previously `"unauthenticated"`, which
    collapsed the two).
  - **`SessionManager.isReady()` / `.whenReady()`** — the framework-level
    ready-gate: `false`/pending while `"initializing"`, resolves the instant the
    session settles into any of the other three states.
  - **`SessionManager.markUnauthenticated()`** — settle `"initializing"` into a
    confirmed "never had a session" with NO teardown side effects (no logout
    hooks, no `onSessionLost`) — distinct from `sessionLost()`, which assumes an
    existing session is ending.
  - **`useSessionReady(manager)` / `useActiveSessionReady()`** (new hooks) — a
    pair's query hook gates on `useActiveSessionReady()` (reads
    `getActiveSessionManager()`, zero prop plumbing) instead of hand-rolling an
    `enabled` check; `true` (never blocks) when no module has created a session
    manager at all.
  - **`createStapelClient`'s `onAuthRefresh` retry fix**: resolving `""` (empty
    string — a successful refresh with no bearer token to attach, i.e. cookie
    mode) used to be indistinguishable from `null` (refresh FAILED) because the
    retry condition checked `refreshed.length > 0` instead of `refreshed !=
null`. Every cookie-mode 401 retry threw the original error instead of ever
    re-issuing the request against the now-refreshed cookie jar. Fixed; see the
    `onAuthRefresh` doc comment for the full three-outcome contract.

  `@stapel/auth-react`'s `createAuthSession`/`createAuthRuntime` are the first
  consumer (see that package's own changeset) — a bootstrap probe on
  `restore()` plus the corrected retry contract together close the incident.

## 0.5.0

### Minor Changes

- 569d7b2: Add `formatFlowError`/`useFormatFlowError` — the renderer `toFlowError`'s own doc promised ("the frontend renders `t(code, params)`") but never actually supplied: hosts were left writing `bundle[code] ?? code`, so a bundle miss surfaced a raw, unformatted code to the user. Chain: bundle template (interpolated via the existing `interpolate()`) → the backend's own `message`, but ONLY when its `language` matches the host's current locale → the raw `code` as the last resort. `FlowError`/`StapelApiError` grow optional `message`/`language` fields to carry this (additive); `StapelErrorEnvelope` grows an optional `language` for backends that send one. `I18nEngine` grows `getBundle(locale?)` so `useFormatFlowError` can read the merged dictionary `t()` already resolves against.

## 0.4.0

### Minor Changes

- e4a29b7: Analytics restratification (slim wave §21/S1). Core keeps the analytics **type
  seam + context plumbing** — the `Analytics`/`AnalyticsProvider`/`AnalyticsEvent`
  types, the `defineEvent` type layer (`EventDef`, `EventDefInput`, `EventProps`,
  `AnyEventDef`, `PropSpec`, `PropsSchema`, `PropType`, `ResolveProps`),
  `AnalyticsContext` + `useAnalytics`, and `trackFlowStep` (flow-machine
  auto-instrumentation) — while the facade **implementation** moves to the new
  `@stapel/analytics` package.

  - **Removed exports** (now in `@stapel/analytics`): `createAnalytics`,
    `consoleProvider`, `stapelCollectorProvider`, `StapelCollectorOptions`,
    `defineEvent`, `prop`, `createTracked`, `TrackedApi`, `useTracked`.
  - **New exports**: the persistence adapters `defaultPersistStorage`,
    `idbStorage`, `localStorageAdapter`, `memoryStorage` (shared by the query
    layer and `@stapel/analytics`' offline queue), and the `ResolveProps` type.

  Rationale: mandatory analytics is a stapel-studio policy — scaffolded apps
  always wire `@stapel/analytics`; OSS consumers may bring their own provider
  behind the core type seam (pairs thread it through context; the
  `stapel/no-direct-analytics-provider` rule still guards vendor SDK imports).

- b3ac272: §17 arch-contract-pipeline Wave 0 — retire `@stapel/core`'s generated schema
  surface and the monolith as a contract source.

  `@stapel/core` no longer exports the generated `paths` / `components` /
  `operations` types (and no longer ships `src/generated/schema.ts`). Under the
  per-module contract pipeline every `@stapel/<module>-react` pair already
  generates its OWN self-contained wire types from its backend's committed
  `docs/schema.json`; nothing consumed core's aggregate export (grep-confirmed),
  and stapel-core has no DRF endpoints of its own from which a meaningful core
  slice could be emitted — the shared `User` / `StapelError` / `TokenPairResponse`
  schemas only materialise via a module's endpoints. The hand-authored runtime
  error contract (`StapelApiError`, `StapelErrorEnvelope`) is unchanged and stays
  the public error surface.

  This removed core as the last reader of the monolith aggregate: `gen:api` now
  requires per-module `API_SCHEMA` + `API_OUT` (no monolith default), and the
  monolith checkout is dropped from CI. A minor bump because generated type
  exports are removed from the public API, even though no workspace consumer
  imported them.

- c3482e7: New `<StapelProvider>` (slim wave §21/S4) — the one-provider setup composing
  `StapelConfigProvider` + TanStack's `QueryClientProvider` (via
  `createStapelQueryClient`) + `I18nProvider` (via `createI18n`). Props:
  `baseUrl` or `client` (+ per-module `clients` overrides), `locale`,
  `cacheVersion`, `analytics?`, and the escape hatches `queryClient?`,
  `queryRuntime?`, `i18n?`. Ceremony target: install → `create<Mod>Runtime` per
  pair → ONE `<StapelProvider>` + per-pair `<ModProvider>`. The individual
  providers remain exported — composition, not deprecation.

  Also new: `createModuleRuntime` / `createModuleContext` (+ `ModuleRuntime`,
  `CreateModuleRuntimeOptions`, `ModuleContextKit` types) — the one reviewed
  copy of the runtime/context/provider plumbing the six standard pairs
  previously stamped per package (§21/S2).

- dc98063: Session substrate & user-data hygiene (frontend-core-architecture-v2 §43).

  - **`createSessionManager`** (§43.1) — the one owner of session lifecycle:
    three-state status (`authenticated | anonymous | unauthenticated`),
    **single-flight refresh** (N concurrent 401s share ONE `doRefresh()` call),
    typed events (`session:refreshed` / `session:lost` / `session:logout`), a
    host-injected `onSessionLost` policy (login redirect vs anonymous
    auto-login — resolved from the host's discovery config, never hardcoded),
    and the per-session WebCrypto key repositories encrypt with.
  - **Logout-hook registry** (§43.3) — `registerLogoutHook(fn)`, run on BOTH
    explicit `logout()` and involuntary session loss; one throwing hook never
    blocks the others.
  - **`createRepository(namespace, { storage, scope, encrypted })`** (§43.4) —
    the ONE sanctioned client-side store. `scope: "user"` auto-registers
    wipe-at-logout with NO opt-out and is encrypted by default (AES-GCM,
    per-session in-memory key; logout drops the key first, synchronously, so a
    crash mid-wipe still leaves ciphertext unreadable — §43.5). `scope: "app"`
    (theme, locale) survives logout and never uses the session key.
    Contract-tested: after `logout()` user-scoped data is physically absent
    from both stores and the key is dropped. Honest boundary (in the README,
    verbatim from the governing doc): frontend encryption does NOT defend
    against XSS with code execution — it defends data at rest.
  - **`createModuleRuntime`** now registers a logout hook on the active
    `SessionManager` — the pair's `onLogout` option, or a no-op default
    (§43.7: every standard pair mechanically has a cleanup call site).
  - `createStapelClient`'s 401 path is unchanged in behavior and now documented
    as the ONE legal home of 401 handling (§43.2): `onAuthRefresh` (wire it to
    `SessionManager.refresh()`) → retry once → still 401 → session lost.

### Patch Changes

- Updated dependencies [48188d9]
- Updated dependencies [2c22f06]
  - @stapel/tokens@0.4.0

## 0.3.0

### Minor Changes

- 6c33abc: `createStapelClient` accepts a `credentials?: RequestCredentials` option,
  passed through to every fetch (including 401-refresh and verification-403
  retries). Cookie-mode backends (HTTP-only JWT cookies) need `"include"` when
  the API lives on another origin — the fetch default (`"same-origin"`) silently
  drops cookies cross-origin, so bearer mode was previously the only mode that
  worked cross-origin.
- 4a024a8: Flow-machine primitive moved into `@stapel/core` (frontend-core-architecture §4b).

  `createFlowMachine`, `useFlow`, and the `FlowError` helpers (`toFlowError`,
  `isErrorCode`) now live in `@stapel/core` — the single reviewed implementation
  every `@stapel/<module>-react` pair builds on, instead of each pair copying the
  primitive and forking its staleness/re-entrancy fixes. The primitive's tests
  travel with it. `@stapel/core.toFlowError(error, fallbackCode?)` takes an
  optional module-scoped fallback (default `stapel.error.unknown`).

  `@stapel/auth-react` now imports the primitive from core and **re-exports** it
  (`createFlowMachine`, `useFlow`, `FlowMachine`, `FlowError`, …) for one minor so
  existing imports keep resolving; its `toFlowError` wrapper pins the
  `auth.error.unknown` fallback. No behavior change — the machine implementation
  is byte-for-byte the reviewed one.

- 0db568b: Typed analytics — `defineEvent` / `tracked` over the facade (frontend-guardrails §3, G3):

  - **`defineEvent` + `prop`** (`@stapel/core`). A typed event is a literal object:
    a namespaced `name`, a one-line `description`, and a `props` schema where every
    prop carries its OWN docstring (`prop.string`/`number`/`boolean`/`oneOf`). The
    facade's `track` gains a typed overload — `track(event, props)` checks props
    against the schema (required props enforced, unknown props rejected, `oneOf`
    narrowed to its literal union), while `track(name, props?)` stays for library
    auto-instrumentation. A tsc consumer fixture (`@ts-expect-error` proofs) locks
    the enforcement in.
  - **`tracked()` / `useTracked()`** (`@stapel/core`). `tracked(event, props, handler)`
    wraps a clickable so the click both emits the typed event and runs the original
    handler; `useTracked()` binds it to the facade from context (SSR-safe — no
    mutable module singleton). `trackedSubmit` is the `onSubmit` twin.
  - **Double-count exclusion by construction.** A click that STEPS a flow machine is
    already instrumented (`flow.<id>.<step>`), so it must be marked
    `data-analytics="flow"` and NOT wrapped in `tracked()`. G4 forbids the double
    wrap statically; the facade backs it in dev — while a `tracked()` handler runs,
    a `flow.*` emission on the same instance is flagged with a teaching warning (a
    flow transition fires `started` synchronously, before the first await, so a sync
    scope catches it).
  - **Runtime-configurable flow instrumentation.** `createFlowMachine({ instrument })`
    can silence a machine's auto-funnel while keeping the facade for hand-rolled
    events (default stays on when `analytics` is present).
  - **`events.json` (generated, drift-gated).** New `gen:events` driver projects a
    pair's event registry — `defined` (defineEvent call sites, AST-extracted) +
    `flows` (auto-instrumented funnels from flows.json) — into
    `src/analytics/generated/events.json`, the single source the analytics lint (G4)
    and report (G5) read. `gen:manifest` embeds it into `manifest.json` (`events`)
    and `llms.txt`. auth-react ships its funnel registry and a typed-events
    demonstration (no full annotation of the pair).

### Patch Changes

- Updated dependencies [a6c34e2]
- Updated dependencies [f23c7f3]
  - @stapel/tokens@0.2.0

## 0.2.0

### Minor Changes

- 5dfa61e: Analytics facade per analytics-standard §1–2: `createAnalytics` with fan-out
  to N providers, consent gate (pending buffers / granted flushes / denied
  drops; persisted), offline queue on the shared persist storage surviving
  instance recreation, batched delivery with per-provider tracking and
  exponential-backoff retries, PII guard (strip/warn/off) on props and traits,
  SHA-256-hashed `identify`, event-registry dev warning, built-in
  `consoleProvider` and `stapelCollectorProvider` (batch POST to
  `/analytics/api/events`, `sendBeacon` on page teardown), `trackFlowStep`
  helper (`flow.<flowId>.<stepId>`), `AnalyticsContext`/`useAnalytics`, and an
  optional backward-compatible `analytics` prop on `StapelConfigProvider`.
