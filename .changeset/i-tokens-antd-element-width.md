---
"@stapel/tokens-antd": patch
---

The two additive items the account-group builders filed against the substrate.

- **`useElementWidth(ref, { thresholds })` is exported from `@stapel/tokens-antd/skin`** — the fleet's one element-width measurement. Five packages wrote their own this wave (`billing-react/src/default/elementWidth.ts`, `calendar-react/src/default/useElementWidth.ts`, `docs-react/src/default/useSplitLayout.ts`, `geo-react`'s `TileMap`, `gdpr-react/src/default/DataTable.tsx`), each with its own answer to what a zero width means and what an unmeasured box means. Both are stated once here: zero is not a measurement (a `display:none` box must not stick to its narrow arm), and unmeasured is `undefined` — `width` and every named threshold — so a caller states its own seed (`below.cards ?? phone`) instead of inheriting somebody else's guess. `DataTable` and `Pane` now read it, and `Pane`'s gutter step follows the pane's OWN width rather than the viewport: a 360px column on a desktop gets the tight gutter.
- **`ErrorAlert`'s actions stack under the message in a narrow box (VC-B6).** antd puts `action` in a column beside the message; below `ACTION_STACK_BELOW` (the `narrow` measure, 576px) of ELEMENT width the retry moves under the message and detail instead, so the sentence keeps the full width of the alert. Measured in Chromium: the message column in a 390px box goes from the squeezed ~110px to 300px, while a 900px box keeps the action column. The alert is wrapped in a measured `<div data-stapel-error-actions="inline|stacked">`; `data-stapel-error="block"` stays on the alert itself.

Additive: every existing export keeps its signature.
