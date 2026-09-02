---
"@stapel/tokens-antd": patch
---

`SkinNumberField` and `CountedInput` accept `ariaRequired` — the one
accessibility attribute a required field owes its own control, stated as part
of the contract instead of left to a caller's effect poking the rendered
input. Absent by default; nothing else changes.
