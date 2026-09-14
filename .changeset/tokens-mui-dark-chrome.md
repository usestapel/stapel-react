---
"@stapel/tokens-mui": patch
---

Dark theme via `@stapel/tokens`: `palette.divider` (from `border`) is lighter, 3:1 and above on every surface, and `palette.text.disabled` (from `text-subtle`) clears AA on `background.paper`. No code change in the bridge; the values flow from the token source.
