---
"@stapel/tokens": minor
"@stapel/tokens-antd": minor
---

Control SHAPE becomes a host token axis, read live like every colour role.

Mechanism decision (checked against the schema first, per §68 "one
dictionary"): the radius and type axes ALREADY exist — the generator emits
`--stapel-radius-*` and `--stapel-font-size-*` from `scales`, and the bridge
roles (`bridgeRadiusRole`/`bridgeFontSizeRole` = `md`) already name which
step antd's seeds map to — so NO `--stapel-control-radius` /
`--stapel-control-font-size` twins were minted: `toAntdTheme` now reads the
existing `--stapel-radius-md` / `--stapel-font-size-md` LIVE off the
document (fallback: the compiled-in 8 / 16, exactly as before). Control
HEIGHT had no axis at all, so the dictionary grew one instead of the bridge
inventing a private name: `@stapel/tokens` adds `scales.controls`
(`height: 32`, `height-phone: 44`) to `theme.default.json`, the generator
emits `--stapel-control-height` / `--stapel-control-height-phone` beside the
other scales (tokens.ts exports `controls` + `ControlAxisName`; manifest
lists the scale), and a host overrides control height the same way it
overrides its brand — edit `stapel.theme.json`, regenerate.

`@stapel/tokens-antd`: `toAntdTheme` sets `controlHeight` from the live
`--stapel-control-height` (default 32 — antd's own seed, so an un-themed
host renders byte-identically); `SkinTheme`'s phone touch floor reads
`--stapel-control-height-phone` live (new export `livePhoneControlHeight`;
`phoneTouchFloorCss` gains an optional height argument;
`PHONE_CONTROL_HEIGHT` stays exported at the dictionary's 44 default). The
live reads follow the existing mode-match discipline (`readLiveCssVar`):
absent property, no DOM, or a document in the other mode → today's exact
values.
