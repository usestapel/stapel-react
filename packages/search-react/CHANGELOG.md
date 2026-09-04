# @stapel/search-react

## 0.29.0

### Minor Changes

- ddcf500: On a phone the buyer's dictionary filter is a sheet, the same gesture the
  seller's vocabulary picker already was.

  Mobile pass 12 measured both halves of one product on one screen: the
  composer's `ref_select` editor is a trigger row that opens a sheet with a
  search box, a recommended band and «All values» — zero checkboxes — while the
  filter panel drew the SAME axis as a wall of 8 → 38 checkboxes over a "Find a
  value" box, with no way to say "any". One dictionary, two gestures, depending
  on which half of the product you were in.

  `<FacetGroupControl dictionaryMode="sheet">` is the third mode, and
  `<SearchPage>`/`<FacetPanelPane>` make it the default for the phone filter
  sheet (the desktop `"field"` is unchanged; `"inline"` stays for a surface
  already devoted to one group, such as the per-chip sheet). The closed row
  reads _Any_ or the chosen values with their count; it opens the shared
  `SkinPickerSheet` — the very component the composer's picker draws, so the
  search box, the checkmarks, the commit above the home indicator and the
  swipe/Esc/back dismissal are inherited rather than re-derived — holding a
  **Recommended** band (the busiest values by count, capped at
  `FACET_VISIBLE_OPTIONS`, with anything chosen in front of it, so a cold
  chosen value is never out of reach of its own off-switch), **All values** (the
  rest alphabetically, `FACET_SHEET_PAGE` = 50 at a time as the list is
  scrolled) and one **Done** that writes the whole draft. The box filters
  locally and across alphabets (`translitPrefixMatch`, the desktop field's own
  matcher); typing collapses the two bands into one, because a _Recommended_
  heading over rows that answer a query is a lie about which rows those are.

  The commit needed a bulk write: `toggle` reads the state it flips, so a draft
  of several ticks applied through it would collapse into the last tick.
  `useFacetPanel` gains `setValues(slug, values)` — one URL write per commit —
  and `<FacetGroupControl onSetValues>` is the seam that carries it; without one
  the sheet mode falls back to the desktop field rather than committing
  something it cannot apply.

  New i18n keys in every catalogue (en/ru/es):
  `search.facets.dictionary_recommended`, `search.facets.dictionary_all_values`,
  `search.facets.dictionary_done`.

## 0.28.0

### Minor Changes

- 27637d0: Three fixes from the desktop reference walk, pass 12 (D343, D344, D346).

  **A value equal to its default no longer rides along in the address.** The
  codec wrote `type`, `sort` and `limit` unconditionally whenever the state
  carried them, so `?type=listing` sat on every single link a catalogue with
  one doc type ever produced. `writeSearchState` now takes an optional fourth
  argument, `{ defaultType, defaultSort, defaultLimit }`, and omits each
  parameter that equals its default; `SearchStateProvider` passes its own
  parse options through automatically. Reading is unaffected — the same
  default fills the gap whether or not the parameter is there — so the round
  trip stays exact and a caller that never passes the new argument sees no
  change.

  **Back now unwinds a filter, a range and a partition one press at a time.**
  `goToAnchor` pushed a history entry for a keyset page move, so Back paged
  backwards through the results forever instead of leaving them where the
  visitor actually started paging. The push/replace choice on every mutator
  is now stated once, as a table (`DEFAULT_HISTORY_MODE`, exported with its
  `SearchHistoryKind`/`HistoryMode` types): a facet value, a range, a
  partition/category and geo push; the search box, a page-size change and a
  keyset page move replace. `goToAnchor` follows it like everything else, so
  paging no longer pushes.

  **`<OtherCategoriesLine>` rows can be real links.** Every entry was a
  `<button>` with no `href` — no address to hover, no "open in a new tab",
  nothing a crawler could follow. The new `categoryHref?: (category: string)
=> string | undefined` prop (threaded through `<SearchResultsPane>` and
  `<SearchPage>`) resolves an id path to a host address; a row it names
  becomes a real `<a href>` whose plain click still narrows the search in
  place (a full navigation would answer a different query than the one the
  count was counted for) while a modified click is left to the browser. A row
  `categoryHref` returns nothing for keeps today's in-app-only button, and
  whether a row is drawn at all still depends only on `categoryName`, exactly
  as before.

## 0.27.0

### Minor Changes

- 07446e9: Two fixes from the reference census (2026-09-04): the rail no longer picks
  between two different "no filters" sentences, and it inlines twice as many
  groups before folding.

  **One empty state, and only when the rail truly has nothing.** The facet
  panel used to say "This search offers no filters" when the group list was
  empty, and a SECOND sentence — "N filters apply to too few of these
  results" — when the server had counted groups and withheld them for
  covering too little of the result set (D175). A reference catalogue checked
  against the same shape says neither: it leaves the filters visible with low
  counts and explains nothing. `search.facets.withheld` and its plural
  catalogue entries are gone from every locale; `FacetsEmptyArm` now says
  nothing at all when groups were withheld or skipped, or when the rail is
  already drawing a price row, an applied location, or the partition slot
  (`hasOtherDrawable`) — `search.facets.empty` is the one sentence left, for
  the one case none of that is true. A host that still wants the withheld
  count for its own copy reads `data-withheld` off the (otherwise empty) arm.

  **`visibleGroups` defaults to 16 in the desktop column, 8 in the phone
  sheet.** The reference inlines roughly two dozen groups in its rail before
  anything folds behind "all filters"; this pair folded at eight everywhere,
  which on a wide rail was the make, the price and little else. `<SearchPage>`
  now defaults `visibleGroups` per layout — 16 in the column
  (`FACET_VISIBLE_GROUPS`, also `<FacetPanelPane>`'s own bare default), 8 in
  the sheet, where a person has already paid one tap to get there and folding
  its tail again saves less than folding a column's does. Both stay overridable
  through the same prop.

## 0.26.0

### Minor Changes

- d88077a: Short feature keys in the address, a vocabulary axis that is always a field, and an axis with no evidence that is no longer drawn.

  **`f.make=toyota`, not `f.make_ref_select=toyota`.** The importer's type suffix carries nothing a reader can act on. stapel-search 0.14.4+ states the readable half per group (`facet_labels[slug].url_key` — the slug minus its suffix where that stays unambiguous among the features of the category in scope, the slug itself otherwise) and accepts both forms inside that scope. The codec now **writes** `url_key` and **reads either**: `parseSearchState(params, {facetKeys})`, `writeSearchState(state, base, facetKeys)`, `buildFacetKeyMap` / `facetKeyMapFromLabels` to make a map, and the server's own collision rules applied again on the client — a short form that is another slug of the same answer, or that two slugs claim, keeps the slug on both sides. The map rides the answer: `useSearchQuery` publishes it to `SearchStateProvider` (`usePublishFacetKeys` / `useFacetKeys`), which re-parses the URL with it and writes every later address through it. Nothing is renamed and nothing is stored — the request this pair sends still carries the slug — so a link written before this release, and a link written against a server that states no `url_key`, both keep working. `buildFacetGroups` matches a filter by either spelling, so the rail, the chip row, the popular-values block and the applied chips all round-trip through one key.

  **A vocabulary-backed axis is always the field.** `isDictionaryFacet` counted evidence buckets, so on a leaf holding three cars the make drew three checkboxes over a vocabulary of four hundred makes. Where the values LIVE decides the control now: `ref_select`/`ref_hierarchical_select` — or a group with no def whose answer names a `vocabulary` — is a dictionary however many buckets came back, and the searchable field is the only control that can reach values the answer never enumerated. An inline `select` keeps its checkboxes or pills whatever its length. `facetGroupIsVocabularyBacked` is exported; `FacetGroup` carries `urlKey` and `vocabulary`.

  **A group with zero evidence and nothing selected is not drawn.** A live laptops leaf drew six of six groups as accordions a person could open and narrow nothing by: every counted bucket zero, and the axes the facet budget skipped standing on their authored option tables with `count: null` on every row. `facetGroupIsDrawable` now asks for evidence — at least one value some candidate carries — with two exemptions: an axis the reader has already filtered on, and any vocabulary-backed axis, whose field searches its dictionary with no buckets at all (`make` on a cars leaf holding three cars, `vendor` on a laptops leaf holding one — both now KEPT where they used to be dropped, while the zero-filled inline tables beside them go). `mandatory` is not part of the rule: the live laptops leaf marks none of vendor/model/screen size required, so gating on it would have deleted the vendor picker to save the make one. Consequence worth stating: an axis the plan cut at `MAX_FACET_FIELDS` is no longer drawn from its schema table alone — raising that budget is the fix, and stapel-search 0.14.5 spends it in schema order, required first.

  **Three things a storefront could not do from `<SearchPage>`.**

  - `dictionaryMode` reaches the page at last, defaulted per layout: `"field"` in the column (the select-style «Any» that opens the searchable list) and `"inline"` in the phone sheet, which is already a disclosure.
  - `footerBar` takes `"sticky" | "static"` (`true` still means sticky). The column layout passes `"static"`: pinned to the rail's scroll port the opaque bar sat over the last two groups, and a storefront was reaching for `!important` to lift it off. A sheet, whose port is the sheet, still pins it.
  - The undrawable-axis warning is DEV-ONLY for real. The guard asked "is this not production", a browser bundle with no `process` shim answered wrong, and `facet group "complectation" has no values to draw` reached buyers' consoles once per page load. It now asks "is this a dev build".

## 0.25.0

### Minor Changes

- 6441f84: search: the sections a query reached are ONE line, drawn from the answer that drew the cards

  A storefront's results page carried a block titled "Categories for «auto»":
  one full-width row per section, fourteen of them under the results — and it
  appeared a beat AFTER the results, because it came from a second request to
  `/suggest`. So the page a person had already started reading moved under them,
  for information that was not new. `/query` had answered with
  `facet_meta.categories` — `{path, count}` for every section the candidate set
  contains, the same list the block was printing — and the type-ahead had shown
  the same sections a keystroke earlier.

  **`<SearchPage otherCategories categoryName={...}>`** (and the same two props
  on `<SearchResultsPane>`) draws it as a line above the results:

  > Search in other categories: **Cars 12** · **Buses 3** · **Motorhomes 1** · 5 more

  - **the rows come from the SEARCH response**, so the line is in the document in
    the same commit as the first card. With results on screen this feature makes
    no request at all — the test asserts zero `/suggest` calls on the wire, not
    merely that nothing is drawn twice;
  - **the one exception is an empty result**, which by definition has no
    candidates and is the screen where the sections are worth the most. There
    `/suggest` is asked, into a slot whose height is reserved from the first
    frame, so the answer lands without moving anything — filled or empty;
  - **the counts are the answer's own** and the line is capped at 8 with the tail
    folded behind "N more"; on the phone surface the cap halves to 4 and the
    collapsed line is clamped to two rows besides, because it is name LENGTH and
    not entry count that turns a line back into a block;
  - **pressing an entry narrows the search on screen and keeps the query.** The
    count beside a name is the count for THIS query in that section; a link to
    the bare category feed would show a different, larger number one click later,
    so the caption would be a lie. Each entry is a real `<button>` whose
    accessible name says what it does.

  Naming an id path stays the host's, the same seam `categoryLabel` fills for the
  category chip: `categoryName` is tried first, then the server's own name (a
  `/suggest` answer already in the query cache names the rows for free), then the
  path's last segment when it is a slug. A row none of the three can name is
  dropped rather than printed as `163`.

  New: `useOtherCategories`, `OTHER_CATEGORIES_LIMIT`, `OTHER_CATEGORIES_PHONE_LIMIT`,
  `otherCategoryLeaf` from the main entry; `<OtherCategoriesLine>`,
  `otherCategoriesCss()`, `OTHER_CATEGORIES_CLASS`, `OTHER_CATEGORIES_STYLE_HREF`,
  `OTHER_CATEGORIES_PHONE_ROWS`, `OTHER_CATEGORIES_SLOT_MIN_HEIGHT` from
  `./default`. Opt-in: a page that passes neither prop is byte-for-byte what it
  was.

  Size limits raised with their reasons in the entry names: index 12.5 → 13 KB
  (the headless read), default 26.25 → 27 KB (the line — a net deletion on the
  page that mounts it), i18n/es 3.5 → 3.75 KB (three strings).

## 0.24.0

### Minor Changes

- 01edcd1: search: the chip row gains an APPLIED mode — one chip per constraint, each beside the control that drops it

  A storefront integrator built this row by hand and asked for it back. On a
  desktop the filters are a rail two thousand pixels tall, and picking two values
  left NOTHING between the page header and the first card: the only trace of a
  choice was a pressed button somewhere inside the column and one "clear all (2)"
  beside it. Dropping ONE of the two meant scrolling the rail until the same
  button came back. A constraint on screen must keep the control that removes it,
  and on that surface neither half was true — the constraint was not on screen
  and its control was not beside it.

  `<FilterChips>` could not be the answer as it stood. It is a row of OPENERS —
  one chip per axis, applied or not, each opening its own `SkinDialog` — which is
  the right shape where the panel is behind a tap and the wrong one where the
  panel is already drawn: beside an open rail it prints the whole panel twice and
  still removes nothing without a modal over the results.

  **`mode?: "openers" | "applied"`**, default `openers`, which is byte-for-byte
  the row that shipped. In `applied`:

  - **one chip per applied VALUE and per applied numeric range**, never one per
    axis — three chosen brands are three chips and three removals, where an
    axis-shaped chip would drop all three with one press;
  - **every caption names the axis AND the value** — "Brand: Bosch", "Price: from
    100 to 500" — because beside a dozen axes a bare value names nothing. A core
    money axis prints as money in the currency the answer's own cards carry; an
    attribute prints its schema unit; the bounds themselves print exactly as the
    URL carries them, since the wire never promised a number and reformatting one
    would rewrite the link;
  - **every chip is a real `<button>`** whose press removes exactly that
    constraint and whose accessible name says so. Not an antd `Tag closable`,
    whose close icon is a `<span>` with no tab stop — a constraint a keyboard can
    read and cannot drop — and not a modal detour;
  - **the rail's own clear-all**, beside the chips instead of a column-height
    down the page;
  - **the same label path as the rail**, stamped on the markup:
    `data-label-source` for the axis and `data-value-label-source` for the value,
    each `server | schema | host | none`. A raw index term reaching this row is
    something a storefront's test can fail on rather than eyeball;
  - **nothing at all when nothing is applied** — an empty band above the results
    is furniture — and nothing before the answer lands: both halves of a caption
    are named by the envelope (`facet_labels`, `facet_meta.core_ranges`), so a row
    that drew early would caption a chip with a slug and rename it a moment
    later.

  Both modes read the SAME bag the rail reads (`useFacetPanel`, `buildRangeGroups`
  over the page's own state), so no two surfaces can disagree about what is
  applied or about what a value is called.

  **`<SearchPage appliedChips="desktop">`** mounts the row in the results header
  with one prop. `"desktop"` is the case this exists for — where the rail is on
  screen; on the phone the opener row below already states every applied filter on
  its own chip, and a second row would say it twice. `true` draws it in both
  layouts; omitted, nothing changes.

  `buildAppliedChips`, `rangeChipText`, `rangeLabelSource` and
  `appliedChipTestId` are exported for a host composing its own row, along with
  `FilterChipsMode` and the split prop types (`FilterChipsOpenerProps` /
  `FilterChipsAppliedProps`, unioned as `FilterChipsProps`) — the applied mode
  takes no `onOpenAll` because it opens nothing.

## 0.23.0

### Minor Changes

- e8d7744: search: the rail is the category's own form, and the axes a seller had to fill are the ones a buyer sees first

  A walk of a live classified's desktop cars page reported three things in one
  breath, and they turned out to be four faults with one shape: the panel was
  answering questions the _answer_ had asked, not the ones the _category_ asks.

  **The rail is in SCHEMA order, required first.** It ranked by evidence — the
  sum of an axis's counts — which is the right question for a phone chip row
  with room for four and the wrong one for the column a person narrows a
  catalogue in. On three listings the busiest axis is whichever three values
  happen to be counted, so the rail opened on condition and colour while the
  make, the model and the year — the three fields the category marks `mandatory`,
  i.e. the three every seller had to fill — sat below them. `orderFacetGroupsBySchema`
  puts pinned slugs first, then the required features in the schema's own order,
  then the rest in schema order, then what the schema does not name at all in
  evidence order, because with no schema there is no other order to have. Stable
  under a click, which a rail that reshuffles as you tick is not. Past
  `visibleGroups` (default 8) the tail folds under one **All filters (K)**
  control — never a group you have already chosen a value in, because the control
  that removes a filter is the one you came back for. `<SearchPage>` gains
  `partition` (drawn above the price: which half of one template a page is about
  is not a filter among filters) and `pinnedFacets`.

  **Why the make could vanish.** `facetGroupIsDrawable` is now the one predicate
  the rail and the chip row share, and it says what the old duplicated
  `options.length > 0` said without saying WHY: a group with nothing under it is
  a heading over nothing. The catalogue's `make`, `model`, `generation` and
  `body_type` are `ref_select` features whose config is a bare `optionsRef`
  pointer — no option table in the schema and there never will be — so the moment
  the server's plan does not count one, there is nothing on either side to
  enumerate and the group leaves the page, while every `select`-typed comfort
  option (steering side, power steering, heating) draws its own schema table and
  stays. That is the exact set the walker saw and did not see. The drop is still
  right — a dead heading helps nobody — and it is no longer SILENT: outside
  production one `console.warn` names the axis, says which side is missing
  (uncounted, or a schema that does not define it), and says when the schema
  calls the axis **required**. Both owners of that wiring fault can now see it
  from the page. The regression is pinned against the live answer itself, saved
  as a fixture (`test/liveCars.ts`, captured 2026-09-04): an axis with evidence
  buckets survives the parent node's EMPTY feature list and a def that names it
  without typing it.

  **A dictionary outranks the pills, and on desktop it is a FIELD.** The live
  make axis is `maxSelected: 1` over a 418-value vocabulary, so "pick one" won
  the shape contest and the control it produced was four hundred pills in a 280px
  rail — a wall with a different border radius. `facetGroupShape` now asks
  "dictionary?" before "single-choice?". And on the rail
  (`dictionaryMode="field"`, which `<SearchPage>` sets for the column layout) a
  dictionary closes into a select-style field reading its chosen values or _Any_,
  which opens the searchable list you already had: a real `role="combobox"`
  button, ArrowDown to open, Escape to close. The phone sheet keeps the list
  inline — the sheet is already the disclosure.

  **A bounded integer is a picker, not a bare number.** The year was two empty
  number fields; it is `int` with `min: 1900, max: 2027`, which is 128 values and
  therefore a list. `RangeGroup.picker` carries it (newest first — a year picker
  that opens on 1900 is a picker nobody uses) for any `int` feature whose schema
  declares both bounds and spans at most `RANGE_PICKER_MAX_VALUES` (300), and
  `<RangeFilterRow>` draws two from/to selects. Typing still works and carries
  the bounds: a valid in-range number narrows the list, anything else brings the
  whole list back with the bounds said in words, because a year below the
  catalogue's floor otherwise does nothing at all, silently. A mileage
  (`1..1000000`) and the core price stay two typed fields.

  **The rail's scrollbar is in the gutter, not on the filters.**
  `scrollbar-width: thin` and `scrollbar-gutter: stable` are the standard half
  and they are not enough: on every overlay-scrollbar platform — a Mac by
  default, every iOS browser — the bar is painted OVER the content and the gutter
  reserves nothing, which is why it lay across the checkbox labels. The rail now
  also declares a classic bar through the WebKit pseudo-elements, with a real
  width so it displaces rather than overlaps, and every colour a `--stapel-*`
  custom property so it is the panel's own hairline in both themes rather than a
  grey that glows in the dark one. `railScrollbarCss()` and `RAIL_CLASS` are
  exported for a host that lays out its own column.

  **`<PartitionChips variant="segmented">`** is the desktop rail's shape of the
  same choice: one joined control under its own label instead of a wrapping pill
  row, which in a 280px column is two ragged lines. The SEMANTICS do not vary
  with the variant — the same `radiogroup`, the same roving tabindex, the same
  arrow keys — because a segmented look is a border-radius decision, and swapping
  in a component that draws joined cells by giving up "exactly one of these is
  true" would trade the accessible half of the control for the visible half.

  Also: `FacetLabels.label_translatable` is typed. The live answer sends it
  beside every group label and the pinned `schema.json` does not describe it, so
  a fixture captured from the wire was a type error.

## 0.22.0

### Minor Changes

- 65e0c9f: search: headings come from the server, a vocabulary becomes a dictionary, and two browse surfaces for a category page

  **A heading is named, or it is marked.** Group headings and option captions now
  resolve in one stated order — `facet_labels` from the answer, then the category
  feature definition, then the raw slug. The slug arm is not a fallback anyone may
  ship: it renders, because a heading a person cannot read still beats options
  with no heading at all, and it renders MARKED — `labelSource: "none"` on the
  group and the option, `data-label-source` on the drawn control, and one
  `console.warn` per slug outside production, so a storefront's own test fails on
  it. Measured on a live classified's cars branch the page passed an empty feature
  list and the whole rail was raw index slugs: the make group was on screen,
  unlabelled, and the complaint that came back was "I cannot pick a make".
  `FacetGroup` and `FacetOption` both carry `labelSource`
  (`"server" | "schema" | "host" | "none"`) — "did anybody actually name this?" is
  a question two surfaces have to answer and neither can answer by reading the
  string.

  **A vocabulary level is a DICTIONARY.** Past eight counted buckets a
  `ref_select` group — or an untyped group that long, which is the live case where
  no schema was threaded through — stops being eight checkboxes plus a
  `Show all (418)` and becomes the busiest values, a search box over the rest, and
  the chosen values pinned above it where a filter cannot go invisible. The box
  matches ACROSS ALPHABETS: `тойота` finds `Toyota`, `тимберленд` finds
  `Timberland`, `ровер` finds `Land Rover`. That is a prefix rule over two keys
  per word — a transliteration, and its consonant skeleton, because the two
  scripts disagree exactly on the vowels of a borrowed name (`timberlend` vs
  `timberland`, both `tmbrlnd`). Table-driven and dependency-free, and local: the
  buckets are already in the answer, so nothing is requested per keystroke.
  `facetGroupShape` gains a `"dictionary"` arm beside `segmented`/`nested`/
  `checkbox`, and the threshold counts EVIDENCE buckets — a zero-filled option
  table or a schema-only tail is still a list a person can read.

  **`<PopularValues>`** prints the busiest values of one group as a multi-column
  `Toyota 802` block that applies the filter on click — a table of contents for a
  category, drawn from the same drill-down counts the panel shows, so a value
  cannot read `802` in one place and `93` in the other. `hidden` is a PROP rather
  than a media query inside: whether a 390px screen has room for forty links is a
  fact about the page, and the page is the storefront's.

  **`<PartitionChips>`** is the single-select row a `chips` category draws instead
  of a tile grid: `Все | child…` from `{id, path, name}`, controlled — the choice
  is a `category` in the URL, not state in a chip row. It is a real `radiogroup`
  with roving tabindex and arrow keys, because exactly one of them is true at a
  time and a row of `aria-pressed` toggles announces the opposite: independent
  switches, with no reason why pressing one released another.

## 0.21.0

### Minor Changes

- 3059411: The location control is one control, it says how the search got there, and a radius in the URL means something

  Three measurements on a live results page, and each one is a different way of
  the same line not saying what is true.

  - **Two red links at opposite ends of a 992px strip.** "Searching everywhere"
    sat at x=370 and "Near me · Within 25 km" at x=776, both in the brand colour,
    with 400px of air between them and nothing saying they were about the same
    thing. They now share one bordered box at the leading edge, split by a
    hairline; the place half is ordinary type because it is a STATEMENT, and the
    offer keeps the colour because it is the action. The offer states its radius
    compactly (`search.geo.radius_km_short`) — at 390px the long form made the
    control 272px wide against 231px of room, so it was cut by the group's own
    clip and the filters door overlapped it by 52px.
  - **"A chosen place on the map", said to somebody who pressed a button.**
    `SearchStateBag.geoIsOffer` is the provider reporting PROVENANCE — the one
    fact a summary line cannot infer, because every way of arriving at a centre
    produces the same three numbers.
  - **`?radius_km=300` with no place.** The search that ran was the honest one (a
    radius with no centre narrows nothing) and the control went on advertising
    its own 25, with nothing on screen saying which number the page had used —
    and pressing the offer then wrote 25 over the 300 the person had typed, the
    one place the URL was rewritten behind a visitor. The codec now reports
    `radius_without_place` through the same notice every other unreadable
    parameter goes through, and the offer CARRIES that radius: what the link
    asked for, what the button says, and what pressing it does are one number.

  The `index` and `default` size caps move to 11.5 KB and 22.5 KB, and the
  measurement is the reason rather than the aftermath. Re-measured on a clean
  tree, this package's own `src` reverted to the previous commit with every
  dependency held constant: `index` 10.70 -> 11.14 KB, `default` 21.64 -> 22.27
  KB. Both were already through the old 11/22 caps before the caps were touched.

  The ~250 B of new i18n sentences is not what did it. Collapsing all six new
  English strings to a single character — the floor of what shrinking the copy
  could ever buy — leaves `index` at 11.04 and `default` at 22.14, both still
  over. The copy is worth ~100 B and ~130 B brotlied; the rest is the facet plan
  reading `facet_meta`, the location control's one-box rewrite and the widened
  response types. So the caps move, and the sentences keep their words.

### Patch Changes

- 5604f1a: A facet group nothing in the result set carries is not drawn

  Measured on the deployed phones leaf: `sim_config`, `device_history` and `set`
  are authored `select` features that no listing in the leaf fills. All three
  were drawn as full groups — a heading in the rail, a chip on a 390px row, and
  between them seven checkboxes each guaranteed to return nothing. A buyer can
  tap every one of them.

  They are not a counting bug. The server's `fill_zero_options` creates the slug
  and zero-fills every authored option on purpose, and the coverage floor that
  would have withheld them (`FACET_MIN_COVERAGE`) governs only the slugs an
  evidence plan BORROWED from sibling leaves — a slug the queried category
  authored is exempt, because "a closed option set answering with its zeros is a
  shipped decision". That is right about an OPTION and wrong about a GROUP: a
  size chart showing `XL — 0` beside `M — 12` is telling the truth about a shape
  worth seeing whole, while a group whose every option is 0 is not a shape at
  all. Nothing on the wire separates the two — the client has to sum the buckets
  itself, which is what `facetCoverage` already does for the chip row's order
  and the rail's disclosures.

  So `buildFacetGroups` now drops a group that is COUNTED and sums to zero, by
  that same measure — the module already refuses to emit an empty group, on the
  stated grounds that an empty group is still a heading and still a chip, and
  this is the same defect with checkboxes in it. Three exemptions, each with a
  test:

  - an UNCOUNTED group sums to zero for the opposite reason — its options carry
    `count: null`, nobody looked, and `/query` accepts `f.<slug>` regardless.
    Dropping on that is the regression the `MAX_FACET_FIELDS` branch exists to
    prevent (a live cars leaf: 26 facetable features declared, 12 counted).
  - a group the reader has already filtered on, whatever its counts say, or the
    URL narrows the search with no control left to widen it.
  - a zero option beside a live one, which is drill-down working as designed.

  A counted group that came back with no buckets at all (`video_file_url: {}` on
  that same leaf) is dropped by the same rule rather than by each skin filtering
  the model's output again downstream.

  This does not fix the catalogue. A leaf declaring three features that nothing
  in it fills is a category-authoring defect; this stops it reaching a buyer as
  a dead control, on every leaf and every host, and it needs no server release.

## 0.20.0

### Minor Changes

- 8279cb6: **A place is not a filter, and no place is applied unless the person asks for one.** `defaultGeo` becomes `geoOffer`, the location gets one control of its own, and `lat`/`lon` leave the filter list entirely.

  The old prop applied the host's guess about where a visitor is standing — under four careful rules about not overruling anybody: only into a URL with no location, only once, never after a clear, and late arrivals still count. Every rule held. Measured on a live classified with the browser's geolocation granted, against the same board with it denied:

  | leaf                                       | located | not located |
  | ------------------------------------------ | ------: | ----------: |
  | a phones category                          |      15 |          46 |
  | a used-cars category                       |   **0** |           2 |
  | a tyres category                           |   **0** |           1 |
  | a text query for a published, live listing |   **0** |           3 |

  One permission, granted once for a map on some other page, became a permanent 25 km wall around every category leaf and every query in the deployment. The owner's own words for what that looked like from his chair: _"the landing turns itself into a search with 0 listings after two seconds, with two active filters I can't even look at"_ — and clearing them bought two more seconds before it happened again. The rules were not the defect; applying at all was, and counting a coordinate as a filter is what made the cause unnameable.

  **Nothing is applied on this pair's initiative.**

  - `<SearchStateProvider geoOffer>` / `<SearchPage geoOffer>` take the same value and commit nothing. The bag exposes `geoOffer` (retired once the search carries a place of its own) and `acceptGeoOffer()`.
  - Two defects fall out with it. The URL is **never rewritten behind the visitor**, so a hand-typed `radius_km` is their word and survives verbatim. And the results are fetched **once** instead of being fetched and immediately superseded — the permanent `ERR_ABORTED` in every network log. `test/geo.test.tsx` asserts the request count, and asserts that a page left alone for twenty settles does not move its own URL, history or results.

  **A latitude is not a filter.**

  - `activeFilterCount` counts facet values and ranges. Nothing else. A count that named nothing was worse than no count: it told a person something was hiding their results and gave them nothing to press.
  - `clearFilters` leaves the place alone for the same reason — it is not one of the things that control counts, and widening a price range is not a request to be moved back to the whole country.
  - The geo chip is gone from `<FilterChips>`, and the "Location" group is gone from `<FacetPanelPane>` (with its `renderGeoFilter` and `geoLabel` props).

  **One location control, on every results surface.**

  - `<SearchPage>` mounts `<LocationSummaryLine>` itself — a place on the left, its radius beside it, the sheet behind both — instead of leaving it a slot each host had to remember to fill. One of them did not: a category results page had no way to say where it was looking while `/s` had one.
  - The radius moved into that sheet, beside the place it is a radius **of**. It exists only once a place is set, and clearing the place clears it too.
  - With no place set and an offer standing, the row reads **"Near me · within N km"**. It states its own radius: nobody should accept a number they cannot see. Pressed, it pushes, so Back is the way off.
  - `filtersDoor={false}` drops the trailing "Filters (N)" where the panel is already on screen.

  **Migration:** `defaultGeo` → `geoOffer` on `<SearchPage>`/`<SearchStateProvider>`. `renderGeoFilter`/`geoLabel` stay on `<SearchPage>` and are removed from `<FacetPanelPane>`/`<FilterChips>`; the page routes them to the location control. A host that mounted `<LocationSummaryLine>` in `resultsHeader` should stop — the page draws one.

## 0.19.0

### Minor Changes

- 9c8ee74: search: the filter rail ranks by evidence like the chip row already did, and a host can scope the results the pane drew

  **The rail was ordered by the catalogue importer.** The rail redesign gave it disclosures, an evidence-ranked set of OPEN groups, a panel search and a sticky footer. It never touched the SEQUENCE, which stayed whatever `buildFacetGroups` and `buildRangeGroups` emitted. On the deployed mobile-phones leaf that read: Category, Where to look, Price, then battery health, parcel weight, parcel length, parcel height, parcel width, minimum order count and packing count — 908px of parcel logistics — and only then brand, model and colour.

  The rail is sticky, viewport-tall and scrolls internally, so what that order costs is not a longer page. At 1440x900 the brand facet sat at y about 1500 and entered the viewport at no page scroll at all: a buyer on the phones leaf was offered seven ways to filter by shipping weight and no way to filter by brand (walker D120/D121 on the desktop, D74 on the phone). The filters themselves were fine — a programmatic click still narrowed correctly — which is why the pass reported it as a layout fault. It is an ordering fault.

  The chip row has ranked exactly this since D16. Its comparator now lives in `state/facets.ts` as `compareFacetsByEvidence` / `orderFacetGroups`, and both surfaces use the one definition: answered axes first, then coverage — the answer's own evidence of which axes this corpus actually fills — with ties keeping the authored order. The panel additionally splits its numeric rows the way `CHIP_BAND_ORDER` already states: the CORE ranges the server declares for every document (the price) render above the facets, and the category's own numeric attributes render below them, in `search-ranges-attributes`. Nothing is deleted — a buyer who wants a shipping-weight bound still has one, in the place the evidence puts it.

  **`wrapResults`, the slot around the results.** A container that needs to publish something over the rows the pane just drew — a per-reader overlay, an observer, an analytics boundary — needs the rows AND the pane's grid, and `renderResults` only offered the first at the price of the second. The measured cost: a storefront that dims already-seen listings could open its engagement scope on its own landing feed and not on `/s` or `/c/:slug`, which reach the pane through `SearchPage` and its internal `SearchStateProvider` — so the feature worked on one of the three screens a buyer scrolls and silently did nothing on the other two (walker D105). `wrapResults(rows, results)` is on `SearchResultsPane` and forwarded by `SearchPage`; it is called on the loaded arm only, so the pane keeps all four of its load sentences.

## 0.18.1

### Patch Changes

- f79bdc3: tokens-antd: a gated control is semantically off and interactively ALIVE — it can be tapped, focused, and can say why it will not do the thing

  `GatedControl` handed callers `bind.disabled` and its own JSDoc told them to spread it straight onto the control. That produced an html-`disabled` element, which fires no events in any browser: it cannot be clicked, cannot take focus, cannot be described to a screen reader that never reaches it, and cannot carry the one gesture that mattered — the tap that should open the sign-in door standing behind the gate. Every gated control across the ~20 pairs using it was inert, and the wrong instruction was half the defect: the docs taught the shape that broke it.

  Measured on a live deployment: an anonymous visitor taps the favourite heart and nothing happens at all — no sentence, no tooltip, no door (walker defects D45/D72).

  **The corrected contract.** While the gate is shut a control is now `aria-disabled="true"` and NOT html-disabled, so it stays focusable and keeps receiving events. The ACTION is suppressed by `GatedControl` itself, in a capture-phase wrapper (`display: contents`, so no pair's layout moves by a pixel): the caller's `onClick`, keyboard activation, typing, IME input, paste and drop are swallowed before the control sees them. Callers write their handlers exactly as if the gate did not exist. The activation comes back as the new `onBlockedActivate`, which is where a pair opens its door. The reason stays where it was — visible text wired by `aria-describedby` — and where a `PaneGate` pools it into one footnote, the gesture now brings a `role="status"` copy of the sentence back to the control it belongs to. A blocked `GatedButton` keeps antd's exact disabled paint (its own `-disabled` class, which sets no `pointer-events`), so nothing about any screen looks different.

  `GatedControlProps.whenBlocked` holds the two deliberate opt-outs, neither of them the default:

  - `"inert"` — html `disabled`, for the rare control that must be switched off at the browser level. `attributes-react`'s catalogue lock is the one place in the fleet that asks for it, and now says so.
  - `"annotate"` — the control stays fully usable and only gains the sentence, for a gate that judges the VALUE rather than refusing the person: `calendar-react`'s slot-length field must stay editable, because editing it is how the reason goes away, and `search-react`'s sort must still pick the options that are not the blocked one.

  `useBlockedButtonClassName()` is exported for render-prop call sites that paint their own button and want the same unavailable look rather than a second grey.

  **⚠️ The readiness-signal hazard, and its cure.** `element.disabled` is now permanently `false` on every gated control in the fleet. Any test using it as a readiness signal — `await waitFor(() => expect(save.disabled).toBe(false))`, meaning "wait until this is allowed" — returns instantly and mis-times SILENTLY: every assertion after it reads an unseeded component, and the failure looks like broken product logic rather than a gate that had not opened. One pair's suite went green → 21 failures across unrelated files on exactly this. Wait on the stamp instead, which is what such a wait was always asking:

  ```ts
  await waitFor(() =>
    expect(
      screen.getByTestId("save-gate").getAttribute("data-stapel-gated")
    ).toBe("available")
  );
  ```

  `data-stapel-gated="available" | "blocked"` is on the wrapper of every gated control in all three modes (`GatedButton` names it `<testId>-gate`). For a point assertion on one element, read `aria-disabled`. Never `disabled`.

  **ChoiceChips** carried the same defect on its own chips and is fixed the same way: a chip at the cap is `aria-disabled` and focusable, and the tap is refused in the handler, so the row's sentence reaches a keyboard.

  **The consumers.** Every `GatedButton` call site (64 imports across 20 pairs) is fixed with no code change — the correction is in the substrate. The render-prop call sites that consumed the binding field-by-field now spread it whole: `billing-react`'s auto-recharge switch, `calendar-react`'s RSVP buttons, `moderation-react`'s sanction checkbox, `notifications-react`'s push switch, `attributes-react`'s at-max add button. `tasks-react`'s assignee picker is a host slot rendering its own control out of reach of the suppression, so it is handed a plain verdict on purpose. `workspaces-react` had two hand-rolled gates that never went through `GatedControl` at all — a row-action column and the create button on a failed roster read — and both now use the same anatomy.

## 0.18.0

### Minor Changes

- 309890a: The desktop filter rail redesigned around what the walker measured on a live
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

## 0.17.0

### Minor Changes

- 6bf6f2d: The chip row is capped behind a "more" door, and the counted-facet band leads
  with coverage.

  Ordering alone did not survive a grown catalogue: an imported schema gave a
  phones leaf option tables for its wholesale plumbing (so they came back as
  facet groups) and a cars leaf declares enough axes for 44 chips in one row at
  390px. Two mechanisms close it:

  - Within the counted-facet band, groups rank by **coverage** — the sum of a
    group's counts, the answer's own evidence of which axes this corpus fills.
    A brand every document carries outranks a flaw eleven carry and an
    uncounted schema guess with no evidence at all; ties keep the authored
    order (the sort stays stable). Bands, applied-first, and the barren rule
    are unchanged.
  - The row draws at most `CHIP_ROW_CAP` (8) banded chips and stands a
    "More · N" chip (`search-chips-overflow`) in for the tail, opening the same
    full panel the leading circle does. Nothing is deleted, and an APPLIED
    filter is never behind the door. `FilterChipsProps.maxRowChips` moves the
    budget; `null` restores the uncapped row. `capChipRow` is exported beside
    `orderChipFilters` because the cap, like the order, is the product.

  New i18n key: `search.filters.chips_overflow` (en/ru/es shipped).

## 0.16.0

### Minor Changes

- d7677eb: A phone can reach any leaf, filter by anything the category declares, and get home.

  **`categories-react` — the rootless cascade stops reading the whole catalogue.**
  With no `rootId` and no host-supplied `roots`, the top rung was the category
  LIST endpoint, which has no roots filter: on a live catalogue of 3583 rows that
  was 36 requests, 1.4 MB, and 19.9 seconds before the composer's first select
  existed. Every rung below it costs one `children/` call and a third of a
  second, so the whole cost of the control was that one question. It is now
  answered by `GET /categories/carousel/` — one cached request — projected to the
  rows with no ancestors, which is what a root is. A deployment whose carousel
  names no roots falls through to the catalogue sync, unchanged.

  **`search-react` — an uncounted facet is still a filter.**
  A facet's options came only from the counted buckets, so a slug in
  `facet_meta.skipped` had none, and every surface drops a group with no options.
  On a live cars leaf that meant 26 facetable features declared, 12 counted, and
  14 filters a person could read about in a warning and not use — while `/query`
  accepts `f.<slug>` for every one of them. `buildFacetGroups` now builds an
  uncounted facet's options from the category schema (`config.options`, or the
  answer's own captions), with `count: null` beside each — "nobody counted this"
  is still said, and it no longer decides whether the filter exists. An applied
  value always renders. A `ref_select` whose config is a bare vocabulary pointer
  still has no options here and is still not invented.

  **`search-react` — the skipped-slug notice is opt-in.**
  `FacetPanelPane`/`SearchPage` take `skippedNotice` (default `false`). The
  sentence is the engine's own note about its facet plan; on the live cars leaf
  it rendered as a yellow warning naming forty-two of the category's fields above
  the filters. Same class as the synonym-expansion notice this pair removed
  earlier. `skippedNotice` puts it back for a developer.

  **`shell-react` — a phone has a way home.**
  `phoneChrome="dock"` draws no wordmark (a 390px row cannot hold one and a
  search field), and that left `/` reachable from nowhere: the header's leading
  control is the host's history back arrow, and the dock's tabs are wherever the
  nav manifest points. The header now carries a home MARK — the brand's logo at
  glyph size, or a house where there is none — always a link to `/`, at the head
  of the row. `home={false}` for a host whose own chrome owns that corner.
  `HomeOutlined` joins the nav-icon registry, so a manifest may declare a home
  destination without drawing the fallback square.

## 0.15.0

### Minor Changes

- d20cb9b: The SERP stops being a dead end: empty sections are offered, an empty result has exits, and a category chip never prints a database id.

  Four defects, all measured on a live board at full catalogue scale (3583 categories, 3036 leaves, ~100 listings), all of them the same shape — a surface deleting or degrading the thing a person came for, at exactly the moment the catalogue was thinnest.

  **`offerableCategories` no longer drops a zero-count category.** The reasoning it was written on — an empty section is a dead end dressed as a destination — holds for a stocked board and inverts on a young one. With 2924 of 2924 leaves empty, the filter deleted the answer: typing a word with six real sections behind it produced NO PANEL AT ALL, and so did two other everyday words. The type-ahead was telling a person that sections of the catalogue do not exist, about sections that do. The server already ranks stocked destinations above empty ones (`stapel-search` 0.8: stock, then match quality, then count) and every row carries its own count, so an empty section now appears, below the stocked ones, saying honestly that it holds nothing. This side keeps the server's order and no longer re-sorts.

  **A category chip never prints a raw id.** `categoryLeaf` returns `undefined` for a path segment that is a bare number, and the chip falls back to the filter's own name. A board whose `category=` carries database ids drew a green pill reading «165», then «163», then «1142», permanently, on every SERP. A slug is a half-answer worth printing; an id names nothing a person could have typed. A host that resolves the real name still passes `categoryLabel` and always wins.

  **A barren result no longer leaves the feed's own fields as the whole filter row.** When the server counted a plan (`facet_meta.counted`) over a candidate set of zero (`facet_meta.candidates`), every counted facet is empty and drops out on its own — and the only chips left standing are the ones that never needed a count: the category's numeric attributes, drawn from the schema alone. On a cars leaf inside a radius that held no cars, that row read "Price / Colour / Availability / Steering side / Year / VIN / Dealer offer ×9": the make and the model gone because they had nothing to count, a body number and nine dealer promotions in their place. An unapplied numeric axis over an empty set narrows nothing that is not already nothing, so it is dropped; an APPLIED one always stays, because a constraint keeps the control that removes it.

  **`<EmptyExits>`: an empty result now has a way out.** "Nothing matches this search" was the terminal state of the whole catalogue — no way up, no siblings, no wider radius, no way to drop the constraint that caused it. Rendered inside the empty state of `<SearchResultsPane>` (and so of `<SearchPage>`), it offers only exits it can DERIVE from state the pair already owns, each removing exactly one constraint: go up a level (drop the last segment of `category=`), widen the radius ×4, search anywhere, drop one named applied filter or range, clear everything. A search with nothing to widen renders no exits at all rather than a row of buttons that change nothing.

  Sibling sections with their counts — the exit a buyer most wants — is a SLOT (`renderEmptyExits` on `<SearchPage>` and `<SearchResultsPane>`), for the reason `breadcrumb` is one: walking the tree belongs to `categories-react`. `<SearchResultsPane>` also takes `categoryFeatures` now, used only to name an applied filter in an exit the way its own chip names it.

  New i18n keys in all three bundles: `search.empty.exits_title`, `search.empty.up_a_level`, `search.empty.widen_radius`, `search.empty.anywhere`, `search.empty.drop_filter`.

## 0.14.2

### Patch Changes

- The imported rule corpus and the vocabulary examples are source-neutral.

  `test/fixtures/rules-corpus/imported/` replaces the directory named after the
  external marketplace the corpus was imported from, and both files were
  regenerated upstream (stapel-attributes 0.7.1) with a synthetic option
  vocabulary and structural notes. The rewrite is injective per case, so the
  TypeScript evaluator is still measured against exactly the same 3890 rules at
  both polarities — 7780 frames, 15 730 feature-state expectations, the same
  effect mix and the same shape gate. `scripts/gen-rules-corpus.mjs` copies the
  `imported` set, and the `stapel-attributes` contract pin moves to v0.7.1.

  Examples and demo data drop the source's name too: the worked vocabulary is
  `phone-models` / `car-models` / `phone-catalog` across the attributes,
  vocabularies, search and listings pairs. Comments, READMEs and changelog prose
  say "an imported external catalogue" where they used to name the marketplace.
  No runtime behaviour, exported API or wire shape changes.

## 0.14.1

### Patch Changes

- The desktop filter rail stops laying its own heading out down a column

  Measured on a live 1440px result page: the box holding the word "Filters" was
  43px wide and 78px tall — three lines, one syllable each — down the left edge
  of the results. It is the first thing a shopper sees beside what they searched
  for, and it read as a broken page.

  Two causes in one row. The heading shared a `space-between` line with "Clear
  all filters (2)", and both halves were ordinary flex items, so in a 280px rail
  the sentence took the width it wanted and the heading got the 43px left over.
  antd's `.ant-typography` then ships `word-break: break-word`, which is why the
  remains were a word broken between its letters rather than a truncated one.

  - the row WRAPS: the long sentence drops to its own line instead of squeezing
    the word;
  - the heading never shrinks below its own content and never breaks inside a
    word (`flex: 0 0 auto`, `min-inline-size: max-content`, `word-break: normal`);
  - the button is the half that gives, and may wrap its sentence over two lines;
  - the rail states a `min-width` as well as a `max-width`, so the column the
    panel lives in is 280px rather than a share of whatever it was dropped into.

  Both contradicted rules are inline styles rather than a class: a class of ours
  against `.ant-typography` or `.ant-btn` is decided by whichever stylesheet was
  injected last, which is not a decision.

  A new demo variant photographs the panel at the rail's own width — the only
  width at which the row is under any pressure — and a layout suite asserts the
  computed style of the rendered elements.

## 0.14.0

### Minor Changes

- 396e32e: The phone SERP's location row is one compact line again, and stops overlapping itself.

  Measured on a live 390×844 SERP, in both themes, on every result page — the
  category listing, the text search and every filter slice:

  ```
  {"kind":"clipped-left","t":"A chosen place on the map","x":-4}
  {"kind":"overlap","a":"· Within 25 km","b":"Filters","px":43}
  ```

  On screen that read as "…hosen place on the map · Within 25 kmlters", with the
  red active-filter plaque floating in the top-right corner of the page attached
  to nothing. At 1440 it was clean, which is why nothing before this caught it.

  **Three causes, none of them the flex row itself.**

  1. An antd `<Button>` CENTRES its content. `minWidth: 0` let the left half
     shrink and nothing clipped what was inside it, so the label overflowed its
     box symmetrically — off the left edge of the screen at `x = -4` and 43px
     across the word "Filters" at the other end. A shrunk box with no `overflow`
     is not a truncation, it is an overlap.
  2. Nothing declared which end may shrink. Both were `1 1 auto`, so a long place
     name took width from a word that must never lose any.
  3. The count was an antd `<Badge count>` — an absolutely positioned `sup` hung
     off the top-right CORNER of what it wraps. At the trailing edge of a
     full-width row that puts it outside the row entirely.

  **Now:** `place · radius` left, `Filters` right, on one line. The left half is
  the only one that grows or shrinks and it truncates with an ellipsis (`display:
block` on the label is load-bearing — `text-overflow` does nothing on a flex
  box, which is how the first attempt cut the name mid-glyph); the right half is
  `flex: 0 0 auto`; the count is a pill IN the flow beside the word it counts
  for. The place and the radius now share ONE truncating label, so the radius can
  no longer travel past the label's end on its own.

  The rules that had to reach inside the button ship as a hoisted stylesheet
  (`locationLineCss`, the pattern `<ListingCard>` and `<SkinCarousel>` use),
  since a descendant rule is not expressible as an inline style.

  `search-location-filters-badge` is now the trailing group rather than an antd
  `<Badge>`; the count carries `data-testid="search-location-filters-count"`, and
  the truncating label `data-testid="search-location-label"`.

  A new skin demo variant, `long-place`, photographs the measured case: a place
  name a geocoder really returns, at 390px, with a radius and a count on the same
  line.

## 0.13.0

### Minor Changes

- e76ab28: The default SERP card draws the photos — the whole gallery, not one, and not none.

  `<SearchResultCard>` read `card.image` as an object with a `url` key and fell
  back to `card.image_url`. Neither is a shape this fleet emits, so **every
  consumer that did not pass its own `renderCard` got a card with no photo at
  all**:

  - `image_url` is a convention nothing in the fleet writes. It was declared in
    `GENERIC_CARD_FIELDS`, drawn in the demos from a data URI, and never once
    served by a backend.
  - `card.image` IS emitted — `stapel-classified`'s search projection stores it —
    and it is a plain `<type>/<hash>` CDN reference **string**, not an object.
  - the one rich shape that exists (chat's subject card, which serves the same
    CDN render descriptor its attachments carry) has `ref` + `variants[]` and no
    top-level `url`, so the `"url" in rich` guard rejected it too.

  **What the card reads now** (`default/cardPhotos.ts`, unit-tested as data):
  `images[]` first — the whole seller-ordered gallery `stapel-classified` 0.7.0
  projects, capped by its `CARD_IMAGES_LIMIT` — with the singular `image` as the
  fallback for a doc type that never grew a list. Never both: `image` IS
  `images[0]`, so reading the singular after the list would draw the first photo
  twice. Each entry may be a CDN reference, a URL the doc type stored itself (a
  reference is `<type>/<hash>`: no scheme, no leading slash, so the two are told
  apart by shape and never by a guess), or a render descriptor, whose whole
  variant ladder survives so `<Image>` still has tiers to choose between.

  **How a reference becomes a picture: a new `resolveImage` seam** on
  `createSearchRuntime`, the same seam `@stapel/listings-react` states and the
  same function a container passes to both. No contract in this fleet resolves a
  stranger's reference — stapel-cdn's `file/exists/` is owner-scoped — so the
  deployment hands its own knowledge in once rather than having a library invent
  a URL convention nobody agreed to.

  **A gallery is a strip.** Two or more photos render as a `<SkinCarousel>` with
  the peek and the position indicator (one photo gets neither: a sliver of a next
  slide is an affordance for something that is not there). The strip is a
  **sibling** of the card's anchor, never a child — a horizontal swipe that ends
  inside an `<a>` can be delivered as a click, which is the defect that makes
  phone galleries unusable.

  **Three honest answers about a photo, drawn as three different things.** A card
  with no photo field reserves nothing (a text corpus is not a gallery with holes
  in it); a card whose references nothing resolved draws the well and _says_ the
  photo is unavailable — that is what an unwired `resolveImage` looks like, and a
  sentence gets it fixed where an empty grey box does not; anything else is the
  strip.

  BREAKING for a host that stored `card.image_url`: that field is no longer read
  (nothing in the fleet wrote it). Store the URL in `image`/`images` instead — a
  stored URL still needs no resolver.

  New i18n keys in all three bundles: `search.results.photos`,
  `search.results.photo_alt`, `search.results.photo_unavailable`.

## 0.12.0

### Minor Changes

- 8d1e20f: The phone dock stops truncating its labels, stops covering the footer, and the
  phone SERP gets a one-line toolbar instead of four stacked rows.

  **A compact label for a compact chrome.** `NavEntry.shortLabelKey` (core) is an
  optional second i18n key a manifest declares when its menu label cannot fit a
  dock cell. A five-item dock at 390px gives each destination about ten
  characters, and a label written for a menu row ellipsizes mid-word — a
  destination a person has to guess at, which is the one thing a dock must not
  produce. A key and not a length hint, because which words survive the cut is a
  translator's judgement: the useful short form of "Post a listing" is the verb,
  of "My listings" the noun, and no truncation rule finds either. `resolveNav`
  carries it through, `<NavDock>` prints it and keeps the LONG label as the
  link's accessible name; `listings-react` declares one for `compose` and `mine`.
  The dock also drops its inter-cell gap and one inset step — 24px given back to
  five labels — and `scripts/gen-nav-manifest.mjs` validates the new field.

  **The clearance belongs to the page, not the content.** The island is fixed
  over the last thing on the page, and the last thing is the footer. Reserving
  `DOCK_CLEARANCE` on `<Layout.Content>` cleared the final card and left the
  footer's legal links permanently under the island. `<PublicShell>` reserves it
  on the page column instead, and only when `dockRenders(nav)` says an island
  will actually be drawn — a one-entry nav used to get a strip of empty page
  under a dock nobody rendered.

  **A phone toolbar that is one row.** `<SearchResultsPane header="compact">`
  gives the toolbar its own line and puts the count directly above the cards as
  their caption, with the heading visually hidden but still in the document
  outline; the banner shape (heading | count + toolbar) is unchanged and
  remains the default. `<SortSelect compact>` drops the caption and the 200px
  floor so the control shares a row, and moves the blocked `distance` option's
  REASON into the option's own label — on a phone, where that refusal is most
  common, a separate reason row costs a band of viewport above the first result.
  `<FilterChips>` takes `geoChip={false}` for a surface that already states the
  location above it (the phone SERP mounts `<LocationSummaryLine>`, and the two
  together asked about one filter twice), and renders NOTHING when it would be a
  row of one button — a free-text query has no category, so the server returns no
  facet plan, and the row was a lone circle floating between two working filter
  affordances. `<LocationSummaryLine>` says "Filters", not "All filters": that
  end of the row shares 390px with a place name.

  **Tiles say which category they are.** `<CategoryTileGrid>` draws the
  category's own initial where art is missing, instead of a muted disc. A live
  catalogue put nine identical grey discs on one landing — every category there
  carries an empty `carousel_icon`, which is the state every catalogue is in
  until somebody uploads art — and a grid of them reads as nine images still
  loading. A letter cannot be mistaken for a pending image, and every tile
  differs from every other.

  **`visuallyHidden`** (tokens-antd `/skin`) is the fleet's one off-screen-but-
  announced style. It was written twice before, in `calendar-react` and
  `search-react`, and the two disagreed on `clip-path` versus the deprecated
  `clip`; both now import it.

- aa79a97: The result list gets a chip row a person can use, chips that print copy, a
  category narrowing, and a search box that can reach a category.

  **A facet a person cannot filter by is not a chip.** `FACETABLE_FEATURE_TYPES`
  / `isFacetableFeature` decide from the category's own schema — the select
  family, `bool`, and `attributes-react`'s own `VOCABULARY_BACKED_TYPES`,
  imported rather than retyped. `imei` and `video_file_url` leave both the chip
  row and the panel. Two edges are held on purpose: a group with NO feature def
  is KEPT (the schema slot is optional, and treating silence as "not facetable"
  would empty the row for every host that never threaded it), and a slug the URL
  already filters on is kept whatever its type, or a shared link would narrow a
  search with nothing on screen to widen it again.

  **The row's leading edge is the filters people use.** `orderChipFilters` sorts
  applied-first, then by band: core ranges (`facet_meta.core_ranges`), then
  counted facet groups, then the category's numeric attributes. A live
  classified deployment led with battery health and four delivery dimensions;
  it now leads with category, price, condition and brand. Nothing is deleted —
  `facet_meta.skipped` means the counter hit its field cap, not that the axis
  is unfilterable, and `r.<slug>` still answers for a skipped slug, so removing
  one on that signal would delete a working filter on a capacity report.

  **A chip prints copy, not a storage slug.** Precedence, now answer-first:
  `facet_labels` (the server saw the write-time snapshot) → the def's inline
  `options` → the host's `resolveFacetLabels` → the raw value. The host seam is
  batched per group through `useQueries`, cached, deduplicated across the three
  components that read the panel, and given the query's own `AbortSignal`; it is
  asked only about values nothing else named and cannot overwrite one that was.
  A value nothing resolves keeps printing itself — a chip that silently drops an
  option is worse than one showing a slug.

  **A category narrowing on the row.** `renderCategoryFilter` and the new
  `categoryLabel` reach `<FilterChips>` as the LEADING chip, opening the same
  sheet every other chip does. There is no category facet on any server and the
  index has no read path for one, so nothing here synthesizes counts. `hasChips`
  now renders a row holding only the category chip and still renders nothing for
  a row holding only the sliders circle.

  **The search box offers CATEGORIES.** stapel-search 0.7.0's `/suggest` answers
  a destination per row — the full ancestor path, the live count behind it, and
  a `category` string to pass verbatim to `/query`. `useSearchBox` surfaces
  `categories`, `categoriesUnavailable`, `categoryCountsUnknown` and
  `chooseCategory`, and `<SearchBox>` draws them as a labelled group above the
  term suggestions, each row printing the whole trail (which is what tells three
  same-named leaves apart) and its counted sentence. Choosing one clears the
  query text: keeping it would land the person on that section intersected with
  a title search for the word that found it, which is fewer results than the
  number they just tapped. A zero-count row is dropped — an empty section is a
  dead end dressed as a destination — except under `category_rollup`, where the
  zeroes mean the ancestry never arrived and it is the NUMBERS that are omitted.
  `SuggestAnswer` deliberately widens the generated response type, whose fields
  are all required: a pair typed against it would compile while reading
  `undefined` from a field the compiler swore was there. An older server that
  sends no `categories` key, and one that reports `category_suggestions` in
  `degraded`, both draw no group at all — never an empty one, and nothing
  anywhere says the catalogue has no matches.

  **Nav labels.** `search.results` stopped borrowing `search.results.title` from
  the results heading: one key was carrying the name of a DESTINATION and the
  name of a LIST, and they diverge the moment the destination is a tab.
  `search.nav.results` / `search.nav.ranking` are the nav's own, and the
  disclosure entry declares a `shortLabelKey` for a phone dock.

## 0.11.0

### Minor Changes

- The three things a buyer's SERP owes them, measured missing on a live classified board.

  **A price filter.** The panel offered seven numeric ranges — parcel weight, length,
  height, width, packing quantity, minimum-order quantity, battery condition — and no
  price, because a range row was only ever drawn for a CATEGORY FEATURE and price is a
  column of the listing. `buildRangeGroups` now takes `coreRanges` from the answer's
  `facet_meta.core_ranges` (stapel-search 0.4.0) and draws those axes FIRST, marked
  `core: true`. It comes from the server on purpose: hardcoding `"price"` would have
  fixed that board and broken the next one, where `r.price` still answers zero. The
  row reads as money — the corpus currency is read off the cards of the same answer,
  so no host wires anything — and the unit now shows in the row heading, where until
  now it existed only in an `aria-label`.

  **Captions, not storage slugs.** `buildFacetGroups` takes `facetLabels` from the
  answer (`{slug: {translatable, values}}`) as the FLOOR under `categoryFeatures`. The
  schema still wins where it resolves — the client fetched it with its own
  `Accept-Language` — but the schema slot is OPTIONAL, a live board never filled it,
  and its buyers read "Condition: b-u", "Listing kind: prodayu-svoe", "Screen
  condition: bez-defektov" on the SERP and in the filter chips. A caption that arrives
  with the counts cannot be forgotten by a host. `translatable` says whether the
  caption is a key or literal text, because the reader cannot tell by looking.

  **No engine diagnostics in a buyer's face.** Every query, for every buyer, raised a
  full-screen yellow "What this search could not do: synonyms were not substituted —
  the search engine in use cannot do this" between the sort control and the first
  card. New `degradationAudience` / `readerFacing` split `degraded[]` by who it is
  addressed to: `typo_tolerance`, `phrase_synonyms` and `exact_total` describe the
  ENGINE somebody licensed and no longer reach a reader; `category_rollup`,
  `exact_facet_counts`, `scorer:` and unknown literals change what the page MEANS and
  still do. Note what the fix is not — the string was not deleted and the kind was not
  special-cased; the audience got a name, so the next engine-capability literal is
  filtered by the same rule. `<DegradationNotice variant="debug">` shows everything,
  for a status page.

  Contract re-pinned to stapel-search 0.4.0 (`>=0.4 <0.5`).

## 0.10.0

### Minor Changes

- c887a5a: **The SERP gets the row that says where it is looking: `<LocationSummaryLine>` on `/default`, and a `resultsHeader` slot on `<SearchPage>` to put it in.**

  **Why location gets a line of its own when it is already a chip.** The chip row SCROLLS: the geo chip is one of eight and it is off screen the moment somebody has scrolled to "Year". Location is the one constraint on a classified that changes what a result MEANS rather than narrowing a set — "1 200 €" is a different offer in the next city — so it is the one that has to be readable without scrolling anything. Left: a pin, the place, and the radius. Right: the filter affordance with a COUNT.

  **The count, not a dot, and it is the same count.** `<FilterChips>`'s leading chip is a 32px circle, so it shows a dot — a number inside it is a number nobody reads. This is a full-width row with a word on it, so the badge says HOW MANY constraints are applied, which is the difference between "something is filtered" and "four things are, and that is why there are three results". Both read `activeFilters` off the URL state; there is no second counter.

  **Still never a coordinate.** This pair holds a `lat` and a `lon` and no geocoder, so the line prints the name it was HANDED (`geoLabel`), or says a place is chosen, and adds the radius — which IS a number this pair owns (`radius_km`). With nothing applied it says the search is looking everywhere, which is both the truth and the invitation to narrow it. `test/locationSummary.test.tsx` repeats `geo.test.tsx`'s negative assertion for the new surface: no digit of the point reaches the DOM.

  **One location sheet, two doors.** The geo chip's bottom sheet moved into `geoSheet.tsx` and both surfaces mount it, because on the ref both rows carry a location control and a person tapping either must land in the same place. Two copies of a sheet is two places for "clear the location" to drift. `<FilterChips>` keeps its existing test ids; the summary line has its own, so a page holding both rows never hands a test two elements under one name.

  **`resultsHeader` is a NEW slot, and the four existing ones were each checked first.** `filtersHeader` is inside the filter panel — on a phone that is behind the sheet, which is precisely where a location summary must not be. `breadcrumb` renders in the right position but names a walk up the CATEGORY tree, so a host wanting a trail AND a location row would have had to choose. `resultsHeading` and the pane's `toolbar` are inside the results pane, below the chips. Nothing sat between the search box and the filters, and that gap is exactly where the ref puts this row. It renders in the page's vertical stack, so it spans the full width in both layouts — above the chip row on a phone, above the two columns on a desktop — because what it states describes the whole page, not the results column of it.

  **Saved search is still not here.** The "notify me about new ones" control remains the host's, in the existing `resultsAction` slot, and remains a STUB there: there is no saved-search backend, no subscription, no schedule and no consent record, and this release does not pretend otherwise.

  New key in en/ru/es: `search.geo.everywhere` — deliberately not a reuse of `search.geo.clear`, which is the label on a BUTTON that widens the search. The two are the same word in English and diverge the moment a translator reads one as an imperative.

- 835526f: **"How many results would this give me?" is a hook now — and it says out loud that the backend has no way to answer it cheaply.** `useSearchCount(state)`, headless, from the package root.

  A quick-search panel's button ("Show 128 listings") has to know the total for a state that is not on screen and not in the URL: the person is still composing it. `<SearchResults>` cannot answer that — it reads the committed URL state — and `useAppliedCount` deliberately reads the page already in cache rather than issuing a search of its own. So this is a read over a state the caller hands in, and it returns the fleet's shape for one: `LoadState<{ count: number | null; kind: SearchCountKind }>`.

  **There is no count-only endpoint, and this hook rides the full query on purpose.** `SearchApi` is `query`, `suggest` and `ranking`; nothing answers "how many" without also assembling a page. So the request is the ordinary `/query` with `limit=1` and `facets=off`, and the total comes out of the envelope. That has a real cost — the engine still ranks the candidate set — and it is written into the hook's doc comment rather than hidden behind a name that sounds cheap. **Follow-up for stapel-search:** a `GET /count` verb answering the three count fields plus `degraded[]` and nothing else. When it lands, this hook's body changes and its signature does not.

  **What is dropped from the state is the interesting half.** `anchor`/`direction` go, because a cursor asks about a PAGE and a count is about the whole set (keeping one would also cache the same total once per page somebody walked through). `sort` goes, because the total does not depend on the order and keeping it would miss the cache on every sort change. `facets` goes to `"off"`, because counting facets is the expensive half of a request that draws no facet panel. Everything that changes the ANSWER — `q`, `category`, `owner`, filters, ranges, geo, `lang` — is sent exactly as a real search would send it. `countQueryState()` is exported so this is readable rather than inferred.

  **The debounce is the mitigation the endpoint gap forces.** The FIRST state is asked about immediately — a panel that opens should not wait a quarter second to say its number — and every change after that is coalesced onto the LAST one (`SEARCH_COUNT_DEBOUNCE_MS`, 250ms; `0` disables it). Typing "hond" then "honda" asks once, about "honda", never about "hond" late. `enabled: false` holds the hook at `loading` for a panel still resolving its category.

  **The kind travels with the number.** `"exact"` is a total, `"at_least"` is a floor, `"unknown"` is the engine declining to say — and `count: null` under `"unknown"` is never rendered as `0`. That is the same contract `state/degradations.ts` states for the results page, reused rather than restated, so a counted button cannot drift from a counted heading.

  Also exported: `SEARCH_COUNT_PAGE_SIZE`, `SEARCH_COUNT_DEBOUNCE_MS`.

## 0.9.1

### Patch Changes

- d1125bc: Regenerated against the attributes-v2 contract pins: stapel-categories 0.7.0,
  stapel-listings 0.10.0, stapel-search 0.3.1.

  What moves in the wire types: `FeatureCompact` and `ResolvedFeature` gain
  `rules`, `description`, `example`, `default`, `hints` and `group` — the form
  metadata an imported catalogue actually carries, which is what
  `<FeatureFields>` draws sections, help lines, placeholders and hints from
  instead of a host's hand-written table; `Category` gains `external_id`; the two
  vocabulary-backed value types (`ref_select`, `ref_hierarchical_select`) appear
  in the type enums; and the error registry gains
  `error.400.feature_invalid_rules`.

  search-react's regen is contract metadata only — the facet mapping for the two
  ref types (`term` / `path`, and no `closed_options` for any config carrying an
  `optionsRef`) is decided server-side in stapel-search 0.3.1 and reaches this
  pair as facet rows, not as a new surface.

## 0.9.0

### Minor Changes

- e1b1d9b: **A location is now said in words, and a search can open where the visitor is.** `geoLabel` and `defaultGeo` on `<SearchPage>`; `geoLabel` on `<FacetPanelPane>` and `<FilterChips>`; `defaultGeo` on `<SearchStateProvider>`.

  **The panel printed coordinates.** Under the "Location" heading, on the desktop rail and on the phone's location chip, a person who had chosen a place on a map read `Around 55.756, 37.617`. That is the pair's own storage leaking onto the screen: `lat`/`lon`/`radius_km` are URL parameters because the URL is the state, and none of that is a display concern. Two numbers to three decimals cannot be checked by the one reader who could have checked an address — so a point that landed in the wrong suburb looked exactly as authoritative as the right one, and the right one looked like machinery. It is the same defect class this pair is careful about everywhere else: a value rendered as if it were an answer, when nobody can tell whether it is.

  **`geoLabel`** is what the constraint is CALLED. Whoever turned an address into that point still has the address — the geocoder's own answer, the city an IP guess named, the text on the map pin — and hands it back: `geoLabel="Tverskaya, Moscow"`. Set it once on `<SearchPage>` and both filter surfaces take it, so the chip row and the rail cannot drift into describing the same URL two different ways. Without one the line reads **"A chosen place on the map"** (`search.geo.chosen_place`, en/ru/es) — an honest sentence about a place this package genuinely cannot name, because naming it needs a geocoder and a search package must not grow one to fix a bad line. `search.geo.center` (`"Around {lat}, {lon}"`) is **removed** from the key registry and from all three bundles; the bbox sentence is unchanged, since an area on the screen was always describable without measuring it.

  **`defaultGeo` — the search opens where the visitor is.** A storefront that knows roughly where somebody is standing should not make them type it: a granted browser prompt, or the server's IP guess when there was none. The host resolves it — `usePermission("geolocation")` and a geocoder both live outside this pair — and passes the two numbers in. The page still does not know what a map is.

  Everything hard about the feature is about not overruling anybody, and the URL is what makes the rules statable:

  - **Only into a URL that carries no geo at all.** A link with `lat`/`lon` or `bbox` already means a place, and it must mean the same place for everyone who opens it. A default that overwrote it would turn one address bar into two different searches.
  - **Once, and never again after a clear.** Tracked as "has anyone spoken about location yet" in a ref, not by comparing the default against the current value — a cleared location and an unapplied default are identical in the state, and only the record of who spoke tells them apart. `setGeo` marks the question answered, including when the answer is "anywhere".
  - **Late is fine.** A permission prompt and an IP round trip both resolve after the first paint, so `undefined` on mount and a value three renders later still applies — provided the URL is still empty of geo at that moment. The prop is typed `SearchGeo | undefined` for exactly this, so a host passes what it has without a conditional spread.
  - **It replaces the history entry rather than pushing one.** The visitor did not perform this change; Back should leave the page, not undo a centring they never asked for. The adapter seam has carried `{ replace: true }` since it was written, and the react-router binding honours it.

  Tests cover all four rules plus the wire the centred search actually goes out on, and assert the coordinate's own digits appear nowhere in the rendered page — on either surface, in a chip, a heading or an aria-label — because a future sentence that quietly reintroduces them under a different key is the same defect.

## 0.8.0

### Minor Changes

- 62c70ac: The classified layout, in the default skins.

  Built where the doctrine says the product lives, so every future classified
  deployment gets it rather than rebuilding it.

  - `shell-react` — `NavDock`, a floating translucent island rather than a flat
    bar: inset from every edge, real border and shadow, safe-area aware. The
    glass is progressive enhancement, not the design — the opaque elevated fill
    is the base and the blur is swapped in only inside an `@supports` for
    `backdrop-filter`, so text contrast never depends on transparency being
    available. Destinations are the first five top-level nav entries in the
    order the manifest already declares, so there is no second selection axis.
    Real links, `aria-current`, and the badge count folded into each link's
    accessible name.
  - `search-react` — a phone gets a scrollable chip row instead of one
    "Filters" button, each chip opening its own `SkinDialog`, and chips carry
    the CHOICE rather than the group name. A desktop gets a sticky full-height
    rail. Both render through one `FacetGroupControl`, so the rail and the
    sheets cannot drift into two implementations — and a group's shape is
    derived from the schema keys the composer's editor already reads
    (`maxSelected: 1` → pills, `hierarchical_select` → indented children)
    rather than a new presentation flag. Plus a list/grid view switch, which is
    not URL state because it changes how an answer is drawn and never what it
    is.
  - `listings-react` — the whole card is one real anchor: photo, price, title
    and location inside it, the favourite heart a sibling button outside it so
    the link cannot swallow it. The separate "open" control is gone and its
    i18n key is retired. Middle-click, open-in-new-tab and crawlers still work,
    and the anchor's accessible name is the title alone.

  Parts of the reference layout that do not fit a generic contract are slots
  with a stated reason rather than invented content: "notify me about new ones"
  (a saved search has an owner, a schedule and a consent record this pair has
  none of), the breadcrumb (a walk up a tree search cannot see), and map view
  (a `SearchView` whose tiles belong to geo-react).

## 0.7.0

### Minor Changes

- 9545a2f: Search: the five blank stories, the phone filter path, money, and the dark scope

  **Five stories rendered nothing.** `results-pane--*` and `filter-panel--*` crashed on
  `data.items.filter` / `data.facet_meta.skipped` — 15 blank shots, including the designed
  empty state. The seeded demos wrote the answer into the query cache and `useSearchQuery`
  sets no `staleTime` (drill-down facets must never serve a stale page), so TanStack
  refetched on mount and the demo `fetch`, which had no handler for a variant that seeded
  instead of mocking, replaced the page with `{}`. A seed now mounts as a handler too, and
  an UNMOCKED path answers 503 rather than an empty 200, so a forgotten handler renders the
  pane's "we could not run this search" arm instead of a white screen.

  **The phone filter sheet had no visual evidence at all** — the only filter path a phone
  has, reachable only by a tap. `<SearchPage defaultFiltersOpen>` opens it on mount (for a
  container that deep-links into the filters), and `search.filter-sheet` photographs it.
  Its commit button now says **"Show 25+ results"** (`useAppliedCount`, cache-only — no
  second request), the sheet no longer prints "Filters" twice (`FacetPanelPane heading`),
  and the opener drops the "(0)" until something is applied.

  **Money.** `3200 RUB` → `₽3,200`, through core's `useFormat().number` with
  `style: "currency"` — the same `Intl` path `@stapel/currencies-react`'s `formatMoney`
  takes. Non-numeric prices pass through; an unusable code falls back to a grouped number.

  **Contrast, touch targets, orphans.** The DSA "Promoted" tag was `warning-on` (white)
  over `warning-bg` (cream) — the one legally mandated string in the package, at ~1.2:1;
  it is `warning` now, in both themes. Degradation banner lines drop `type="secondary"`
  (grey on the warning tint failed AA). `size="small"` is gone from the range Apply/Clear,
  the category/geo/clear-all buttons, so the shared skin's 44px phone control height
  applies. The range Apply is primary when there is something to apply, not before. An
  unfilled `renderGeoFilter` no longer leaves a "Location" heading over empty space in a
  production build, and a facet group with no options draws no heading.

  **Copy.** Scorer slugs are named from the ranking disclosure the pair already fetches
  (`geo_decay` → "Distance"); skipped facet slugs from the category schema (`power_w` →
  "Power"); `applies_to_sorts` through the sort control's own labels; the weight tag is
  labelled; the unreadable-link notice says "price", not `r.price`, and no longer explains
  `from..to` or `lat`/`lon`. New keys `search.filters.show_count{,_at_least}` (plural
  families) and `search.limit.from_link`, in en/ru/es.

  **Layout.** The desktop filter rail is a fixed 280px instead of `Col md={7}` (measured at
  45% of a 1280px page). Result cards carry the photo well filled (`fit` needs a box when
  the snapshot has no aspect) and the whole row is one link when the doc type stores
  `card.url`. The three superseded headless debug-dump demos are gone; their components are
  covered by the skin demos that supersede them.

## 0.6.0

### Minor Changes

- 80617e9: The search page can start a search.

  `setText` had zero callers in the entire repository: the codec carried `q`, the state
  machine could set it, the request sent it, and no screen could type one. Six of the nine
  state setters had no control at all. This release is the missing half of the pair.

  - **`<SearchBox>`** — the query box, debounced (350ms, `replace: true`, so ten letters are
    one history entry), capped at the server's own `MAX_QUERY_CHARS`, with a typeahead over
    `GET /suggest` — an endpoint that had been typed and unreachable since 0.1. `useSearchBox`
    is the headless half; `useSuggest` the hook. Exported, so a container's header can mount
    the same box the page does (`searchBox={false}` then keeps exactly one on screen).
  - **Range filters** — `r.<slug>=from..to` finally has a control. `state/ranges.ts` decides
    which rows exist (numeric features of the category schema, plus any slug the URL already
    constrains); `<RangeFilterRow>` commits on Apply and refuses a backwards range with the
    reason beside the button instead of returning an empty page.
  - **Category, location, language and page size** — `renderCategoryFilter` and
    `renderGeoFilter` are named slots the categories/geo pairs fill, with `SlotPlaceholder`
    where they are not; either way a constraint that arrived in a shared link now has a control
    that widens it again (clear the category, adjust or clear the radius). `<LanguageSelect>`
    and `<PageSizeSelect>` bind `setLanguage` and `setLimit`.
  - **No reason lives in a hover any more.** The pager, the distance sort and the DSA Art. 26
    `promoted` explanation were all `title=`/`<Tooltip>` — invisible on every phone and on
    every disabled button. They are visible text now (`GatedButton`/`GatedControl`, and plain
    copy under the marking). The pager is absent, not dead, when there is nothing to page.
  - **The generic card draws `image_url`** through `@stapel/image` (new optional peer), in an
    aspect box, with the promoted tag on a `--stapel-*` role instead of antd's `gold` preset.
  - **On a phone the filters are a bottom sheet** behind a "Filters (N)" button, through the
    shared `SkinDialog`, instead of a full-width panel stacked above the first result.
  - **The pair's `theme.tsx` and `ErrorAlert.tsx` are deleted** in favour of
    `@stapel/tokens-antd/skin`'s `SkinTheme` / `ErrorAlert` / `EmptyState` / `LoadList`.
    `SearchSkinTheme` is no longer exported (pre-1.0 breaking = minor): import `SkinTheme`
    from the substrate — same props, and a runtime `data-theme` flip repaints it.

  Peers: `@stapel/core >=0.18.0`, `@stapel/tokens-antd >=0.6.0`, `@stapel/image >=0.3.0`
  (optional — only the `/default` skin needs it). The `/default` size budget moves 13 KB → 16 KB.

### Patch Changes

- 308e3d6: Every `/default` surface is drawn, seeded and photographed.

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

## 0.5.0

### Minor Changes

- d778c54: `<SearchPage>` stops laying out a column for filters that do not exist, and
  stops printing a second heading over the list.

  - The filter column was unconditional. On a deployment whose search plan
    declares no facets that spent a quarter of `/s`, of every category page and
    of every seller page on an illustration saying "no filters for this search" —
    three screens with a hole in them. The page now asks the facet bag what it
    has and gives the results the whole width when the answer is a LOADED zero.
    `loading` and `failed` keep the column: a panel that has not answered yet is
    not a panel with nothing in it, and a layout that reflowed mid-load would be
    worse than the hole. An active filter keeps it too.
  - `resultsHeading` / `<SearchResultsPane heading>`: what this surface calls its
    list. "Results" is only right when the person performed a search — a
    landing's newest-first strip, a seller's page and a category page each wrote
    their own caption above the pane and got "Results" underneath it a moment
    later. The name now goes INTO the heading row that already exists.
  - `filtersHeader`: a slot at the top of the filter column, for a filter this
    pair cannot ship. `SearchQueryState` has carried `geo` since 0.2 and
    `<SortSelect>` already disables "by distance" with the reason "no centre
    set", but nothing here could ever SET one — turning an address into a
    coordinate needs a geocoder, and a geocoder is the deployment's. Whatever a
    host renders here reads and writes the same URL state as the facets beside
    it.
  - `useFacetPanel()` is exported: the same bag as `<FacetPanel>`, for a caller
    that must know what the panel will render before it renders it. A render prop
    cannot answer a question asked one level up.

## 0.4.0

### Minor Changes

- 2d93b52: The count stops lying, and the banner stops crying wolf.

  The pair now reads stapel-search 0.2.0's count contract (pin `v0.2.0`): `count`
  is nullable, `count_is_lower_bound` marks a floor, and `exact_total` describes
  the answer rather than the engine. `page.countKind` turns the three wire fields
  into one decision — `"exact"` renders «25 объявлений», `"at_least"` renders
  «1200+ объявлений» through `tPlural` (a new `search.results.count_at_least`
  family in en/ru/es), and `"unknown"` renders **no count line at all**. The
  state this replaces printed «Примерно 0 объявлений» over four visible cards on
  the live storefront: 0.1.0 had no way to say "we do not know" except `0`.

  `<DegradationNotice>` no longer raises a warning banner for a `degraded[]` that
  contains ONLY `exact_total`. It is a count nuance, not a failed search — the
  rows are right and the consequence is already spoken by the count as "N+" —
  and a banner that cries wolf on every landing page is one nobody reads on the
  day `category_rollup` shows up in it. Beside any other degradation it renders
  as before. Volume is now the container's call: `<SearchResultsPane>` and
  `<SearchPage>` take `degradationNotice?: "banner" | "inline" | "off"`
  (default `"banner"`), so a landing page can pass `"inline"` or `"off"`.

  New exports: `countKind`, `isCountNuanceOnly`, `SearchCountKind`,
  `DegradationNoticeVariant`. `SearchPageInfo.count` is now `number | null` and
  gains `countIsLowerBound` / `countKind`; `countIsEstimate` (both the helper and
  the bag field) is deprecated — it cannot see `count: null`.

## 0.3.1

### Patch Changes

- **Peer floor raised to `@stapel/core >=0.17.0`.** `SearchResultsPane` calls `useTPlural`, which first shipped in core 0.17.0, while the declared floor still said `>=0.15.0`. Inside the monorepo every package compiles against the workspace peer and never against its own floor, so nothing here could have caught it — only a consumer installing at the floor would have, after the release, with a runtime `undefined is not a function` on the results heading. `check:peer-floors` reads each peer's release tags and now sees it; this is the fix, not a suppression.

## 0.3.0

### Minor Changes

- 5246040: A result page that reads like one: plural counts, a grid, and one of each label

  Three findings from a walk over the live storefront, all of them in the pane a
  visitor spends the whole session looking at.

  **The count is counted copy.** `"Примерно {count} объявлений"` was one Russian
  string for every number — right for 5–20, wrong for 1, 2, 3, 4 and 21, which is
  most of the pages a catalogue actually serves. Both count families are now
  CLDR plural families (`.one` / `.other` in en and es, `.one` / `.few` / `.many`
  / `.other` in ru) rendered through core's `tPlural`, and the parity test asks
  `Intl.PluralRules` which forms each locale can land on instead of checking a
  hand-written list. `SEARCH_I18N_PLURAL_KEYS` names the families for a host
  overriding the copy: **a host bundle that overrides
  `search.results.count_exact` / `…count_approximate` should move to per-category
  keys** — the flat key still renders (core falls back to it) but with one ending
  for every number, which is the defect.

  **The results are a grid.** `<Flex vertical>` made every page a one-column
  full-bleed stack; a 1400px catalogue drew two enormous cards and a screenful of
  white. The default is now `repeat(auto-fill, minmax(280px, 1fr))` — as many
  columns as fit, each at least a readable card, one column on a phone, no
  breakpoints to maintain. `renderResults(items)` is the new layout slot above
  `renderCard`: a container that wants a table, a masonry wall or a list beside a
  map replaces the grid entirely, and the pane keeps its four load arms, so
  "nothing matches this search" is never the slot's problem.

  **One heading and one sort control.** `<SearchPage>` captioned its toolbar
  "Results" and then mounted a pane whose own heading says "Results"; the sort
  control printed its label and then repeated it as the select's placeholder,
  with no value showing. The pane now owns the heading row and takes a `toolbar`
  slot beside the count (that is where `<SortSelect/>` goes), the placeholder is
  gone, and `useAppliedSort()` — a new headless hook — reads the sort the SERVER
  reported for the page already in cache, so a URL with no `sort` shows what the
  results are actually ordered by. It subscribes with `enabled: false`: the same
  query key the pane fills, never a request of its own.

## 0.2.0

### Minor Changes

- 6356af8: New package: `@stapel/search-react` — the frontend pair for stapel-search, and
  the one surface a storefront's catalogue, category and search pages all come
  from.

  ```tsx
  const runtime = createSearchRuntime({ baseUrl: "/search/api/v1/" });
  <SearchProvider runtime={runtime}>
    <SearchPage adapter={useRouterSearchParams()} defaultType="listing" />
  </SearchProvider>;
  ```

  No session, no workspace id, no auth client: every endpoint it calls is
  `AllowAny`, so a catalogue renders for a visitor who will never sign in.

  **The URL is the state.** Text, category, facet filters, ranges, geo, sort, page
  size and the keyset cursor all live in the query string, under the backend's own
  parameter names, and no component keeps a second copy. Copying the address into
  another tab reproduces the page, Back removes exactly the last filter, and a
  reload loses nothing — by construction rather than by discipline. Changing any
  of them drops the keyset cursor, because `anchor` is a position inside one
  ordered candidate set and carrying it across a filter change answers page 4 of
  a different search. The router is a two-member seam (`SearchParamsAdapter`);
  `./router` binds react-router's `useSearchParams`, and a Next.js app or a plain
  `URLSearchParams` satisfies the same shape.

  **Facets are drill-down, and the panel shows it.** Each is counted with its own
  filter removed, so picking a value leaves its siblings with the counts you would
  get by switching to them; closed sets keep their authored order, zeros included.
  The server sends no option labels — they are keys in the category's feature
  schema — so `categoryFeatures` is an explicit input and the captions resolve
  through `@stapel/attributes-react`'s `formatFeatureValue`, the same formatter a
  card uses.

  **What the server admits, the screen repeats.** `exact_total: false` renders as
  "about N", `facet_meta.approximate` says the counts are a sample, a skipped slug
  shows "not counted" rather than `0`, and every `degraded[]` literal becomes a
  line in a banner — including one this build has no wording for, which arrives
  with its raw text. A failed search says "we could not run this search" with a
  retry, and `error.400.search_window_exceeded` says "narrow the search"; neither
  is ever spelled "nothing found".

  `promoted` (DSA Art. 26) rides every item under every sort and reaches the card
  slot whole, so a storefront's own `<ListingCard>` can still mark it; the P2B
  Art. 5 ranking disclosure ships as a headless bag and a page, listing even the
  parameters the configured engine cannot evaluate.

  `./default` is the antd skin (`SearchPage`, `SearchResultsPane`,
  `FacetPanelPane`, `RankingDisclosurePane`); the main entry carries no antd and
  no router.
