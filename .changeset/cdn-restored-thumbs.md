---
"@stapel/cdn-react": patch
---

Fix: a reopened draft's photos painted as empty frames. `useUploadQueue`
seeded a restored item (`initialRefs`) with `row: null` and never resolved
it, so `CdnThumbnail` had nothing to draw — count, order, removal and the
publish gate were all correct, only the picture was missing.

Restored items now resolve their row through the same owner-scoped
`file/exists/` read `useCdnRef` wraps, sharing its cache (a hash already
resolved elsewhere on the page, or by a sibling restored item, is never
asked for twice) and batched per queue via `useQueries`. `CdnThumbnail`
gained `resolving`/`broken` states: a skeleton while the lookup is in
flight, a broken-image glyph once it settles on nothing, and the real
thumbnail once the row arrives — the same paint a fresh upload gets.
