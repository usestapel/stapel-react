---
"@stapel/shell-react": minor
---

The shell reads every field the nav contract emits, wears the shared skin, and speaks three languages.

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
