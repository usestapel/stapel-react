---
"@stapel/search-react": patch
---

The location line's label outranks antd instead of tying it.

`LocationSummaryLine`'s label span sets `text-overflow` and `white-space` at
(0,1,0), and the span lives inside an antd `Button` — whose per-theme class
carries that same ladder and is injected into `<head>` at runtime, so an equal
specificity loses on order. antd 6 styles `> span` only inside `Button.Group`,
so nothing contests it today.

Doubled anyway. "Nothing contests it today" is what shipped the card type
scale and two gallery counters inert in this same wave, and a doubled selector
is behaviour-identical where there is no competitor. Found by
`stapel/no-inert-typography-override`.
