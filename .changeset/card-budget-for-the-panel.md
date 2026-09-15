---
"@stapel/listings-react": patch
---

Raise the skin bundle's budget 36 -> 37.5 KB, measured at 36.15.

What the bytes bought: `<ListingSerpCard trustPanel>` — the 220px column the
reference fills its 980px results row with, a component this card did not have
in any form — and the detail strip committing a swipe through `swipeStep`
rather than native scroll-snap, which could express neither half of the
owner's rule. The two gallery counters and the condensed title also doubled
their selectors, which is what stopped the detail counter's size, line-height
and white colour being inert over a black photo scrim.

Measured rather than assumed: the SAME source builds to 35.44 KB against the
siblings pinned before this train and 36.15 KB against the ones it bumped, so
about 710 B of the growth is not this package's source at all — larger than
the 152 B overage itself. 37.5 leaves 1.35 KB, the headroom the previous raise
left; 37 would have left 850 B, which is the rounding this entry has warned
about seven times.
