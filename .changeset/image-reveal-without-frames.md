---
"@stapel/image": patch
---

A loaded image is never invisible for want of a frame callback.

`<Image>` rendered the decoded `<img>` at `opacity: 0` and flipped it to 1
inside a `requestAnimationFrame` callback — one frame at zero, so the blur-up →
sharp transition has something to transition from. That reasoning holds only in
a tab somebody is looking at. A browser **suspends rAF in a backgrounded or
occluded tab**, so the callback never ran, and every image on the page sat at
`opacity: 0`: fetched, decoded, correct, invisible. It healed the instant the
tab was focused, which is what made it expensive — it is not reproducible while
you are watching, and it is the ONLY state a prerender, link preview,
thumbnailer or screenshot runner ever sees. It cost two agents a wrong
conclusion in one night ("photos do not load") before it was caught.

The fade is now an enhancement instead of a gate. The reveal has three states —
`pending` (the one frame at zero a CSS transition needs), `fade`, and `instant`
— and it reaches a visible one by three routes: the frame callback (a live tab,
unchanged: 200ms opacity transition after one painted frame at zero), an
immediate flip when there is no frame loop to ride at all (`document.hidden`,
or no `requestAnimationFrame`), and a 100ms timer for the frame that never
comes — a tab backgrounded between the paint and the next frame, a throttled
headless runner. A reveal that did not come from a frame callback also drops
the transition, so a runner that never paints cannot capture a half-faded
image.

`useImageSlot` carried the same defect on its `settleMs: 0` path: the
ResizeObserver burst was coalesced with `requestAnimationFrame`, so in a hidden
tab no size was ever committed, no variant was ever chosen and nothing rendered
at all. It coalesces on a zero-delay timer now — same collapse of the burst, no
dependency on a frame.
