---
"@stapel/search-react": patch
---

`<PartitionChips variant="segmented">` renders the control it declares.

The row carried `data-variant="segmented"` and `role="radiogroup"`, and inside it the walker counted `.ant-segmented` **0** and `input[type=radio]` **0** over plain `ant-btn` cells — on both axes of two categories (D304). The ARIA was real (`role="radio"`, `aria-checked`, a roving tabindex, arrow keys), but the control named in the DOM did not exist, and ~30 lines of this file re-decided joined-row geometry the design system already owns.

The segmented arm is antd's `Segmented` now: `.ant-segmented`, one real `input[type=radio]` per cell under a shared `name`, and with it the browser's own single Tab stop and arrow keys. The declaration is unchanged (`data-variant="segmented"`, `role="radiogroup"`, the group's `aria-label` still the axis's own name) and so is the contract — `value: string | null`, `onChange` reporting `null` for the parent, controlled, nothing kept here.

What moves for anything reading the DOM: the chosen cell is the radio's **`checked`** rather than `aria-checked` on a button (`aria-checked` is how a button fakes what a radio has), and it carries `.ant-segmented-item-selected`. The per-cell test ids (`partition-chip-<path>`, `partition-chip-all`) stay where they were, on the cell's own label, now with `data-checked` beside them so a probe reading a snapshot still has the chosen cell without asking the accessibility tree. A keydown belongs to the cell's input.

The `chips` variant — the phone's wrapping pill row — is untouched: same buttons, same `role="radio"`, same `aria-checked`, same roving tabindex.

Ceiling raised 31 -> 31.25 KB. Measured with dependencies held constant, this package's src before and after: 30.95 -> 31.05 KB.
