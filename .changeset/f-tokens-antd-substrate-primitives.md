---
"@stapel/tokens-antd": minor
---

The third visual pass traced its remaining defect classes to the substrate; this release closes them where they were traced.

- **A nested bare `SkinTheme` inherits the pin above it.** `mode` resolves `props.mode ?? inherited.mode ?? liveMode`: a demo pinning `mode="dark"` around a self-wrapping surface no longer renders that surface light (search: 16 of 29 dark shots; reviews' sign-in door; geo's `--dark` guard).
- **The phone touch floor reaches every control.** `PHONE_TOUCH_FLOOR` raises `controlHeightSM` to 44 as well, puts `Rate` stars on a 44px pitch and checkbox/radio boxes at 24px; `phoneTouchFloorCss` (hoisted once, scoped under `[data-stapel-skin-phone]`) gives rate stars, checkbox/radio rows, clickable tags and list/menu rows a 44px hit area.
- **Status surfaces from the `*-bg` / `*-border` roles.** `toAntdTheme` maps `colorSuccessBg`, `colorWarningBg`, `colorErrorBg`, `colorInfoBg` and their borders/hovers from the token JSON instead of antd's palette derivation — the khaki warning and sage success are gone. `colorPrimaryBg`/`Hover`/`Active` come from `brand-subtle`/`brand-hover`/`brand-active`.
- **Dark primaries readable.** `colorTextLightSolid` is the `text-on-accent` role (near-black in dark), so a primary button's label holds AA on the lavender dark fill; `Tooltip` keeps a light label in both modes. Tested with a WCAG contrast assertion.
- **The sheet fits its content up to 90dvh**, body scrolls, footer pinned (`sheetSizingCss`, `SHEET_MAX_HEIGHT`) — no more 378px sheet clipping mid-sentence with the primary below the fold.
- **New primitives:** `Pane` / `Page` (the measure and padding scale; `PANE_MEASURES`), `StatusTag` (one treatment per status family), `RowActions` (wrap between buttons, never inside a word; overflow into a sheet on a phone), `PaneGate` (one refusal per pane; pools identical per-control reasons through `GateReasonScopeContext`), `ListRow` / `CardHeader` (`min-width: 0`, wrap not truncate, badge and actions slots), `DataTable` (table or cards by element width).

Additive: every existing export keeps its signature. Peer `@stapel/core >=0.18.1` for the `more` / `actions` floor keys `RowActions` reads.
