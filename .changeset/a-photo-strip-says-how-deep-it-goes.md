---
"@stapel/listings-react": patch
---

A card's photo strip says how many photographs there are.

The mobile walk drove a real touch swipe across a feed card and watched the
indicator move correctly — `data-active` hopping from the first dot to the
second, the strip settling where the finger left it — and then recorded what
was missing beside it: **no counter of any kind**, where the reference
classified leads with "1 of 16".

Dots say WHERE in a strip a reader is and stop being countable at about five.
Only a number says how deep it goes, and on a phone — where the strip is one
photograph wide and the next one is off-screen — that number is the only thing
saying a swipe is worth making. `<ListingPhotoStrip>` (the strip every card
surface in this pair draws, `<ListingSerpCard>` included) now carries one:
`<testId>-counter`, bottom-trailing so it never argues with the dots'
bottom-centre, moving with a swipe, a hover scrub and a native scroll alike
because it reads the same `active` the dots do.

`aria-live="polite"`: a finger scrolling the strip changes the picture with
nothing else to report it. `pointer-events: none`, which is load-bearing rather
than tidy — the box under it owns the scrub and the swipe, and a pill that
swallowed a pointer would make one corner of every photograph dead to both. A
one-photograph strip gets no counter, exactly as it gets no dots and no peek.

The pill's scrim is a fixed translucent black with white text, and it is the
one place in this package where a theme role would be wrong: it sits on an
arbitrary PHOTOGRAPH, which is neither light nor dark.
