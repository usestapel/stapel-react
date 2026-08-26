---
"@stapel/forms-react": patch
---

Fix the six blank showcase stories and the two that photographed the wrong state.

The demo harness seeded the query cache and then let the seeded read go stale
immediately, so every skin screen refetched on mount against a canned `fetch`
whose unmatched-path answer was an empty `200 {}`. That empty body landed on
top of the fixture: `forms-list`, `responses` and `public-form` threw on it and
rendered nothing at all, while `form-builder` and `form-settings` quietly
collapsed both of their variants onto the same unconfigured screen. The seeded
read is now authoritative, each skin demo's handlers answer the SAME data its
seed holds, and an unmatched path is a loud 404 instead of a silent empty body.

The variant-distinctness guard now runs against a jsdom renderer as well as the
server one, and a new async check re-asserts every variant is still on screen
and still its own picture *after* the network settles — the failure a static
render cannot see, and the one that shipped these blank shots.

Also: the five `state.step` chip-dump demos are gone (the shipped skin screens
already cover the same six headless components, and one of the chip dumps was
the package's only 390px overflow); the builder's lifecycle selector has its
own visible label instead of borrowing the list's "Filter by state"; the forms
list's state filter says "All" instead of the responses screen's "All
versions"; and the retention hint no longer shouts in en/ru/es.

The two new labels land in the en fallback bundle that rides in `dist/index.js`,
so its size budget moves 12 KB → 13 KB (measured 12.04 KB).
