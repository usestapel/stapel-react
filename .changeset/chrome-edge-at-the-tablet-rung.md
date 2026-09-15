---
"@stapel/shell-react": minor
---

Both chromes change arms at the TABLET rung, and a host can name its own edge.

`<PublicShell/>` and `<AppShell/>` decided their whole geometry with
`useBreakpoint() === "desktop"`, which collapsed the three breakpoints
`@stapel/tokens` ships (`phone: 0`, `tablet: 768`, `desktop: 1200`) to two: every
width from **768 to 1199 drew the PHONE page**. On a 1024px tablet the storefront
floated its bottom dock over the content, drew the one-row phone header, hid the
browse bar and put the nav behind a hamburger; the app cabinet hid every
destination behind a hamburger and drew no `Sider` at all. A tablet rendered a
phone, on every route in the fleet.

**The edge is now `chromeFrom`**, a new optional prop on both components,
defaulting to `breakpoints.tablet` (768). Below it: the phone shell, byte for
byte what it was. From it up: the wide shell — no dock, the browse bar, the
horizontal menu, the 64px header row and the theme switch in it. The layout
stays FLUID above the edge: `contentMaxWidth` is a max and binds only where the
window is wider than it, so nothing jumps to the desktop measure at 768.

`<AppShell/>` gets a real THIRD arm rather than either neighbour's: from
`chromeFrom` to `breakpoints.desktop` the `Sider` is collapsed to a glyph rail
(`collapsedWidth` 64), so a tablet keeps its destinations on screen without
spending 200px of a 768px window on labels; the full labelled rail returns at
`breakpoints.desktop`, unchanged.

**`publicShellCss()` moves with the render.** It takes the edge as its first
argument (default unchanged) and writes its `--stapel-header-height` rung and
its chip-row pin at that width instead of at `breakpoints.desktop`. A sheet whose
rung sits at a different width than the header it describes publishes a height
that is wrong for the whole band between them, and two pairs pin against that
number (`<SearchPage railTop>`, `<SearchResultsPane stickyToolbar>`) — the D449
defect exactly. New `publicShellStyleHref(chromeFrom)`: React 19 dedupes a
hoisted `<style href>` by its href, so two shells at two edges on one page would
otherwise share one sheet and one of them would publish the other's geometry.

**Why a prop and not a new token rung.** A deployment's composition may not land
on one of the three rungs. The fleet's storefront puts its filter rail at 1024
(the owner's tablet rule — at 768 the 280px rail leaves the results one card
across where 767 gave two), so its chrome has to change arms at 1024 or the two
rules draw a hybrid: a desktop filter rail with the phone's bottom dock under it.
Moving `desktop` to 1024 in `@stapel/tokens` would re-compose every other app on
the ladder. So the deployment names its own width once, here — the same shape and
the same reasoning as `<SearchPage railFrom>` (`@stapel/search-react` 0.32.7).

Also exported: `DEFAULT_CHROME_FROM`, and `useWiderThan(edge)` — the one live
viewport read both chromes make — so a host arranging its own chrome around an
`<Outlet/>` changes arms at the same edge instead of writing a second reading of
the window.

**Migration.** Nothing renames and nothing is removed; every existing prop keeps
its name and its type.

- A deployment that wants the previous geometry passes
  `chromeFrom={breakpoints.desktop}` to both components — but read the defect
  above first: that geometry is a phone page on every tablet.
- `headerSticky="desktop"` / `"phone"` still mean "the wide arm" / "the phone
  arm". They are the same two sides of the same one edge, which now sits at the
  `tablet` rung by default rather than at `desktop`.
- A host that reads `--stapel-header-height` gets `64px` from 768 up instead of
  from 1200 up. That is the fix: it now describes the header actually on screen.
- A host that restated the old edge in its own stylesheet (`@media (min-width:
  1200px)`) should move that rule to its `chromeFrom`, or read the published
  property instead.
