---
"@stapel/tokens-antd": patch
---

The skin repaints when the host brand attribute changes.

`@stapel/tokens`' generated `tokens.css` keys on two attributes of `<html>` —
`data-theme` picks the side, `data-brand` picks the scoped ramp
(`:root[data-brand="…"]`) — and both move the same live `--stapel-<role>`
values `SkinTheme` builds antd's token bag from. `SkinTheme` subscribed to the
first and not the second, so a host that resolves its brand at runtime (a site
provider stamping `data-brand` in an effect, i.e. after the render that already
built the theme) got antd controls — primary buttons, focus rings, links —
frozen in the brand the page booted with, until something unrelated re-rendered.

`SkinTheme` now follows both attributes, and the theme cache is keyed on the
brand scope as well as on the live brand value (two scoped ramps may share a
`--stapel-brand` and differ in every other role). New exports for a consumer
that caches anything built from the live custom properties: `BRAND_ATTRIBUTE`
and `hostBrandScope()` from the root, `useHostBrand()` and
`subscribeHostBrand()` from `/skin`. One MutationObserver now serves the whole
document for both attributes, dispatching per attribute, instead of one per
mounted skin.

Hosts carrying a private `data-brand` observer to force the repaint can drop it.
