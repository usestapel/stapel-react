---
"@stapel/shell-react": minor
---

`<AppShell/>` and `<PublicShell/>` take a `slots` prop keyed by `@stapel/core`'s `ShellSlotId`. `AppShell` renders `topbar.start`, `topbar.center`, `topbar.end`, `sidenav.head`, `sidenav.foot` and `sheet.foot`, each in a `data-testid="app-shell-slot-<id>"` region that exists only when filled. On `PublicShell` the slots fill `brand`, `searchSlot`, `accountSlot`, `categorySlot` and `footer`; an explicit prop still wins, so no existing host changes, and `bottombar` is reserved. New root export `SHELL_TEMPLATES` (with `ShellTemplateId`) and the published `./shell-templates.json` name the three shell templates and the slots each renders.

The `@stapel/core` peer floor rises to `>=0.30.0`, the release that ships the slot types this package now imports.
