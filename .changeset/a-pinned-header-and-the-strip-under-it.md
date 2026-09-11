---
"@stapel/shell-react": minor
---

The storefront header is pinned by default, and a strip of the host's chips can
ride under it once the page has moved.

Two rows of the closing-wave comparison inventory, both on `<PublicShell/>`.

**`headerSticky` now defaults to `true`.** It used to default to "sticky in
`phoneChrome="dock"` and nowhere else", which was an inconsistency inside one
app before it was a gap against anything else: the same storefront pinned on a
phone and `static` on a desktop. Measured against the reference classified
(§24, Surface 3, ranked first), whose header is pinned on both — and the
consequence is not cosmetic, because on this chrome the header IS the search
field. A desktop header that scrolls away turns "search again" into "scroll
back to the top first" from anywhere down a feed, and the only way a host could
settle that was a sheet rule over `[data-testid="public-shell-header"]`, i.e. a
geometry decision taken outside the component that owns the geometry. Default
skins are the product (§83).

Nothing moves when it pins: `position: sticky` leaves the box in flow, so the
header still occupies the row it occupied — which is what makes this a default
change rather than a layout change, and it is asserted rather than asserted
about (the pinned header is measured against the unpinned one, and
`--stapel-header-height` is still published from the same two rungs). `false`,
`"desktop"` and `"phone"` are all unchanged for a host that named a side.

**`scrolledChipRow` — the strip under the header.** The reference's phone home
keeps a horizontal category row pinned under its search bar from the moment a
reader scrolls; ours had none. On a storefront whose phone chrome is one row
that is not decoration: the browse bar lives in a drawer or in the dock, so a
thumb halfway down a feed had no way to change category without scrolling back
to the top first — exactly the move a pinned header exists to spare it.

A SLOT, because which chips and where they lead is product knowledge, the same
rule `categorySlot` follows one bar up. What the shell owns is when the row is
on screen and where it sits:

- WHEN: the same scroll fact `headerScrollFlag` publishes, from the same single
  `IntersectionObserver` sentinel — never a `scroll` listener, which runs on
  every frame of a feed of photographs. Passing the slot turns that observer on
  by itself, with the two-edge default thresholds, so a rubber-band at the top
  of the page cannot make the strip flicker; a host that named its own edges
  keeps them for both readers, because there is one fact here and two sets of
  thresholds would be two answers to "has the page moved".
- WHERE: below the header and never inside it — a strip in the header would
  make the published `--stapel-header-height` a lie, and two pairs pin against
  that number — pinned under it wherever the shell publishes a height, through
  the same two cascade rungs that declare one (D449's order, unchanged).

It collapses rather than unmounting: a grid row from `0fr` to the content's own
height, which is how a collapse animates to a height nobody measured, 160ms,
and none at all under `prefers-reduced-motion: reduce`. A collapsed strip is
`visibility: hidden`, so it is out of the tab order and off a screen reader
instead of being focusable content at zero height. And it is drawn for COARSE
pointers only — a desk already carries the same destinations in the browse bar,
permanently, and a second row of them appearing on scroll is chrome competing
with chrome; the rule is `@media (pointer: fine)` rather than a width test,
because the device this is for is a thumb and a 1280px tablet is one.

`PUBLIC_CHIPS_CLASS` is exported beside the other geometry constants, for a
host writing a rule of its own against the strip.

Size, measured on a clean dist with dependencies held constant: `default`
8.96 → 9.15 KB against a 12 KB ceiling; `index` and `theme` unmoved. No ceiling
raised.
