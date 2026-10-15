---
"@stapel/core": minor
---

Adds the shell slot vocabulary to the navigation contract: `SHELL_SLOT_IDS` (the ten named regions a chrome may render, from `topbar.start` to `page.actions`) and the `ShellSlotId` type. Adds `NavEmbed` (with `NavEmbedSurface` and `NavBreakpoint`), the declaration a pair makes for a chrome-shaped component it can place in a slot, and an optional `embeds` field on `PackageNavManifest`, absent when a pair offers none.
