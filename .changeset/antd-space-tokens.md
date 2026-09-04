---
"@stapel/tokens-antd": patch
---

Replace `<Space direction="vertical">` with `<Space orientation="vertical">` (antd 6's non-deprecated prop) in the `skin/permission` and `skin/confirm` footers — silences the antd 6 deprecation warning; spacing and alignment unchanged.
