---
"@stapel/brick-react": patch
---

The console's high-score test waits for the NUMBER, not for the element that
prints it.

`brick-best` is on screen from the first frame reading "0" — the console
renders, then asks the store — so `findByTestId` had nothing to wait for, and
the `textContent` read beside it was a one-shot snapshot of whichever render
happened to have landed. The store's answer arrives in a `setBest` outside
`act`, so seeing it depended on React's scheduler beating testing-library's
single incidental task drain; on a loaded CI box it lost, and the suite failed
`expected '0' to be '1200'` often enough to cost a rerun on most trains.

Both asserts now wait for the exact value, and the store double answers off a
task of its own the way the real one does (`createHighScoreStore` reads
through core's `createRepository`, whose `get` awaits a storage backend) — so
the first paint's "0" is observable on a fast machine too, and the race cannot
hide there again. Test-only; no behaviour change.
