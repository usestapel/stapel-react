---
"@stapel/tokens-mui": patch
---

Via `@stapel/tokens`: dark `palette.divider` (from `border`) is lighter, 3:1 and above on every surface, and `palette.text.disabled` (from `text-subtle`) clears AA on `background.paper` in both modes (light is one step darker). No code change in the bridge; the values flow from the token source.
