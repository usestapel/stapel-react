---
"@stapel/tokens-antd": minor
---

Replace `<Space direction="vertical">` with `<Space orientation="vertical">` (antd 6's non-deprecated prop) in the `skin/permission` and `skin/confirm` footers — silences the antd 6 deprecation warning; spacing and alignment unchanged.

This is a MINOR, not a patch: `Space orientation` does not exist in antd 5 — the prop is antd 6's, and a host on antd 5 would get an unstyled vertical stack from the same code. `peerDependencies.antd` therefore moves from `>=5.20.0 <7` to `>=6.0.0 <7`: this release requires antd 6.
