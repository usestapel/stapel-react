---
"@stapel/tokens-antd": patch
---

A chip is named by its label, never by its storage code.

`ChoiceChipOption` gains `ariaLabel`. A chip's accessible name normally comes
from its own content — but the chip carrying the field's `id` MUST state one
explicitly (a `<label htmlFor>` beats content in the accname computation, so
without it the first answer is announced as the question), and a label that is
a ReactNode has no string form this bridge is entitled to invent. It fell
through to `option.value`, so a caller wrapping its labels in a `<span>` (a
44px tap target, an icon) had every id-carrying chip read out as its storage
code: "b-u" where the screen said "Estate".

The caller states it now — it is the only party holding both the node and the
words that went into it — and a stated `ariaLabel` reaches EVERY chip, not
only the first: a name that is correct only in position 0 is a defect waiting
for a reorder. A plain-text chip that states nothing is unchanged, and the
`option.value` fallback survives for the id-carrying chip nobody named, which
is the honest bottom rather than a silent blank.
