---
"@stapel/search-react": patch
---

Every `/default` surface is drawn, seeded and photographed.

The skin shipped in the last release with one demo out of twelve names: the pair could
be read in source and not LOOKED at, which is the state §54's gate exists to end. All
twelve are covered now, and covered in the state each one is named for.

- **Eleven new skin demos** — the results pane (found / phone / a search that ran and
  matched nothing), the filter panel (open, and narrowed by a shared link so every
  constraint's door-out is visible), the ranking disclosure, the result card (promoted
  with a photo, and plain), the query box, the sort gate (blocked and open), the page-size
  ladder, the language filter, the numeric range row, the degradation notice (banner and
  inline) and the unreadable-link notice. Each imports from `src/default`, each has a
  `viewport: "phone"` variant, each variant declares the `step` it is seeded at.
- **Demos are SEEDED, not fetched** (`DemoSeed` in the demo harness): the answer is written
  into the query cache under the key the pair's own codec derives, so a variant opens in its
  state on the first frame instead of photographing the same skeleton under three names.
  `assertVariantsRenderDistinctly` is wired into the demo suite and enforces it.
- **Dedicated suites** for `useSearchBox` (debounce, one history entry per word, the URL
  winning whenever it moves on its own, the `MAX_QUERY_CHARS` cap), `useSuggest` (the
  three-character floor, the clamped limit, a refusal that leaves the box typeable, a menu
  that stays shut on an empty answer) and the range model (which slugs get a row, what the
  row refuses, and that the reason stands beside the button).
- **A render matrix per surface** — each of the four surfaces in phone and desktop, light
  and dark, asserting the mode is the DOCUMENT's rather than a default baked into the skin,
  plus the filter surface following the viewport. `setViewport` / `setDocumentTheme` are the
  test harness helpers the setup file has been pointing at.

No public API change: `src/` is untouched. The demo registry, manifest and `llms.txt` are
regenerated.
