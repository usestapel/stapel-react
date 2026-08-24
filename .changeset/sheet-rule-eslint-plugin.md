---
"@stapel/eslint-plugin": minor
---

New rule `stapel/no-bare-dialog`, on in `recommended`: inside a package's
`src/default` tree, `Modal` and `Drawer` are not importable from antd.

The dialog surface is a fleet rule now (`@stapel/tokens-antd/skin`'s
`SkinDialog` — a bottom sheet on a phone, a modal above the tablet
breakpoint), and this is what stops the twelfth dialog from being hand-rolled
the old way. Deliberately narrow: a host app's dialogs are the host's
business, a pair's headless layer renders no chrome, and a `Drawer` used as
NAVIGATION is not a dialog — the shell's menus are named in the preset's
`allowNavigationDrawer` option rather than disabled inline. A rule that fired
everywhere would be switched off everywhere.
