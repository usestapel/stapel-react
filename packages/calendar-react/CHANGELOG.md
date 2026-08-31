# @stapel/calendar-react

## 0.8.1

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

## 0.8.0

### Minor Changes

- 57bd738: The dark sheets go dark, the week grid stops lying about fitting on a phone,
  and `u-1` becomes a person.

  **Every dialog now carries its own theme.** `EventSheet`, `EventEditorSheet`
  and `DeleteEventAction`'s confirmation render into a portal, so they inherit a
  `ConfigProvider` only from the tree they are DECLARED in — beside the trigger,
  not inside the screen's painted panel. Nothing wrapped them, so antd served its
  compiled-in LIGHT theme and every one of the fourteen dark sheet shots was a
  white panel over a black page (visual pass CF-1 / N-1). Each now declares
  `<SkinTheme surface="bare">` around itself and takes a `mode` prop that
  `<Calendar>` forwards. The same defect was hiding in the parts: `ParticipantsField`,
  `RsvpControl`, `RecurrenceField`, `CalendarAgenda` and `CalendarMonthGrid`
  mounted standalone rendered antd's light palette on the showcase's dark page —
  the invitee editor was literally black text on black — and they self-theme now
  too. Nested `SkinTheme`s cost nothing (the substrate reuses an identical applied
  theme and emits no second provider), so self-theming is free and inheriting was
  a bug waiting for the next host.

  **`CalendarMonthGrid` collapses to the agenda in a narrow box.** The rule lived
  only in `<Calendar>`, so the grid mounted directly — a host's dashboard widget,
  a 380px side panel, this package's own `grid-only` story — drew seven columns
  into 390px and clipped every entry to `2:0…`. The component measures its own
  element and renders `<CalendarAgenda>` below `GRID_MIN_WIDTH`; the threshold is
  unchanged, it is now the grid's own.

  **People have names.** stapel-calendar stores participation as opaque ids and
  ships no name endpoint, and a pair talks to one module — so the pair grows the
  seam instead of the lookup: `<CalendarPeopleProvider resolveUserName={…}>`, read
  by `useUserName()` wherever a person is printed. The detail sheet's organizer and
  both invitee lists now show the host's name plus an initials avatar, falling back
  to the id when the host knows nothing. Removing an invitee is no longer a red
  link: the replace-set is not sent until "Save invitees", and red is for what
  cannot be undone.

  **An expanded occurrence inherits its series' title.** `dedupeCalendarRange`
  gave a virtual instant `title: ""`, and the series master never reaches
  `events[]` (the backend filters `rrule=""`), so a repeating stand-up drew as
  "Untitled event" beside its own concrete twin. The title now comes from the
  series' materialized sibling.

  **Copy and layout.** The detail sheet printed the start time twice in one line
  ("Starts: Jul 13, 2:00 PM · 2:00 PM – 3:00 PM") — one `When` row now.
  `calendar.view.repeats` says "Part of a series" instead of the bare word
  "Repeats"; the availability warning stops shouting ("only LOOK free" → a
  sentence, in all three locales); a slot's button says "Book this slot" instead
  of repeating the section heading above it. The screen header is two clusters
  instead of three, and when a month range falls back to the agenda the control
  strip says so, because the range switch reading "Month" over a day-grouped list
  is the control lying about what is on screen. The editor states an owner-only
  refusal at the TOP of the form: as a sentence under a submit button three
  scrolls down a sheet it was below the fold, which is why `edit` and `not-owner`
  photographed identically.

  **The date fields are wrapped, not replaced.** `datetime-local` stays — it is
  the accessible, zero-dependency, locale-correct picker, and on a phone it opens
  the native wheel — but each field now echoes its value through the pair's own
  `formatDateTime`, so the sheet no longer shows `13.07.2026, 13:00` two taps from
  `Jul 13, 2026, 2:00 PM`.

  **Four legacy stories deleted** (`calendar.provider`, `calendar.view`,
  `calendar.composer`, `calendar.rsvp`) with the harness apparatus that drew them.
  They photographed a card printing a component name over a `state.step` token —
  the headless twin, not the product — and the skin demos supersede them
  one-for-one (`covers` keeps the headless completeness gate green: 8 demos, 10
  headless covered, 10/10 skin covered under `DEMOS_SKIN_GATE=strict`).

## 0.7.0

### Minor Changes

- 80617e9: The calendar becomes a feature, not a client: a default antd skin, six missing headless primitives, and the wire dedup the contract has always demanded.

  **The dedup (correctness bug, independent of any skin).** `GET /calendar` returns a materialized occurrence twice by design — as a row in `events[]` and as an entry in `occurrences[]` — and stapel-calendar's MODULE.md says clients must dedup by `occurrences[].materialized_id == events[].id`. This pair did not: it handed both arrays through raw, so every consumer drew a repeating meeting twice at the same instant, and cancelled rows arrived as ordinary events with no arm. `dedupeCalendarRange` (`model/occurrences.ts`) now applies the rule once, in the pair, and `CalendarViewBag.state` carries `instances` (each drawable instant exactly once, with its series identity intact) plus a named `cancelled` arm. Six tests pin it against the generated schema types.

  **Six primitives that were hooks and nothing else.** `EventList`, `EventDetail`, `EventEditor` (PATCH **and** cancel), `EventDelete`, `ParticipantsEditor` and `Availability` — availability, the agenda, detail, edit/cancel, delete and the invitee replace-set were reachable only by a host that wrote the whole screen itself.

  **A default skin behind `./default`** (new export; `antd` + `@stapel/tokens-antd` peers): `Calendar` (month/week/day, geometry from element width — a narrow box gets the agenda, never a sideways-scrolling grid), `CalendarMonthGrid`, `CalendarAgenda`, `EventSheet`, `EventEditorSheet` (create and edit in one surface, with the cancel arm), `RecurrenceField` (presets read from a registry, `until` XOR `count`), `ParticipantsField` (shows the complete resulting set before a replace-set write), `RsvpControl` (ONE primary, the server-set `invited` never offered), `DeleteEventAction` (confirmation in a sheet, told apart from cancel), `AvailabilityPane`. Every dialog is `SkinDialog`/`SkinConfirm`; every load arm, empty state and error comes from `@stapel/tokens-antd/skin`; there is deliberately no local `SkinTheme` copy and no local `ErrorAlert`.

  **`truncated` is on the screen.** `AvailabilityResponse.truncated` means a series expansion hit its cap and later times only LOOK free. It appeared nowhere outside the generated schema; it is now a visible warning above the slots, and an empty `slots[]` is named as "no windows are set" rather than "nothing free".

  **The mandate refusal has words.** stapel-calendar moved the event endpoints onto `HasWorkspaceMandateIfScoped`, creating a refusal class with no typed footprint. `error.503.mandate_unavailable` was missing from the error bundle entirely (it rendered as a raw key); it is regenerated, and `isMandateUnavailable`/`isMandateDenied` keep "we could not ask" from rendering as "you may not".

  **Also:** dates and times go through a formatter (`model/format.ts`) — no component interpolates a wire instant into JSX; client-side parity for the two documented 400s (`end >= start`, `slot_minutes >= 1`) as blocked-action reasons beside the control; `ru` and `es` bundles on `./i18n/ru` and `./i18n/es`; a nav manifest (`calendar.month`, `calendar.availability`); the contract pin moves from `>=0.3 <0.4` to `>=0.6 <0.7` against stapel-calendar 0.6.1, whose schema now declares the `start`/`end`/`slot_minutes` query parameters the client had been hand-writing.

  Breaking (pre-1.0, therefore minor): `CalendarRangeData` gains `instances`/`cancelled` and its `events` no longer includes materialized-occurrence duplicates or tombstones.

### Patch Changes

- 308e3d6: The default skin gets photographed: a demo for every one of the ten surfaces, seeded at the state it is named for, and a render matrix that holds the mobile-first and theme rules to their promise.

  **Six surfaces had no picture.** `EventSheet`, `EventEditorSheet`, `RecurrenceField`, `ParticipantsField`, `RsvpControl` and `DeleteEventAction` were built, wired and tested, but nothing in the catalogue drew them — so the skin gate had to stay in listing mode for this pair. Each now has a demo importing from `src/default`, with phone variants and the states that matter: the owner/invitee axis and the three different refusals on the event sheet (403 "a workspace you're not in", 503 "we could not ask", the narrower owner-only block); create, edit, the zero-duration marker and the owner-only refusal on the editor; `until` XOR `count` and the custom preset on the recurrence field; both replace-set modes on the invitee list; the answer-on-record and each blocked reason on the RSVP row; and the delete confirmation in both of its consequences. `node scripts/gen-demos.mjs` reports **10/10 skin covered, 0 missing, 0 unseeded** for this package and passes `--strict`.

  **Variants are seeded, not hopeful.** A read served by a mocked `fetch` paints its loading arm on the first frame, so a catalogue of six variants photographs one skeleton six times. The demo harness gained a `seed`: the answer — or the exact refusal — goes straight into the query cache, and the client is configured so nothing re-reads over it (`retryOnMount: false` is load-bearing — react-query clears a cached error the moment it starts a fetch on a query holding no data). `assertVariantsRenderDistinctly` now runs over every demo in the suite and is what keeps it honest. It is fed a jsdom renderer rather than `renderToStaticMarkup`, because half of this pair's surfaces are dialogs and React's server renderer refuses portals outright.

  **A render matrix, ten surfaces wide.** Every default-skin surface is now rendered at 390px and 1280px, on both theme sides: the surface appears, every skin root in the document reports the document's live mode (a `mode = "light"` default would fail it), and the three dialog surfaces are bottom sheets on a phone and centred modals above the tablet break. The `matchMedia` stub's `matches` became a live getter in the process — the substrate caches one `MediaQueryList` per process because a real one is live, so a frozen stub answered every width with the first one and a phone/desktop matrix would have quietly asserted the same side twice. 40 → 98 tests.

  **`DeleteEventAction` accepts `open` / `onOpenChange`** (additive). The confirmation was reachable only by clicking, which meant no static shot could ever show what deleting one time in a series says differently from deleting a standalone event. Controlling it is also what a host needs to put "Delete" in its own overflow menu and still get this pair's confirmation copy.

## 0.6.1

### Patch Changes

- a8bd3f4: Raise the `@stapel/core` peer floor to the version that actually exports what each package imports.

  `@stapel/workspaces-react` 0.15.0 shipped declaring `>=0.12.0` while importing
  `LoadState`, which core did not export until 0.13.0. npm installed it happily;
  the host's typecheck then failed on a type the package's own `.d.ts` referenced
  and the host could not resolve. Nine packages were wrong the same way — most by
  a wider margin (`recordings-react` allowed 0.3.0).

  Nothing here could have caught it by building: in this monorepo every package
  compiles against the workspace core, always the newest one, so a declared floor
  is never the version anything is compiled against. `pnpm check:peer-floors` now
  reads each package's imports from `@stapel/core`, asks core's own tagged history
  which release first exported each name, and fails when the floor is older —
  wired into CI **and** the publishing path, since a gate only on the merge path
  does not stop a release.

  Also invalidates the workspace audit query after an invite, a role change and a
  removal: the history sits beside the roster and an admin who acts on one expects
  to see it in the other. Its key is its own root, so the members invalidation did
  not reach it.

## 0.6.0

### Minor Changes

- 400f9e6: An empty week and a week the server never answered for no longer look identical: `CalendarViewBag` hands out one `state: LoadState<CalendarRangeData>` — events and occurrences come out of the same `GET /calendar` body, so two states could never disagree — instead of pre-flattened `events` / `occurrences` / `isLoading` / `isError` / `error`.

  Render a grid through `matchList(mapLoad(state, (r) => r.events), …)`, whose four required arms keep "nothing scheduled" (`calendar.view.empty`) reachable only from a read that actually answered; the failed arm shows `calendar.view.error` plus a retry through the bag's `refetch()`.

## 0.5.0

### Minor Changes

- 6ef6c44: Gate top-level "the caller's own …" query hooks on `@stapel/core`'s new
  `useActiveSessionReady()` (owner-diagnosed live incident, 2026-07-17): a hook
  with no natural `enabled` condition of its own (`useWorkspaces`, `useWallet`,
  `useTransactions`, `useSubscription`, `useNotificationFeed`/
  `useInfiniteNotificationFeed`, `useCalendar`/`useEvents`/`useAvailability`,
  `useRecordings`) fires the instant a component mounts — which used to race a
  session still bootstrapping and read a live one as "expired". Detail hooks
  keyed by an id (`useWorkspace`/`useMembers`/`useEvent`/`useRecording`) now
  ALSO gate on session readiness in addition to their existing non-empty-id
  check, since an id can be known synchronously (e.g. a URL param) before the
  session settles.

  Deliberately NOT gated: `useCatalog` (billing) and `useLanguages` (profiles,
  unaffected by this changeset but worth noting for symmetry) — both are
  public reference lists a signed-out visitor legitimately needs.

  Zero manual wiring at any call site: `useActiveSessionReady()` reads
  whichever `SessionManager` a session-owning module (e.g.
  `@stapel/auth-react`'s `createAuthRuntime`) registered as "active", and
  defaults to `true` (never blocks) when no such module exists in the host at
  all.

## 0.4.1

### Patch Changes

- ae57230: v1 canon sweep §60 (api-versioning.md §2, §6): regenerated schema.ts /
  flows / manifest / llms.txt against the backends' `/…/api/v1/` contracts;
  gen scripts and manifest tag prefixes repointed to `/api/v1/`; documented
  `baseUrl` examples and the auth QR same-origin guard now use
  `/<mod>/api/v1/`. Public TS types unchanged — only the fetch base / path
  literals carry the new version segment. Mount your runtimes at
  `/<mod>/api/v1/`.

## 0.4.0

### Minor Changes

- ca3ba45: Track stapel-calendar 0.3.x (scheme B — the pair's minor follows the backend
  minor). Regenerated from the `v0.3.1` contract and surfaced the two new event
  mutations:

  - **`useUpdateEvent`** (`PATCH /events/{id}`) — partial, owner-only update. Only
    the fields present in `patch` change; editing any recurrence field of a series
    master re-specifies the whole RRULE (send the complete recurrence spec, as for
    create). Backed by `CalendarApi.updateEvent` + the `EventUpdateRequest` type.
  - **`useReplaceParticipants`** (`PUT /events/{id}/participants`) — replace-set
    semantics: `participantIds` is the complete desired invitee list (the owner is
    always kept). Backed by `CalendarApi.replaceParticipants` +
    `ParticipantsReplaceRequest`.

  Both invalidate the module root on success, like the existing write hooks. The
  new `VISIBILITY` capability axis (participants|scope) is a backend deploy-time
  config that changes what the read endpoints return, not which endpoints exist —
  it needs no client surface and is reflected only via `backend.contract`
  (`>=0.3 <0.4`) in the manifest. Manifest now describes 10 operations.

### Patch Changes

- 9a4a3da: New pair: **`@stapel/calendar-react`** — the headless React pair for
  stapel-calendar (client priority: meettoday migrates onto stapel-calendar). The
  first pair generated §17-native, directly from the backend module's OWN
  per-module contract (`stapel-calendar/docs/{schema,flows,errors}.json`) rather
  than the unified monolith schema.

  - **API layer** — typed operations over the injected `StapelClient`
    (`availability`, `calendar`, `listEvents`, `createEvent`, `getEvent`,
    `deleteEvent`, `respond`), an `.ics` download-URL builder (`eventIcsUrl`), and
    the `isSubmittableRsvp` type-guard. Wire types are aliased from a
    package-LOCAL generated schema (`src/api/generated/schema.ts`, produced by the
    shared `gen-api.mjs` via the new `API_OUT` knob pointed at
    stapel-calendar's `docs/schema.json`) — stapel-calendar is not in the monolith,
    so this pair cannot draw from core's shared `components`. Documented
    corrections narrow the bare-`string` `rsvp` / `status` / `recurrence_type`
    fields and add the under-described range/slot query params.
  - **model** — namespaced `calendarQueryKeys`, read hooks (`useCalendar`,
    `useEvents`, `useEvent`, `useAvailability`) and write hooks (`useCreateEvent`,
    `useDeleteEvent`, `useRespondToEvent`) that invalidate the module root on
    success.
  - **headless** — `CalendarProvider`, `CalendarView`, `EventComposer`,
    `EventRsvp` (render-prop bags, zero visual opinion), each with a `*.demo.tsx`
    (completeness gate) and msw-backed hook tests.
  - **i18n** — `CALENDAR_I18N_KEYS` + en bundle merged over the generated backend
    error map (48 keys) so every `error.*` code has an en fallback. en-only:
    stapel-calendar ships no locale catalogs yet, so no `./i18n/<locale>` subpath.
  - **flows** — none (stapel-calendar annotates no `@flow_step`); the generated
    registry is correctly empty and drift-gated.
  - Self-describing `manifest.json` / `llms.txt` (8 operations, 48 errors),
    drift-gated by the shared root `gen:*` drivers. Version `0.2.0` tracks
    stapel-calendar's 0.2.x minor; `backend.contract` is `>=0.2 <0.3`.

- 4e6f442: Internal plumbing swap (slim wave §21/S2) — the pair's stamped
  `model/runtime.ts` / `model/context.tsx` / `headless/<Mod>Provider.tsx`
  boilerplate (byte-identical across the six standard pairs) now binds
  `@stapel/core`'s `createModuleRuntime` / `createModuleContext` factories
  instead of carrying its own copy. Public API preserved exactly: same exported
  names and signatures (`create<Mod>Runtime`, `<Mod>Runtime`,
  `Create<Mod>RuntimeOptions`, `<Mod>RuntimeContext`, `use<Mod>Runtime`,
  `use<Mod>Api`, `use<Mod>Analytics`, `<Mod>Provider>`), same guard-hook error
  messages. No behavior change.
- c3482e7: README wave (slim wave §21/S4): every pair now documents its setup — a new
  Install + "Wire the app once" section built on core's `<StapelProvider>`
  (previously only auth-react's README showed any wiring, as a 5-level provider
  nest). auth-react's wiring example moves to the one-provider shape with the
  `queryRuntime`/`i18n` escape hatches spelled out.
- d3232a9: Zero-flow scaffolding removed (slim wave §21/S3). These six backends annotate
  no `@flow_step`, so `gen:flows` now skips emission for them and the pair's
  `src/flows/generated/` files are gone. The public flow surface is preserved
  exactly by a tiny hand-written shim (`src/flows/registry.ts`): `<MOD>_FLOWS`
  (still `{}`), `<Mod>FlowId`/`<Mod>FlowSpec` (still `never`), `FlowEndpoint`,
  and `flowEndpoints` keep their names, types, and behavior. `toFlowError` and
  the core flow-machine re-exports are untouched. No public-surface delta; the
  generated registry returns automatically once the backend documents its first
  flow.

## 0.2.0

### Minor Changes

- New pair: **`@stapel/calendar-react`** — the headless React pair for
  stapel-calendar (client priority: meettoday migrates onto stapel-calendar).
  The first pair generated §17-native, directly from the backend module's OWN
  per-module contract (`stapel-calendar/docs/{schema,flows,errors}.json`) rather
  than the unified monolith schema.

  - **API layer** — typed operations over the injected `StapelClient`
    (`availability`, `calendar`, `listEvents`, `createEvent`, `getEvent`,
    `deleteEvent`, `respond`), an `.ics` download-URL builder (`eventIcsUrl`),
    and the `isSubmittableRsvp` type-guard. Wire types alias a package-LOCAL
    generated schema (`src/api/generated/schema.ts` — the shared `gen-api.mjs`
    driver via the new `API_OUT` knob, sourced from stapel-calendar's
    `docs/schema.json`), because stapel-calendar is not in the monolith and so
    cannot draw from core's shared `components`.
  - **model** — namespaced `calendarQueryKeys`, read hooks (`useCalendar`,
    `useEvents`, `useEvent`, `useAvailability`) and write hooks
    (`useCreateEvent`, `useDeleteEvent`, `useRespondToEvent`) that invalidate
    the module root on success.
  - **headless** — `CalendarProvider`, `CalendarView`, `EventComposer`,
    `EventRsvp` (render-prop bags, zero visual opinion), each with a
    `*.demo.tsx` and msw-backed hook tests.
  - **i18n** — `CALENDAR_I18N_KEYS` + en bundle merged over the generated
    backend error map (48 keys). en-only: stapel-calendar ships no locale
    catalogs yet.
  - **flows** — none (no `@flow_step` on the backend); the generated registry is
    correctly empty and drift-gated.
  - Self-describing `manifest.json` / `llms.txt` (8 operations, 48 errors).
    Version `0.2.0` tracks stapel-calendar's 0.2.x minor; `backend.contract` is
    `>=0.2 <0.3`.
