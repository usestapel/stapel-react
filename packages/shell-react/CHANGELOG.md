# @stapel/shell-react

## 0.14.2

### Patch Changes

- 9b489ef: One left edge. The header, the content and the footer each hardcoded
  `spacing[4]` for their side padding, so a page mounted inside the shell added
  its own on top and a composed screen had a header at 16px, a page body at 40
  and a footer at 16 — three left edges down one window. All three now read
  `var(--stapel-page-gutter, 16px)`, the responsive token role
  (`@stapel/tokens`): 4px on a phone, 8px on a tablet, 24px on a desktop, with
  its own media arms, so it also reflows on resize instead of being recomputed
  at the shell's next render. The fallback is the value the three boxes used
  before, so a host that loads no stylesheet does not move. Block padding is
  unchanged — how tall the chrome is remains the chrome's business.

## 0.14.1

### Patch Changes

- cf69ee4: `<ThemeModeControl/>` (both the compact header button and the settings variant's segments) now draws the shell's own `:focus-visible` ring (`--stapel-focus-ring`, 2px, `outline-offset:2px`) instead of the engine's default outline — it was the one header stop still showing Chromium's default blue ring while every other control in the chrome drew the token one. A single hoisted stylesheet (React 19's `<style href precedence>` dedup, the same mechanism `NavDock` already uses) carries the rule so an inline `style` object can still express everything else; a host's own `className` rides alongside it rather than replacing it. No visual change on a mouse click — the rule gates on `:focus-visible` only.

## 0.14.0

### Minor Changes

- ae1c8c5: shell: the theme switch's DEFAULT is now a compact icon toggle — `variant="settings"` brings the three-label control back

  **This changes a default look.** `<ThemeModeControl/>` and `<ShellThemeControl/>`
  render one 36px icon button by default, cycling light → dark → system on click.
  The three-label segmented control they used to render is now
  `variant="settings"` — pass it wherever you want the old control, on your own
  appearance screen or anywhere else you had it. Nothing else moved: `<AppShell/>`
  and `<PublicShell/>` mount the switch in exactly the slots they always did (foot
  of the `Sider` and end of the header's account area on a desktop, foot of the
  nav sheet on a phone), and `themeControl={false}` still opts out entirely.

  The old default was a settings control mounted as chrome. The shells put the
  switch in their header, and a ~310px track spelling out "Light / Dark / Match
  system" in words stood in the first row of every desktop page — an appearance
  SETTING wearing navigation's clothes. Hosts answered the only way they could:
  switch the chrome's switch off and rebuild a home for it (the fleet's storefront
  moved it to its footer and its account page). A default that every serious host
  turns off is not a default, it is a shape nobody wanted, and the fix belongs in
  the library rather than in each host's workaround.

  What one icon button has to carry, it carries in its accessible name, which is
  now its whole readout: both where the choice stands and where the next press
  lands — `"Appearance: Dark. Switch to Match system"`. That sentence is a new
  key, `shell.theme.cycle`, shipped in all three catalogues (`en`/`ru`/`es`) as a
  TEMPLATE over `{current}` and `{next}`, so a translator keeps their own word
  order instead of receiving two nouns glued to an English frame. `system` stays
  tellable apart from the colour it resolves to, exactly as in the settings
  variant: the name appends the resolution (`"Match system (Dark)"`). It is a
  plain `<button>`, not `role="switch"` — a switch promises two states and this
  cycles three — so Enter and Space work with no key handling of ours.

  Also: `tooltip` (off by default, both variants) mirrors the accessible name into
  a `title` for a pointer-only host; `ThemeModeLabels.cycle` is optional, so labels
  written before this variant existed keep type-checking and fall back to the
  English sentence. Both variants stay plain DOM and inline `currentColor` SVG
  through `--stapel-*` custom properties with fallbacks — no CSS file, no antd,
  and the `/theme` entry point is still under its 4 KB budget (2.24 KB).

## 0.13.0

### Minor Changes

- d7677eb: A phone can reach any leaf, filter by anything the category declares, and get home.

  **`categories-react` — the rootless cascade stops reading the whole catalogue.**
  With no `rootId` and no host-supplied `roots`, the top rung was the category
  LIST endpoint, which has no roots filter: on a live catalogue of 3583 rows that
  was 36 requests, 1.4 MB, and 19.9 seconds before the composer's first select
  existed. Every rung below it costs one `children/` call and a third of a
  second, so the whole cost of the control was that one question. It is now
  answered by `GET /categories/carousel/` — one cached request — projected to the
  rows with no ancestors, which is what a root is. A deployment whose carousel
  names no roots falls through to the catalogue sync, unchanged.

  **`search-react` — an uncounted facet is still a filter.**
  A facet's options came only from the counted buckets, so a slug in
  `facet_meta.skipped` had none, and every surface drops a group with no options.
  On a live cars leaf that meant 26 facetable features declared, 12 counted, and
  14 filters a person could read about in a warning and not use — while `/query`
  accepts `f.<slug>` for every one of them. `buildFacetGroups` now builds an
  uncounted facet's options from the category schema (`config.options`, or the
  answer's own captions), with `count: null` beside each — "nobody counted this"
  is still said, and it no longer decides whether the filter exists. An applied
  value always renders. A `ref_select` whose config is a bare vocabulary pointer
  still has no options here and is still not invented.

  **`search-react` — the skipped-slug notice is opt-in.**
  `FacetPanelPane`/`SearchPage` take `skippedNotice` (default `false`). The
  sentence is the engine's own note about its facet plan; on the live cars leaf
  it rendered as a yellow warning naming forty-two of the category's fields above
  the filters. Same class as the synonym-expansion notice this pair removed
  earlier. `skippedNotice` puts it back for a developer.

  **`shell-react` — a phone has a way home.**
  `phoneChrome="dock"` draws no wordmark (a 390px row cannot hold one and a
  search field), and that left `/` reachable from nowhere: the header's leading
  control is the host's history back arrow, and the dock's tabs are wherever the
  nav manifest points. The header now carries a home MARK — the brand's logo at
  glyph size, or a house where there is none — always a link to `/`, at the head
  of the row. `home={false}` for a host whose own chrome owns that corner.
  `HomeOutlined` joins the nav-icon registry, so a manifest may declare a home
  destination without drawing the fallback square.

## 0.12.0

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

## 0.11.0

### Minor Changes

- 5df0d68: The phone storefront gets the chrome the reference marketplaces ship, nav
  counts become a first-class channel on both shells, and a project's nav-override
  file can restate who a destination is for.

  - **`<PublicShell phoneChrome="drawer" | "dock"/>`** (default `"drawer"`, which
    is byte-identical to 0.10.0). Below the desktop breakpoint `"dock"` draws no
    hamburger, no sheet, no browse bar and no second header line: the header is
    ONE sticky row — the search field stretched, the account control at its end —
    and the `<NavDock/>` is the whole navigation. The brand is not drawn on a
    phone in that mode; identity and destinations both live in the dock, and a
    390px row that carries a wordmark cannot also carry a search field worth
    typing into. The footer stays in both modes, because a storefront's legal
    links are not clutter. Desktop is untouched either way.

    One thing `"dock"` gives up, documented on the prop rather than discovered in
    production: the phone theme switch lives in the foot of the nav sheet, so
    removing the sheet removes it. A pre-paint boot script following `system`
    already puts an anonymous visitor on the right side of the theme, and the
    choice belongs on the account surface a host owns, where
    `<ShellThemeControl/>` is one import away. A three-target appearance control
    does not belong on the one row a storefront's search field lives on.

  - **`navBadges?: Record<navEntryId, number>` on `<PublicShell/>` AND
    `<AppShell/>`** — the canonical badge channel, rendered wherever the entry
    renders: the dock's item, the `Sider`/nav-sheet `Menu` row, the storefront top
    bar's tab. The number is on an `aria-hidden` badge for the eye and folded into
    the row's accessible name (`"Messages, 3 unread"`, the `shell.dock.unread`
    key the dock already used) for a screen reader; absent or `0` draws nothing.
    It is the runtime channel over a static manifest — a manifest says which
    destinations exist, and how many of anything is waiting behind one is a fact
    only the owning module can answer, so it arrives as data keyed by the id the
    manifest already gave the entry.

    `<PublicShell/>`'s `dockBadges` keeps working unchanged and stays dock-only;
    where both name the same entry the narrower input wins for the dock.

  - **`stapel.nav.json` may override `surface` and `requiresAuth`.** WHO a
    destination is for is a container decision as often as a module one: a
    classified storefront puts Favourites and Messages in its phone dock for an
    anonymous visitor because it mounted a guest wall in front of those routes,
    and the module that declared them `member` could not know that. Both axes are
    exposed because overriding one alone is a setting that does nothing — a
    `member` + `requiresAuth` entry moved to `"public"` is still dropped by the
    session gate. The two axes stay independent and both gates still apply: an
    override cannot exempt an entry, only restate what it IS, and the restatement
    travels to `ResolvedNavEntry` so the menu row and the route a host mounts
    from the same tree agree.

## 0.10.0

### Minor Changes

- 97185d1: `ShellThemeControl`: a self-managing theme switch, rendered by default in the
  `AppShell`/`PublicShell` chrome (`themeControl` opts out).

  The mechanism has been complete for two waves — `ThemeModeControl`,
  `useThemePreference`, `applyThemePreference`, `readStoredThemePreference` — and
  every token file in the fleet compiles a `[data-theme="dark"]` block. No
  deployment could reach it, because nothing in the default chrome rendered a
  control: a mechanism with no place is a mechanism nobody has. Default skins ARE
  the product (§83), so the place ships with the skin.

  - New `/default` export `<ShellThemeControl size? className? data-testid?/>`.
    It owns the three things the bare `ThemeModeControl` deliberately does not:
    the cached preference it starts from (`readStoredThemePreference`), applying
    it and following the OS while it says `system` (`useThemePreference`), and
    writing the choice back (`applyThemePreference`). Labels come from the
    `shell.theme.*` keys through core's `useT()`; the bare control stays
    prop-driven for hosts that translate elsewhere.
    It applies NOTHING until the cached read resolves, so it never re-stamps the
    document a frame after a pre-paint boot script stamped it correctly; until
    then it marks the mode the page is already in.
  - `<AppShell/>` and `<PublicShell/>` render it by default: at the foot of the
    `Sider` and at the end of the header's account area on a desktop, in the foot
    of the nav sheet on a phone (the 390px header line already carries a
    hamburger, a brand and an account control). New prop on both:
    `themeControl?: boolean`, default `true`, for a host whose own settings
    screen owns the choice. The `mode` prop is unchanged — it still PINS a side
    for a demo or a test.
  - `ThemeModeControl`'s track now wraps instead of clipping. Three named
    segments are ~310px wide and the chrome mounts it in places narrower than
    that; the segment that would have been cut off is the half-disc, whose whole
    purpose is to say the choice is a rule and not a colour.

## 0.9.0

### Minor Changes

- 042a088: `<PublicShell/>` draws the host's own brand and legal line.

  Two new `/default` components, and two defaults that use them:

  - `<SiteBrand linkComponent? homeHref?/>` — the logo (`alt=""`, because the
    name is rendered as text beside it) and the name from `useSite()`, wrapped
    in a link home. A brand with no logo is a text wordmark rather than a hole
    in the header. `linkComponent` takes core's router-agnostic `LinkComponent`;
    omitted, the react-router `<Link>` this entry point already depends on is
    used.
  - `<SiteLegalFooter>{children}</SiteLegalFooter>` — the operating company, a
    `mailto:` for the support mailbox, and the privacy/terms links THIS host is
    bound by, which on a second domain is a different company from the first.
    It renders the four keys the fleet ships and ignores any others rather than
    guessing a label for a key it has never seen; `children` is where a host
    puts its own footer nodes beside them.

  `<PublicShell/>` now fills `brand` with `<SiteBrand/>` and `footer` with
  `<SiteLegalFooter/>` when the host passes neither — but ONLY below a
  `<SiteProvider>`. It reads the seam through core's `useOptionalSite()`, so a
  host that mounts no provider gets exactly the previous behaviour instead of a
  crash: a brand slot is the last thing that should be able to take a storefront
  down.

  Three new chrome strings in en/ru/es: `shell.legal.privacy`,
  `shell.legal.terms`, `shell.legal.support`. The sentences on that line are the
  deployment's and arrive on the wire; only the link words are the shell's.

  The `@stapel/core` peer floor rises to `>=0.20.0` — `useOptionalSite` ships
  there.

## 0.8.0

### Minor Changes

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

## 0.7.2

### Patch Changes

- 5c4c17e: `matchesLocation` matches a multi-segment relative `linkPath` (e.g. `workspaces/settings`) as a whole instead of on its last segment only, so such menu rows now highlight as active.

## 0.7.1

### Patch Changes

- f9d8b66: Draw both shells as one real app frame — a full-width top bar carrying brand and account above sider and content, a 56px phone header, a nav sheet with a sensible width plus a labelled close control, nav rows with an icon gap and a selected-row background, a closed admin section rendered as a group so its reason is visible rather than clipped, a labelled three-segment theme control with ≥44px targets, and demos whose slots hold a real brand, search field, category strip, account control, footer and routed screens instead of dev slot outlines.

## 0.7.0

### Minor Changes

- 80617e9: The shell reads every field the nav contract emits, wears the shared skin, and speaks three languages.

  **One theme reader.** `useDocumentThemeMode` is now an alias of `useThemeMode`
  from `@stapel/tokens-antd/skin`. Two subscriptions to one `data-theme`
  attribute in one layer could not disagree today and would the first time one of
  them was fixed; the shell's control and every pair's skin now flip on the same
  store. `subscribeThemeStamp` is still exported for a non-React consumer.

  **Both chromes on `SkinTheme`.** `AppShell` and `PublicShell` no longer build a
  local `ConfigProvider` from a `mode` prop a host had to guess: they follow the
  document's live `data-theme`, paint the page surface, and inherit the 44px
  phone control height. `mode` is now **optional** on both — pass it to pin a
  side, omit it and the chrome moves with the theme. The phone drawer no longer
  flashes on a desktop for one frame (core's `useBreakpoint` is first-render
  correct), and there is a first-commit probe in the suite that fails if it comes
  back. The `☰` text glyph is a real inline-SVG icon button with an `aria-label`.

  **`resolveNav` honours the whole contract.**

  - `requiresAuth` was emitted and read by nobody. New `ResolveNavOptions.authenticated`:
    `false` drops every session-only entry, independently of `surface`, so a
    public-surface screen that still needs a session (`auth.qr_confirm`) stops
    appearing in an anonymous visitor's menu as a door onto the sign-in redirect.
    `resolvePublicNav` passes `false`, `resolveMemberNav` `true`; a bare
    `resolveNav` still filters nothing, for the scaffold-codegen call site.
  - `route.index` was a dead field. `ResolvedNavEntry` gains `index: boolean`
    (always present) and `linkPath` — the address a renderer links to and matches
    the location against, which for an index entry nested in a section is the
    **section's** path, because that is where an index route mounts. The menu
    reads it, and a new `findActive` prefers a child over the parent it shares an
    address with.
  - **`admin.root` was declared by nobody**, so `resolveNav`'s orphan-drop
    removed gdpr's DSAR queue and video's usage table from every host, silently.
    The section is synthesised when something hangs from it — `ADMIN_ROOT_ID` /
    `ADMIN_ROOT_ENTRY`, byte-identical to the generated container's own root — and
    steps aside for a host that declares its own.

  **The staff gate states a reason; it does not hide.** `<AppShell staff>` (from
  `@stapel/auth-react`'s `user.is_staff`, which the shell never reads itself)
  defaults to `false`, and `false` leaves the admin section **listed** and
  switched off with the reason as visible text beside it. An entry that vanishes
  teaches nobody the screen exists, and a person who cannot see it cannot ask for
  access to it. `NavMenu` gained `gate?: (entry) => ActionAvailability` for it;
  `adminNavIds` names the section from an already-resolved tree.

  **Chrome i18n.** `./i18n/ru` and `./i18n/es` subpaths (opt-in, en floor
  unchanged) — the hamburger's name, the sign-in call, the theme states and the
  new `shell.nav.admin` / `shell.nav.admin_staff_only`. The shell was the frame
  every translated screen sat inside, in English.

  **`ThemeModeControl` is the radio group it claimed to be.** Roving tabindex
  (one tab stop), arrow keys move and choose, Home/End jump to the ends, focus
  follows the choice. The `title` tooltip is gone: hover does not exist on touch
  and it only duplicated the accessible name.

  Also: `NAV_ICON_NAMES` / `isNavIcon` exported so `gen:nav` can validate a
  manifest's icons against the registry that renders them, `demo/` with skin
  demos for `AppShell` (desktop sider + phone drawer), `PublicShell` and
  `ThemeModeControl`, and the seven hardcoded `16`s replaced with `spacing[4]`.

- 234f91a: The nav menu draws icons instead of empty squares, and stops reserving a
  column for a menu that is not there.

  `NavEntry.icon` is a name the registry in `default/icons.tsx` resolves to a
  glyph, the registry knew four names, and the pairs in this monorepo declare
  sixteen — so twelve of them fell to the generic square. On a public storefront
  whose only public menu entry is the catalogue, the top navigation rendered a
  literal "□" beside the word. The twelve missing glyphs are drawn (still inline
  SVG, still no `@ant-design/icons` dependency), and a test derives the required
  list from the generated nav manifest, so a pair adding a name the registry has
  never heard of is now a failing test rather than a square on somebody's
  navigation bar. The fallback stays for a name from outside this monorepo, where
  it is the honest answer.

  `<PublicShell>`'s browse row no longer lays out the menu's flex spacer when
  there is no menu. A host can legitimately have a `categorySlot` and no nav tabs
  — a storefront whose every menu entry duplicated a link in the strip beside it,
  say — and the greedy `flex: 1 1 auto` on an empty div then ate the whole row
  and shoved the categories against the right edge, under a header whose brand
  sits at the left.

## 0.6.0

### Minor Changes

- 40cc6d1: `<PublicShell/>`: a nav menu that shows its tabs, and a measure for the content

  Two findings from a walk over the live storefront, both of them geometry.

  **The nav collapsed to "…" on a 1440px window.** The horizontal `<Menu>` was a
  bare child of the browse row's `<Flex>`, and a flex item with no basis is sized
  by its content — which rc-overflow measures before it has any, lands on ~0, and
  answers by hiding every tab behind an overflow trigger. The whole public nav
  was therefore reachable only through a "…" in an otherwise empty row. The menu
  now sits in a `flex: 1 1 auto` / `minWidth: 0` box that takes the row's
  leftover width, with the category strip pinned at `flex: 0 0 auto` so it cannot
  take that width back.

  **`contentMaxWidth`** (default `1280`, `false` for edge-to-edge). `Layout
.Content` was `padding: 16` and nothing else, so a listing's description ran
  the full width of whatever monitor it was opened on — a line length nobody
  reads, and a catalogue grid stretched into a shape no card was designed for.
  The routed content is now centred at a measure the host can set:

  ```tsx
  <PublicShell nav={nav} mode="light" contentMaxWidth={960} />
  <PublicShell nav={nav} mode="light" contentMaxWidth={false} />
  ```

  1280 is a 12-column grid of ~280px cards plus gutters — the same floor
  `@stapel/search-react`'s results grid uses, so the two agree about what a
  column is. The chrome above stays full-bleed on purpose: a top bar that stops
  short of the window edges reads as a broken page, not as a measure.

  `<AppShell/>` is deliberately untouched: its content column already sits beside
  a `Sider`, and the tables an app cabinet renders there want the width.

## 0.5.0

### Minor Changes

- 845a36c: `<PublicShell/>` — a second chrome for the public surface, a sibling of
  `<AppShell/>` rather than a flag on it.

  `AppShell` never read a session or a workspace; what stood between the fleet
  and a public storefront was the shape of its chrome (a `Sider`, always). The
  new component is the marketplace geometry: a top bar (`brand`, `searchSlot`,
  `accountSlot`), an optional browse bar (the nav `Menu` + `categorySlot`) that
  collapses into a `Drawer` on phone while the header stays, `<Outlet/>`, and an
  optional `footer`. Omitting `accountSlot` renders a sign-in CTA rather than
  nothing — a public storefront with no visible way in is a dead end, not a
  clean design. Like `AppShell`, it reads no session: the mandate stays with the
  container.

  `resolvePublicNav` / `resolveMemberNav` join `resolveNav` on the root entry.
  `resolveNav`'s `audience` is optional and its default filters nothing — which
  is correct for scaffold codegen and a trap for a public container, since a
  forgotten option mounts every `member` screen. The audience now has a spelling
  that cannot be forgotten.

  `AppShell`'s own rendering is unchanged; the nav `Menu` it shares with
  `PublicShell` moved to an internal module so the two chromes cannot drift on
  route matching.

## 0.4.0

### Minor Changes

- e25e9a6: `useMandateState()`, and a `resolveNav` that consumes the surface axis.

  `is_guest` has ridden the workspace-list response since stapel-workspaces
  0.19 and had **zero readers**. `useMandateState()` is the first one: the
  single point of truth for "does this person hold a mandate anywhere",
  computed from two answers that already existed — the active session's status
  (which settles anonymous and no-session without asking anyone) and the
  server's own `is_guest` predicate. No new endpoint, and no extra request:
  it reads the same `useWorkspaces()` a screen is already running.

  The server evaluates the predicate; the hook does not re-derive it. A caller
  can hold membership rows that grant no mandate, so `workspaces.length` is not
  the question — it is consulted only against a backend too old to answer.

  The unresolved case is the reason the hook is shaped the way it is. A list in
  flight and a list that 502'd both resolve to `unresolved` with a reason, and
  neither ever resolves to `guest`. The one-liner this forecloses —
  `data?.is_guest ?? true` — turns every backend hiccup into "you are a guest",
  locks members out of their own product, and explains nothing; there is no
  expression of that shape available, because the pending and failed states
  carry no principal to read. Render it with `matchMandate`: a wait, or the
  outage stated out loud.

  `resolveNav` now takes an optional `{ audience }` and every `ResolvedNavEntry`
  carries its resolved `surface`. Omit the audience and nothing changes — the
  scaffold-codegen call site keeps baking every route, and so does every
  existing runtime caller. Pass one and a screen closed to that principal is
  dropped, menu entry and route together, which is the fix: the tree a host
  mounts from is the tree the axis filtered. A project's override file can flip
  `menuVisible` and `order`; it deliberately cannot flip this, because a
  per-project preference must not put a screen that will refuse the caller back
  in front of them.

  `audience` is a `MandatePrincipal`, so `"unresolved"` cannot be passed. A host
  whose mandate has not settled has to render the wait or the error rather than
  resolve a nav for it — the alternative is a menu that quietly empties itself
  whenever the backend hiccups, which is "we could not ask" rendered as "you
  may not".

## 0.3.0

### Minor Changes

- 2d22564: New `/theme` subpath: `<ThemeModeControl/>`, the three-state theme switch every
  app in the fleet was about to write for itself.

  Light / dark / follow-the-system, in the Django-admin idiom (sun, moon,
  half-disc). `system` is a rule, not a colour: the mark stays on the half-disc
  whatever it resolves to, and the half-disc's accessible name carries the
  resolution (`"Match system (Dark)"`), so "following the system, currently dark"
  never reads the same as "pinned to dark".

  Plain DOM and inline `currentColor` SVG — no antd, no react-router, no CSS file
  to import — because the two hosts that need it render nothing alike (one is
  Tailwind + radix with no antd at all). 1.6 kB, isolated from the package root,
  which stays pure for scaffold-time `resolveNav`.

  `applyThemePreference()` is the single writer: `data-theme` (the canon
  `@stapel/tokens-antd`'s `resolveThemeMode()` reads), the Tailwind `dark` class
  and `color-scheme` in one call, so a host cannot end up half themed. It
  persists nothing to a backend — the host keeps owning its profile field —
  but does cache the choice under the published
  `THEME_PREFERENCE_STORAGE_KEY` for a pre-paint boot script.

## 0.2.1

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

## 0.2.0

### Minor Changes

- b97fdef: New package: the scripted-fullstack navigation shell (Ф1 lib-side core). Root export `resolveNav(installed, overridesFile)` is pure (no React, no antd, no react-router) — it merges installed pairs' nav-manifests, applies a project's `menuVisible`/`order` overrides, sorts, nests `submenu` entries under their `parentId` (dropping an orphaned parent gracefully, never throwing), and filters to visible entries. The same function runs at scaffold codegen time and at shipped-app runtime. The `/default` subpath ships `<AppShell/>`: a responsive antd `Layout` (`Sider`+`Menu` at desktop, hamburger `Drawer` at phone/tablet, via `@stapel/core`'s `useBreakpoint`) around a `react-router` `<Outlet/>` — the shell renders the resolved nav but does not own the router. Themed via `toAntdThemeConfig` (`@stapel/tokens-antd`), same call `AuthPanel` makes.
