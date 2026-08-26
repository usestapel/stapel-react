---
"@stapel/tokens-antd": patch
---

**A dialog is now themed where it is PAINTED.** `SkinDialog` and `SkinConfirm` carry the skin theme into their own portal, so a dialog no longer depends on the caller having wrapped it.

A dialog portals to `<body>`, so the `ConfigProvider` it paints under is the one above the `<SkinDialog>` ELEMENT — beside the trigger — not the one wrapping the screen's panel. Every pair that did not wrap the dialog itself shipped a dialog on antd's default LIGHT algorithm over a dark app: the third visual pass found it in calendar, docs and chat, and its first reading ("three sheet implementations, one of them theme-aware") was wrong — all three already rendered through `SkinDialog`; only the wrapper differed.

- `SkinDialog` renders `SkinTheme surface="bare"` around the antd component (so the PANEL, its header, its close button and its footer are on the right algorithm — not only the body) and again inside the portal, where it stamps `data-stapel-skin-mode` on the painted content.
- The mode is the nearest enclosing `SkinTheme`'s, and the live document mode when there is none — the same order `SkinTheme` itself uses, so a screen that pins `mode="dark"` keeps the pin through the portal.
- A caller that already wraps its dialogs keeps working and pays nothing: `AppliedThemeContext` makes the nested wrapper a plain `<div>` with no second provider. The outer wrapper is `display: contents`, so it adds no box to the row the trigger sits in.
- The sheet's grab handle reads `colorFillSecondary` from inside the sheet, so the chrome is painted from the panel's own tokens.
- No `stapel/dialog-needs-theme` lint rule: a rule could only ask the next pair to write by hand what the substrate now writes for it, and it could not see the case that actually shipped — a `SkinTheme` that is in the file but does not enclose the dialog element. Recorded in `no-bare-dialog`'s docblock.

Internal: the viewport rule (`useDialogSurface`, `MODAL_MEDIA_QUERY`) moved to `skin/dialogSurface.ts`, since `SkinTheme` and `SkinDialog` now both read it. Both are re-exported unchanged from `@stapel/tokens-antd/skin`.
