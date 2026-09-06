# @stapel/shell-react

Scripted-fullstack navigation shell (Phase 1 lib-side core, owner directive: from
OSS libs, one scripted command with **no LLM** produces a working navigated
fullstack).

## `resolveNav` (root export — pure, no React)

```ts
import { resolveNav } from "@stapel/shell-react";
import navManifest from "../nav-manifest.json"; // pnpm gen:nav's root aggregate

const nav = resolveNav(navManifest.packages, projectOverrides);
```

Merges every installed `@stapel/<pair>-react`'s nav-manifest, applies a
project's per-entry overrides, sorts, nests `placement.level: "submenu"`
entries under their `parentId`, and filters to only the entries that resolve
visible. Runs identically at scaffold codegen time (baking a default
`stapel.nav.json`) and at runtime in the shipped app (re-applying the
project's live override file) — see the module doc in
`src/headless/resolveNav.ts` for the exact algorithm.

### The override file (`stapel.nav.json`)

```jsonc
{
  "overrides": {
    "listings.favorites": { "order": 20, "surface": "public", "requiresAuth": false },
    "chat.conversations": { "order": 40, "surface": "public", "requiresAuth": false }
  }
}
```

Four fields, and they are the four a **container** legitimately re-decides:
`menuVisible`, `order`, and — since 0.11 — `surface` and `requiresAuth`. A
module declares who its screen is for in the abstract; the container knows
what it actually mounted around that screen. A classified storefront puts
Favourites and Messages in its phone dock for an anonymous visitor because it
mounted a guest wall in front of those routes, and the module that declared
them `member` could not know that.

Both axes are overridable and both remain **independent** — `resolveNav`
applies both gates, exactly as before. They are both exposed because
overriding one alone is, for that case, a setting that does nothing: a
`member` + `requiresAuth` entry moved to `"public"` is still dropped by the
session gate. An override cannot exempt an entry from the gates; it can only
restate what the entry **is**, and the restatement travels to the resolved
entry, so the menu row and the route a host mounts from the same tree agree.

### `resolvePublicNav` / `resolveMemberNav` — the audience in the name

```ts
import { resolvePublicNav, resolveMemberNav } from "@stapel/shell-react";

const publicNav = resolvePublicNav(navManifest.packages, projectOverrides);
const memberNav = resolveMemberNav(navManifest.packages, projectOverrides);
```

`resolveNav`'s `audience` option is optional and its default does **not**
protect: omit it and nothing is filtered by surface, so a public container
that forgot the option mounts every `member` screen and every one of them
answers 403. The default has to stay permissive (scaffold codegen bakes every
route a project could mount), so the fix is not a changed default but a call
you cannot make wrong — these two wrappers put the audience in the name.

## `<AppShell/>` (`/default` subpath — antd + react-router)

```tsx
import { AppShell } from "@stapel/shell-react/default";

<Route element={<AppShell nav={nav} mode="light" />}>
  {/* the consumer's own nested <Route>s render into AppShell's <Outlet/> */}
</Route>;
```

A responsive antd `Layout`: a `Sider` + `Menu` at desktop width, a hamburger
`Drawer` at phone/tablet width (`@stapel/core`'s `useBreakpoint`). Theme comes
from `toAntdThemeConfig(mode)` (`@stapel/tokens-antd`) — the same call
`@stapel/auth-react`'s `AuthPanel` makes. The shell does not own the router:
`nav` is already-resolved data, and the consumer wires its own route tree
around `<AppShell/>`.

## `<PublicShell/>` (`/default` subpath — the public storefront chrome)

```tsx
import { resolvePublicNav } from "@stapel/shell-react";
import { PublicShell } from "@stapel/shell-react/default";

<Route
  element={
    <PublicShell
      nav={resolvePublicNav(navManifest.packages, projectOverrides)}
      mode="light"
      brand={<Link to="/"><Logo /></Link>}
      searchSlot={<SearchField />}
      categorySlot={<TopCategories />}
      accountSlot={mandate === "member" ? <AccountMenu /> : undefined}
      footer={<RankingDisclosureLink />}
    />
  }
>
  {/* public routes render into PublicShell's <Outlet/> */}
</Route>;
```

A **sibling** of `<AppShell/>`, not a mode of it. `AppShell` reads no session
and no workspace either — what separates a marketplace from an app cabinet is
the shape of the chrome, and a `public` flag would branch the whole render
tree. The two share everything genuinely shared (`resolveNav`, the icon table,
the nav `Menu`, `toAntdThemeConfig`, `useBreakpoint`) and no geometry:

| | `<AppShell/>` | `<PublicShell/>` |
|---|---|---|
| Nav chrome | `Layout.Sider` (desktop) / `Drawer` (phone) | top bar + browse bar (desktop) / `Drawer` or dock (phone — `phoneChrome`) |
| Slots | `logo`, `headerExtra` | `brand`, `searchSlot`, `categorySlot`, `accountSlot`, `footer` |
| Sign-in | host's business | **default CTA when `accountSlot` is omitted** |
| Content width | full width of the content column | `contentMaxWidth` (default **1280**, centred; `false` = edge to edge) |

Three properties it is tested against rather than trusted on:

1. **No `Sider`, ever.** On phone the browse bar (nav menu + category strip)
   collapses into a `Drawer` — or, with `phoneChrome="dock"`, into the bottom
   dock; the header's search box stays either way.
2. **`accountSlot` is a CTA, never emptiness.** Omit it and a sign-in link to
   `auth.login`'s own route (`/login`) renders anyway. A hidden control
   teaches nothing: the missing sign-in button on a public storefront is not
   "clean", it is a dead end for the one person the page exists to convert.
3. **It reads no session.** The mandate belongs to the container
   (`@stapel/core`'s `MandateProvider` + `matchMandate`), which is also what
   picks `resolvePublicNav` vs `resolveMemberNav`. A shell that read it too
   would be a second home for the access rule.

### `contentMaxWidth`

The routed content is centred at **1280px** by default — a 12-column catalogue
grid of ~280px cards plus gutters, and prose that keeps a readable line length
on a monitor wider than the layout. A page that draws its own full-bleed
sections (a landing page, a map) passes `contentMaxWidth={false}`; a text-heavy
storefront passes its own number.

```tsx
<PublicShell nav={nav} mode="light" contentMaxWidth={960} />
<PublicShell nav={nav} mode="light" contentMaxWidth={false} />
```

The chrome above it stays full-bleed on purpose: a top bar that stops short of
the window edges reads as a broken page, not as a measure.

### `phoneChrome` — two phone frames, one desktop

```tsx
<PublicShell nav={nav} phoneChrome="dock" searchSlot={<HeaderSearch />} />
```

Below the desktop breakpoint only; desktop is untouched either way.

| | `"drawer"` (default) | `"dock"` |
|---|---|---|
| Header | two lines — hamburger + brand + account, then search | **one sticky row** — search stretched, account at its end |
| Brand | drawn | not drawn (identity lives in the dock) |
| Nav | hamburger → `Drawer` (menu + categories) + dock | **dock only** |
| Footer | drawn | drawn |

`"drawer"` is byte-identical to every release before the prop existed. `"dock"`
is the reference phone chrome for a classified storefront: the search field is
what a phone header is for, and the destinations a hamburger hid are already
under the thumb.

One thing `"dock"` gives up, stated rather than discovered: the phone theme
switch lives in the foot of the nav sheet, so removing the sheet removes it.
That is accepted. A pre-paint boot script following `system` already puts an
anonymous visitor on the right side of the theme, and the choice itself belongs
on the account/profile surface a host owns — `<ShellThemeControl variant="settings"/>`
is one import away. What is not acceptable is a three-target appearance control
on the one row a storefront's search field lives on; a single 36px icon button
(the 0.14.0 default) is a different question, and one a host answers with
`themeControl`.

### `headerSticky` — a pinned header, and the height everything else reads

```tsx
<PublicShell nav={nav} headerSticky="desktop" headerScrollFlag />
```

The shell used to pin its header in `phoneChrome="dock"` and nowhere else, so a
storefront was pinned on a phone and `static` on a desktop — an inconsistency
inside one app before it is a gap against anything else — and the only way to
settle it was a host sheet rule over `[data-testid="public-shell-header"]`, i.e.
a geometry decision taken outside the component that owns the geometry.

| `headerSticky` | Desktop (≥ `breakpoints.desktop`) | Below it |
|---|---|---|
| omitted (default) | as before — not pinned | pinned in `"dock"`, not in `"drawer"` |
| `"desktop"` | pinned | not pinned |
| `"phone"` | not pinned | pinned |
| `true` / `false` | pinned / not | pinned / not |

Pinning brings its own two declarations with it: the header's `background` is
the theme's container token (so content passing under it is covered on both
sides of the theme) and its layer is `zIndexPopupBase` — the one `<NavDock/>`
floats on, and one antd's own popups sit above, so a `<Select>` inside
`searchSlot` still opens over the header.

**The height is published, in both currencies.** Everything a storefront pins
under a fixed header — a filter rail, a sort bar, a "back to top" button, a
category strip — offsets itself by the header's height:

| Export / property | Value | For |
|---|---|---|
| `HEADER_HEIGHT_DESKTOP` | `number` (px) | TypeScript: the desktop row |
| `HEADER_HEIGHT_PHONE` | `number` (px) | TypeScript: the one-row phone header (`"dock"`) |
| `--stapel-header-height` (`HEADER_HEIGHT_VAR`) | a length | CSS: declared on the shell's root, switched at `breakpoints.desktop` by a media query |
| `PUBLIC_SHELL_CLASS` | `"stapel-public-shell"` | the class the sheet is hung on |
| `publicShellCss()` | `string` | the sheet itself, for a host that renders its own `<style>` |

```css
/* under the header, and never a number typed twice */
.my-filter-rail { position: sticky; top: var(--stapel-header-height, 56px); }
```

The property is a **media query**, not a render: an inline value computed from
`useBreakpoint()` is applied at render, so a window dragged across 1200px moves
the header before it moves whatever pinned under it. It is declared on the
shell's own root rather than on `:root`, so two shells on one page cannot fight
over one name — and below the desktop edge it is declared for `"dock"` ONLY,
because in `"drawer"` the phone header wraps to a second line for the search
field and has no fixed height at all. Keep a fallback in the `var()` for that
case; being told nothing is better than being told 56px.

The dock rung is written `.stapel-public-shell:where([data-phone-chrome="dock"])`
and the desktop rung is declared LAST, so above the breakpoint the desktop
answer wins whatever chrome the phone wears. Without the `:where()` the dock
selector is (0,2,0) against the desktop rule's (0,1,0), a media query adds no
specificity, and a `"dock"` storefront read 56px under a 64px header at every
width — everything pinned to the variable then sat 8px behind the header (D449).

**`headerScrollFlag`** puts `data-scrolled="true" | "false"` on the header once
the page has moved, and nothing else — a hairline, a shadow or a blur is a
brand decision, so the pair owns the fact and not the paint:

```css
[data-testid="public-shell-header"][data-scrolled="true"] {
  box-shadow: var(--stapel-elevation-low);
}
```

The fact comes from ONE `IntersectionObserver` on a 1px sentinel the shell
renders above its own header — never a `scroll` listener, which runs on every
frame of a feed of photographs. The sentinel takes a pixel and gives it straight
back (`margin-block-end: -1px`), so it is a position in the page and never a
change to it. Off, the attribute is absent entirely rather than `"false"`: a
host that did not ask for the observer should not be able to write a rule that
silently never fires.

### Dock geometry — aligning a host's own sticky chrome

```tsx
import { DOCK_CLEARANCE, dockRenders } from "@stapel/shell-react/default";

const floats = dockRenders(nav); // same predicate <NavDock> renders against
<div style={floats ? { paddingBottom: DOCK_CLEARANCE } : undefined}>
  {/* a host's own sticky bar, aligned to the island's own inset */}
</div>;
```

`<PublicShell/>`/`<AppShell/>` already reserve `DOCK_CLEARANCE` at the foot of
the page for you (`phoneChrome="dock"`) — these exports are for a host that
draws a SECOND sticky surface (a checkout bar, a "call" CTA) that has to sit
above the floating island rather than under it, and needs to ask the same
question the shell already answers internally:

| Export | Signature | Answers |
|---|---|---|
| `DOCK_HEIGHT` | `number` | the island's own height in px, before insets |
| `DOCK_CLEARANCE` | `string` (a `calc()`) | the island's height + insets + `env(safe-area-inset-bottom)` — what to reserve under the last row |
| `dockEntries(nav, max?)` | `(nav: ResolvedNavEntry[], max?: number) => ResolvedNavEntry[]` | which entries the dock would draw |
| `dockRenders(nav, max?)` | `(nav: ResolvedNavEntry[], max?: number) => boolean` | will `<NavDock>` draw an island at all for this nav — `false` below two destinations |

`dockRenders` is the exact predicate `<NavDock>` renders against (an island
holding one link is a button that has been given a bar to sit in, not
navigation) — it used to be internal, which meant a host aligning a sticky bar
with the island had to assume the island exists. A one-entry manifest proved
otherwise: nothing floats, so nothing should be reserved for it either. Call
`dockRenders` with the same `nav`/`max` a `<NavDock>` or `<PublicShell dock>`
nearby is given, and the two will always agree.

### `navBadges` — counts on nav destinations (both shells)

```tsx
<PublicShell nav={nav} navBadges={{ "chat.conversations": unreadTotal }} />
<AppShell    nav={nav} navBadges={{ "chat.conversations": unreadTotal }} />
```

A `Record<navEntryId, number>` rendered **wherever that entry renders** — the
dock's item, the `Sider`/sheet's `Menu` row, the storefront top bar's tab —
with the number on a badge for the eye and folded into the row's accessible
name (`"Messages, 3 unread"`) for a screen reader. Absent or `0` draws nothing:
a zero badge is a mark that says nothing is happening.

It is the runtime channel over the static manifest. A manifest is baked at
build time and says which destinations exist; how many of anything is waiting
behind one is a fact only the module owning that thing can answer, and a shell
that fetched it would be reading state for modules it must not depend on — so
it arrives as data addressed by the id the manifest already gave the entry.

`<PublicShell/>`'s older `dockBadges` still works and is still dock-only; where
both name the same entry the narrower input wins for the dock. New code passes
`navBadges`.

## `<ThemeModeControl/>` (`/theme` subpath — plain DOM, no antd, no CSS file)

```tsx
import { ThemeModeControl, useThemePreference } from "@stapel/shell-react/theme";

// `preference` is whatever the host treats as the source of truth — a
// profile field, a store, local state.
useThemePreference(preference);

// The default: one 36px icon button for a header, cycling light → dark →
// system on click.
<ThemeModeControl value={preference} onChange={save} />;

// The three-label segmented control, for an appearance screen.
<ThemeModeControl variant="settings" value={preference} onChange={save} />;
```

Three states, not two: **light**, **dark**, and **follow the system** (sun /
moon / half-disc, the Django-admin idiom). `system` is a rule, not a colour —
it resolves to one of the other two and keeps resolving — so the choice stays
tellable apart from the colour it lands on, and the half-disc's accessible name
names that resolution (`"Match system (Dark)"`). Buttons and inline
`currentColor` SVG, coloured through `--stapel-*` custom properties with
fallbacks, so a Tailwind host with no antd and no `tokens.css` renders it
correctly too.

### `variant` — `"compact"` (default) or `"settings"`

| | `compact` (default) | `settings` |
| --- | --- | --- |
| Shape | one icon button, 36px | segmented track, three 44px named segments |
| Interaction | click cycles light → dark → system | ARIA radio group: one tab stop, arrow keys move the choice |
| Reads its value from | its accessible name | the marked, filled segment |
| For | a header | an appearance screen |

`compact`'s accessible name is its whole readout, so it carries **both** where
the choice stands and where the next press lands — `"Appearance: Dark. Switch
to Match system"` — composed from `labels.cycle`, a template over `{current}`
and `{next}` that a translator writes in their own word order (`shell.theme.cycle`
in the `en`/`ru`/`es` catalogues this package ships). It is a plain `<button>`,
not `role="switch"`: a switch promises two states and this cycles three. Neither
variant renders a tooltip; `tooltip` opts one in for a pointer-only host.

**This was the default's shape as of 0.14.0, and it changed a look.** Before it,
the default was the segmented control — which the shells mount in their header
chrome, so a ~310px three-label appearance SETTING stood in the first row of
every desktop page and hosts answered by switching the chrome's switch off and
rebuilding a home for it. Pass `variant="settings"` wherever you want the old
control back; the placements the shells use have not moved.

`applyThemePreference()` is the single writer: it stamps `data-theme` (the
canon `@stapel/tokens-antd`'s `resolveThemeMode()` reads), the Tailwind `dark`
class (`darkClasses: []` opts out) and `color-scheme` in one call, so a host
cannot end up half themed. It never touches the backend — persisting the
choice is the host's, through whatever profile client it already owns.
`THEME_PREFERENCE_STORAGE_KEY` is published for the host's pre-paint boot
script, which runs before any bundle and so cannot import this module.

## `<ShellThemeControl/>` (`/default` subpath — the switch as chrome)

```tsx
import { ShellThemeControl } from "@stapel/shell-react/default";

// Nothing to wire: it reads the cached preference, applies it, follows the
// OS while the choice is "match system", and writes the choice back.
<ShellThemeControl />;
```

`ThemeModeControl` above is prop-driven on purpose — a host that keeps the
preference in a profile field owns the value. That contract is wrong for
CHROME, which cannot ask its host for a value the host has no reason to hold,
so this wrapper owns the state and takes its labels from the `shell.theme.*`
keys through core's `useT()` (it therefore needs an `<I18nProvider>`; the bare
control does not).

**`<AppShell/>` and `<PublicShell/>` render it by default** — foot of the
`Sider` and end of the header's account area on a desktop, foot of the nav
sheet on a phone, and since 0.14.0 in its **compact** shape (the slots are
unchanged; `<ShellThemeControl variant="settings"/>` is a single import for a
host's own appearance screen) — because a mechanism with no place is a
mechanism nobody has:
every token file in the fleet compiles a `[data-theme="dark"]` block and no
deployment could reach it. `themeControl={false}` opts out, for a host whose own
settings screen owns the choice. It is not a substitute for the pre-paint boot
script: the wrapper applies nothing until its (async) cached read resolves, so
the first paint is still the boot script's to get right.
