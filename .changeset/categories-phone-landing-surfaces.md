---
"@stapel/categories-react": minor
---

**The catalogue gets its phone shape: a two-row tile grid that scrolls sideways, and the category landing's quick-search panel.** `<CategoryTileGrid>` and `<CategoryQuickSearchPanel>`, both on `/default`. `<CategoryCarouselStrip>` is untouched — the desktop row stays exactly what it was.

**`<CategoryTileGrid>`** is the landing row a phone actually wants: rounded `surface-sunken` tiles in two rows, the label top-left over at most two lines, the art pinned bottom-right, and the third column peeking in so the row says it scrolls without a scrollbar, an arrow or a hint line. It leads with an "All" tile linking `basePath` (default `/c`, the same convention the carousel bag already uses), and `allTile={false}` drops it for a row that is already inside a category.

It is a second surface rather than a `layout` prop on the strip. The strip is a WRAPPING row of cards; this is a fixed grid with a scroll port, a different reading order and a tile whose two corners are doing different jobs. One component with a mode switch would have been one component nobody could photograph either arm of — and the two share the thing worth sharing, the headless `<CategoryCarousel>` bag, so both rows are the same categories in the same order.

**Every length is a fraction of the CONTAINER.** The column is `100% / 2.5` of the scroll port minus a gap; the tile's height comes from its aspect ratio. A tile sized in viewport pixels is the wrong size inside every sheet, panel and column that is not the whole screen, and this row is mounted inside all three.

**The image seam is the strip's seam, plus the arm it was missing.** `carousel_icon` / `catalog_icon` are opaque strings the backend deliberately does not resolve, so this skin still builds no URL and renders no `<img>`: it hands the reference to the host through the same `renderIcon(reference, entry)` contract, and a storefront wires its CDN resolver once for both surfaces. What is new is the ABSENCE arm. On the strip, no resolver means a text tile, which is fine for a row of cards; on a tile whose art corner is half its area it reads as a tile that failed to load. So an unresolved reference — no resolver, or a row that carries none — draws a muted placeholder glyph. Never a guessed path, and therefore never a broken image on a deployment that guessed differently.

**`<CategoryQuickSearchPanel>`** is the brand-tinted block a category landing puts under its tiles: a heading, one or two field slots, and a full-width button whose label carries the live result count.

**It knows nothing about search, on purpose.** A category package that imported a search package to draw two selects would put the search client in every host of the catalogue and would decide, for every deployment, which facets a category asks about. Neither is this package's call. So the fields are a slot (`fields`) and the count is a value (`count`), both from the container that owns both halves. `count` is core's `LoadState`, and its ready value is field-for-field what `@stapel/search-react`'s new `useSearchCount()` returns — deliberately the same names, so the two connect with no adapter and no import edge between the packages.

**Only a ready, countable answer earns a number.** Loading, refused, and a ready count the engine declined to give a number for all render the plain "Show listings" — a button that guesses at a total, or that prints "0" because a count was `null`, is exactly the defect the count contract exists to prevent, and a person can press "Show listings" perfectly well without knowing the number first. A LOWER BOUND gets its own sentence ("Show 500+ listings"), because a floor rendered as a total is the same lie in a shorter form.

New keys in en/ru/es: `categories.tiles.all`, `categories.quick_search.cta`, and the two plural families `categories.quick_search.cta_count` / `…cta_count_at_least` (four forms in ru, two in en/es, as `Intl.PluralRules` says).
