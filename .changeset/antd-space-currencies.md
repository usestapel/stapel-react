---
"@stapel/currencies-react": patch
---

Replace `<Space direction="vertical">` with `<Space orientation="vertical">` (antd 6's non-deprecated prop) in `Price` and `CurrencyField` — silences the antd 6 deprecation warning on every listing page; spacing and alignment unchanged.
