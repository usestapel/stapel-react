---
"@stapel/shell-react": patch
---

shell: `--stapel-header-height` is 64px on a desktop again, whatever chrome the phone wears (D449)

Measured on the stand at 1440 and at 1280: the property resolved to **56px**
while the header box was **64px**. Both pinned things on the page read it, so
`search-results-toolbar` and the desktop filter rail pinned at `top: 56px` and
scrolled **8px under the header** — `hiddenPx: 8` on `/s` and on `/c`, both
widths, in a storefront running `phoneChrome="dock"`.

The arithmetic was never wrong; the cascade was. A media query adds no
specificity, so `.stapel-public-shell[data-phone-chrome="dock"]` (0,2,0) beat
`.stapel-public-shell` (0,1,0) inside `@media (min-width:1200px)` at *every*
width — the desktop rung was unreachable on any page that asked for the dock.

`publicShellCss()` now writes the dock arm as
`.stapel-public-shell:where([data-phone-chrome="dock"])`. `:where()` weighs
nothing, so both rungs are (0,1,0) and ORDER decides: the desktop arm is
declared last and applies above the breakpoint on `dock` and `drawer` alike. No
`!important`, no restated selector, and the phone rung is untouched below the
edge.

The order is now load-bearing, so `headerGeometry.test.tsx` holds it directly —
the two rules' selectors, their weight with `:where()` contents removed, and
which of them the sheet declares last. jsdom resolves neither media queries nor
custom properties, so a computed `getPropertyValue` there would have read `""`
at both widths and passed on the sheet that shipped this.

A host that restated 56/64 in its own sheet to work around this can delete it.
