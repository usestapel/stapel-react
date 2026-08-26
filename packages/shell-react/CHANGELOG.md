# @stapel/shell-react

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
