---
"@stapel/shell-react": patch
---

`dockRenders` is now exported from `@stapel/shell-react/default`.

`<PublicShell>` already asked this predicate before reserving `DOCK_CLEARANCE`
under the last row of the page (a one-entry nav floats no island, so nothing
should be reserved for it either), but the predicate itself stayed internal.
A host aligning its own sticky surface — a checkout bar, a "call" CTA — with
the floating dock had no way to ask the same question `<NavDock>` answers
when it decides whether to render at all; it had to assume the island always
exists. `dockRenders(nav, max?)` is the exact function `<NavDock>` renders
against, exported alongside `dockEntries`, `DOCK_HEIGHT` and `DOCK_CLEARANCE`
and documented next to them in the README.
