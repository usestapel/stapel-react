---
"@stapel/tokens-antd": patch
---

`SkinNumberField` can state its bound on the element: `min`, `max`, `pattern`
and `list` are forwarded to the input. Stated, never enforced — the control is
a text box with a keypad, never `type="number"`, so nothing is clamped and the
caller's validation stays the only judge. A bound that lives only in prose is a
bound nothing can read: a deployed year field answered `min: null, max: null,
list: null` while the page beside it printed the range in words.
