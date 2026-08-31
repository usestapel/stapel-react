---
"@stapel/shell-react": minor
---

The phone storefront gets the chrome the reference marketplaces ship, nav
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
