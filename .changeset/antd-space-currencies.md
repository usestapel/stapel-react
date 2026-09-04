---
"@stapel/currencies-react": minor
---

Replace `<Space direction="vertical">` with `<Space orientation="vertical">` (antd 6's non-deprecated prop) in `Price` and `CurrencyField` — silences the antd 6 deprecation warning on every listing page; spacing and alignment unchanged.

This is a MINOR, not a patch: `Space orientation` does not exist in antd 5 — the prop is antd 6's, and a host on antd 5 would get an unstyled vertical stack from the same code. `peerDependencies.antd` therefore moves from `>=5.20.0 <7` to `>=6.0.0 <7`: this release requires antd 6.
