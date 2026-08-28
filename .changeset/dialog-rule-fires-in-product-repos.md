---
"@stapel/eslint-plugin": minor
---

`stapel/no-bare-dialog` fires where a team's dialogs are actually written.

The rule returned an empty visitor for any file outside a package's
`src/default/**` tree, so it was inert in exactly the repos that need it: a
file at `src/__gatecheck.tsx` in a product repo, containing a bare antd
`<Modal>`, linted clean. The §83 doctrine — on mobile every dialog is a bottom
sheet, modals are tablet-and-up — was therefore enforced only where the
libraries live and already comply, and never where a product team writes its
own dialogs. The owner has reported the mobile experience twice; a green gate
that cannot fire reads as coverage of a doctrine nobody was enforcing.

- **New `scope` option.** `"all"` (the default) reads every file; `"default-skin"`
  is the pre-0.12.0 behaviour, `src/default/**` only, for a consumer that wants
  the wall on the skins and nothing outside them.
- **Severity, not scope, is what keeps it adoptable.** `recommended` arms the
  rule fleet-wide at `warn` and keeps `src/default/**` at `error` — a worklist
  outside the skins, the same shape the doctrine tier shipped in, so upgrading
  the plugin hands a repo its list rather than a wall. `strict` makes the whole
  surface an error: that is what a product repo arms to make the doctrine a
  gate.
- **The exemptions are stated now, not implied by a directory shape.**
  `allowNavigationDrawer` (a shell's menu drawer is navigation, not a dialog)
  is unchanged; test and fixture paths are carved out in the rule itself, so a
  consumer who never spreads the preset agrees with it; and
  `@stapel/tokens-antd/skin` — the substrate that BUILDS `SkinDialog` out of
  antd's `Modal` and `Drawer` — is carved out by path in both presets, the same
  way `no-raw-fetch` is carved out in the api layer.

The rule also stops carrying its own copy of the default-skin path test and
uses `lib/jsx.js`'s `isDefaultSkin`, like its seven sibling skin-tier rules.
