---
"@stapel/translate-react": minor
---

The nav manifest now offers `LanguageSwitcher` as an embed: `translate.language_switcher` in the `topbar.end` slot, for every visitor, rendered with `compact: true`. A scaffold that reads `nav-manifest.json` can place the switcher in the shell's top bar without passing it through `headerExtra` by hand.

The `@stapel/core` peer floor rises to `>=0.30.0`, the release that ships the slot types this package now imports.
