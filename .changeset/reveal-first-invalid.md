---
"@stapel/core": minor
"@stapel/listings-react": patch
---

`@stapel/core/reveal`: a refused field is reached, not only named. `revealField` opens the section it is folded in, scrolls its row clear of sticky and fixed bars (measured at the scrollport's edges), focuses the control (the row when the control is switched off; a searchable select's keyboard held back on touch) and announces label and error through a polite live region. `revealFirstInvalid` finds the first refused field by `aria-invalid` or a row selector. listings-react's "show the first missing field" goes through it.
