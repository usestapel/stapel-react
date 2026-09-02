---
"@stapel/attributes-react": patch
---

An `int` never grows a decimal tail. `formatFeatureValue` applied the
config's `precision` to the plain branch of an integer, so a category that
shipped `precision: 1` on a year printed "2024.0" on the detail page — a
value the engine's own `format_value` would never write (its plain branch is
`str(value)`; `precision` exists for the `postfix1000` scaled branch alone).
The scaled branch also inherits the engine's default precision of 1, so
1500 g reads "1.5 kg" rather than a rounded-up "2 kg". Floats keep their
configured decimals — that is their contract.
