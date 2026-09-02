---
"@stapel/search-react": minor
---

The desktop filter rail redesigned around what the walker measured on a live
classified deployment's cars leaf at 1440×900: the 280px rail carried 5717px
of content — 40 facet groups, 118 checkboxes, 66 fields — as one flat column
inside an invisible inner scroll whose tail was physically unreachable, with
the engineering phrase "not counted" printed 100+ times down the default view.

- **Facet groups are disclosures.** `<FacetGroupControl>` gains
  `collapsible?: boolean` and `defaultOpen?: boolean` (both default to
  today's always-open group, so no existing host changes): the label becomes
  a real `<button aria-expanded>` with a chevron and the count of the
  group's CHOSEN values; closed, the options are not in the DOM at all — a
  hundred hidden checkboxes are still a hundred stops for a screen reader.
- **Which groups open is the answer's own evidence.** In `<FacetPanelPane>`
  — rail AND sheet, a six-screen sheet being the same disease — a group with
  any chosen value is always open; otherwise the top `FACET_OPEN_GROUPS`
  (5) counted groups by coverage open, ranked by the new
  `facetCoverage` (exported from the facet model; the chip row now sorts
  its counted band by the same function instead of its own copy). Everything
  else starts as a header, one click from whole. The three group shapes
  (segmented / nested / checkbox) are untouched inside an open group.
- **Uncounted options are the fold's tail.** Options with `count: null` and
  nothing chosen sort after every counted one and live behind the existing
  "Show all (N)" fold — still reachable, still labelled honestly, no longer
  the group's face. A schema-only group (ALL options uncounted) keeps its
  options visible as before, and chosen options are always visible.
- **Search within the filters.** From `FACET_SEARCH_THRESHOLD` (6) groups
  up, an `allowClear` input above the groups narrows them client-side by
  group or option label, case-insensitively; matches render open, a miss
  says so in the panel's empty-state idiom. Presentation only — the URL
  never hears about the query. New keys `search.facets.search` /
  `search.facets.search_empty` (en/ru/es).
- **The rail's scroll is visible and its floor answers back.** The RAIL
  style gains `scrollbarWidth: "thin"` + `scrollbarGutter: "stable"` — on
  overlay-scrollbar platforms an invisible inner scroll is indistinguishable
  from a rail that ends at the fold. `<FacetPanelPane>` gains
  `footerBar?: boolean` (default `false`; `<SearchPage>` turns it on for the
  column layout only): a sticky bar on the theme's container ground with a
  `colorSplit` hairline, stating the live result count as strong text (new
  plural family `search.facets.match_count`, "N listings match", full
  one/few/many/other forms in ru) with the clear-all control beside it when
  filters are active. Desktop filters apply instantly — the bar is feedback
  plus the way out, not an apply button, which is why the phone sheet (which
  has its own apply footer) never draws it.
- **Denser results grid, and a measure that lets it breathe.**
  `RESULTS_GRID`'s floor drops from `minmax(280px, 1fr)` to
  `minmax(260px, 1fr)`, and `RESULTS_MAX_WIDTH` rises 1120 → 1400: the old
  cap quietly overrode the floor (a 1440px desktop drew three 363px cards
  inside a 1392px content column), and a card grid is not prose — its
  measure is the fleet's widest content column. Five columns open, four
  beside the rail; the 2560px pane the cap was written against is still
  capped. A host that pinned `maxWidth` on the pane keeps its pin.

The `default` entry's size budget moves 21 → 22 KB (measured 21.6 KB): the
disclosure header, the panel search and the footer bar are shipped surface,
not drift.
