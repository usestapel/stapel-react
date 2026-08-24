---
"@stapel/image": patch
---

An image no longer disappears when its caller re-renders while it loads.

The load effect was keyed on the chosen variant OBJECT. `meta` is a value the
host builds — `resolveImage: (ref) => ({ … })`, called in render, is the
documented shape — so it had a new identity on every render, the effect
restarted, and its cleanup cancelled the `decode()` already in flight. On any
screen that re-renders while a photo loads (a listing page settling four
queries) every attempt was cancelled by the next and nothing was ever
committed: no image, no error box, an empty slot indefinitely. The load is now
keyed on the variant URL, which is what the browser is actually fetching.

Second fix in the same effect: the upgrade-only guard compared variant AREAS,
and a resolver that honestly reports `width: null` on every variant made both
sides `0`, so `0 <= 0` refused every upgrade for the component's whole life.
Areas are now compared only when both are known.
