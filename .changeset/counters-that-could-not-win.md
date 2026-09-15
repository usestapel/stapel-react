---
"@stapel/listings-react": patch
---

The gallery counters and the condensed title outrank antd instead of tying it.

`stapel/no-inert-typography-override` found the detail gallery's counter still
carrying the defect 0.36.1 fixed one component over:
`.stapel-listings-detail-count` is a single class at (0,1,0) and the class
lands on an antd `Typography.Text`, which carries a per-theme class injected
into `<head>` at runtime — second, so it wins the tie. The counter's
`font-size` and `line-height` were inert, and so was its white colour: the
text on a 55% black photo scrim was whatever antd's Typography says, not the
white the scrim was designed for.

The card gallery's identical counter and the condensed bar's title are doubled
too. Both are plain spans today, so nothing contests them — but the cost of a
doubled selector where there is no competitor is zero, and "it is still a
span" is not a property worth depending on when the same defect has now
shipped three times in this package.
