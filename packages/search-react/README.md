# @stapel/search-react

The frontend pair for **stapel-search**: a storefront's catalogue, category and
search pages, all three from one endpoint — with drill-down facets, geo, sorts,
keyset paging, the DSA Art. 26 `promoted` marking and the P2B Art. 5 ranking
disclosure.

Business + state in the main entry, zero visual opinion; the antd skin lives
behind `./default` and the react-router binding behind `./router`, so a host
that renders its own visuals carries neither. Built on `@stapel/core` (typed
client + `StapelApiError` envelope, `LoadState`, i18n engine, analytics seam,
TanStack Query) and `@stapel/attributes-react` (facet value display).

## Install

```
pnpm add @stapel/search-react @stapel/core @stapel/attributes-react @tanstack/react-query react
# for the default skin:
pnpm add antd @stapel/tokens-antd
# for the react-router URL binding:
pnpm add react-router
```

## A search page, in eight lines

**No session, no workspace id, no auth client** — every endpoint this pair calls
is `AllowAny`, so a catalogue renders for a visitor who will never sign in:

```tsx
import { createSearchRuntime, SearchProvider } from "@stapel/search-react";
import { SearchPage } from "@stapel/search-react/default";
import { useRouterSearchParams } from "@stapel/search-react/router";

const runtime = createSearchRuntime({ baseUrl: "/search/api/v1/" });

export function SearchRoute() {
  return (
    <SearchProvider runtime={runtime}>
      <SearchPage adapter={useRouterSearchParams()} defaultType="listing" />
    </SearchProvider>
  );
}
```

In an app that already has a session, put the search client on core's provider
alongside the others and keep one client per module:

```tsx
<StapelProvider client={authRuntime.client} clients={{ search: runtime.client }} i18n={i18n}>
  <SearchProvider runtime={runtime}>{app}</SearchProvider>
</StapelProvider>
```

## The URL is the state

Text, category, facet filters, ranges, geo, sort, page size and the keyset
cursor all live in the query string — under the **backend's own parameter
names**, so a browser URL *is* the API query string and a pasted link is a
request anyone can replay with curl:

```
/s?type=listing&q=drill&f.brand=bosch&f.brand=makita&r.price=100..500
  &lat=55.75&lon=37.62&radius_km=25&sort=price_asc&anchor=…
```

No component keeps a second copy, which is what makes all three of these
properties hold by construction rather than by discipline:

| You do this | This happens |
|---|---|
| copy the address into another tab | the same results |
| press Back | exactly the last filter comes off |
| reload | nothing is lost |
| change a filter while on page 4 | you land on page 1 — the cursor is dropped |

That last row is not a nicety. `anchor` encodes a position inside **one**
ordered candidate set; carried across a filter change it either gets refused or,
worse, honoured against a different set. `patchSearchState` drops it for every
change that is not itself a page move, so no call site has to remember.

**A value equal to its default never rides along.** `type`, `sort` and `limit`
are written to the address only when they DIFFER from the default the host
declared (`defaultType`, `defaultSort`, `defaultLimit`) — a catalogue with one
doc type no longer carries `?type=listing` on every single link. Reading is
unaffected: `parseSearchState` fills the same default whether or not the
parameter is there, so the round trip is exact either way.
`writeSearchState(state, base, keys, { defaultType, defaultSort, defaultLimit })`
takes the same three, for a host composing its own address.

**Which change gets its own Back step.** A press has to be undoable one filter
at a time, and that only works if the change that applied the filter opened its
own history entry — `DEFAULT_HISTORY_MODE` is the one table stating which
change kind does:

| Change | Mode | Why |
|---|---|---|
| a facet value, a range, a partition/category, geo, sort | `push` | each is a decision worth its own Back step (spec §4.2) |
| the search box | `replace` | one history entry per keystroke would make Back useless |
| a keyset page move | `replace` | scrolling, not a decision — Back from page 3 leaves the results, it does not page backwards forever |
| a page size | `replace` | a preference, not a narrowing |

Every mutator `useSearchState()` returns follows this table; a host calling
`patch()` directly still chooses its own `replace`.

**Short feature keys.** The importer's type suffix carries nothing a reader can
act on — `f.make_ref_select=toyota` says *make* once and *how the column is
stored* once — so the address uses the short form the ANSWER states:

```
/c/avtomobili?f.make=toyota&r.year=2015..2020
```

stapel-search 0.14.4+ derives it per request inside the queried category's
scope (`facet_labels[slug].url_key`: the slug minus its suffix where that stays
unambiguous, the slug itself otherwise) and accepts both forms. This pair
**writes** `url_key` and **reads either**, so an old link keeps working and a
collision keeps the slug on both sides. Nothing is renamed and nothing is
stored: the slug is still the feature's identity, and the request this pair
sends carries it.

The map travels with the answer — `useSearchQuery` publishes it up to
`SearchStateProvider` (`usePublishFacetKeys`, `useFacetKeys`), which re-parses
the URL with it and writes every later address through it. Before the first
answer, and against a server that states none, the address is spelled in slugs
exactly as it was. The codec itself stays pure: `parseSearchState(params,
{facetKeys})`, `writeSearchState(state, base, facetKeys)`, and
`buildFacetKeyMap` / `facetKeyMapFromLabels` to make one.

**Any router, or none.** `SearchStateProvider` takes a `SearchParamsAdapter` —
two members, shaped exactly like react-router's `useSearchParams()`. `./router`
ships that binding; a Next.js app, a hash router or a plain `URLSearchParams` in
a test satisfy the same seam.

## The search box reaches the catalogue, not only the titles

`GET /suggest` (stapel-search 0.7.0) answers CATEGORIES as well as title
prefixes, so typing a section's name offers the section. `<SearchBox>` draws
them as their own group above the terms — each row the ancestor path plus its
live listing count, which is the only way to tell three same-named leaves
apart — and selecting one narrows the SERP using the server's own `category`
string, verbatim.

An older server sends no `categories` key and the box behaves exactly as it
did. When the answer says `degraded: ["category_suggestions"]` the group is
absent rather than empty: an empty group under a heading would claim the
catalogue has no such section.

## Facets are drill-down, and the panel says so

Each facet is counted over the candidates **with its own filter removed**
(`stapel-search/facets.py`). So picking *Bosch* does not zero *Makita*: its
count stays what you would get by switching to it. Closed option sets arrive
exhaustively, zeros included, and keep their authored order.

The server does not send option **labels** — they are translation keys in the
category's feature schema. Hand that schema in and the options read as words:

```tsx
<FacetPanelPane categoryFeatures={features} />   // from categories-react
```

Without it, options read as raw index terms. Never as blanks.

That schema also decides **which counted slugs are filters at all**: a plan
derived from a category counts what is indexed, so a real answer carries `imei`
and `video_file_url` beside `condition` and `vendor`. Only the bounded option
types (`FACETABLE_FEATURE_TYPES`) get a chip. A slug with no feature def is
kept — silence is not a verdict — and so is any slug the URL already filters on,
so a link can always be widened again.

A `ref_select` facet carries a POINTER to a vocabulary and no options, and a
server older than stapel-search 0.4.0 sends no `facet_labels` to cover for it.
`resolveFacetLabels` is the host seam that names those values — batched per
group, cached, aborted on supersession:

```tsx
<SearchPage
  categoryFeatures={features}
  resolveFacetLabels={async ({ slug, feature, values }, { signal }) =>
    await vocabulary.captions(feature, values, { signal })
  }
  renderCategoryFilter={(slot) => <CategoryPickerField {...slot} />}
  categoryLabel={currentCategory?.name}
/>
```

Precedence is `facet_labels` → the schema's inline `options` → this resolver →
the raw value; a value nobody names keeps printing itself. `renderCategoryFilter`
also becomes the leading chip of the phone filter row, which is where the
catalogue's deeper levels are chosen on a result list.

## A heading is named by the server, or it is marked

Group headings and option captions resolve in one order and one only:
`facet_labels` from the answer → the category feature definition → the raw
slug. The last arm is not a fallback anyone ships: it renders (a heading a
person cannot read still beats options with no heading), and it renders
**marked** — `labelSource: "none"` on the group, `data-label-source="none"` on
the drawn control, and one `console.warn` per slug outside production. A
storefront's own test asserts on that attribute; measured on a live cars branch
the whole rail was raw slugs and the complaint that came back was "I cannot
pick a make".

Every `FacetGroup` and every `FacetOption` carries `labelSource:
"server" | "schema" | "host" | "none"`, so "did anybody actually name this?" is
answerable without looking at the string.

## The rail is in schema order, required first

The panel used to rank its groups by **evidence** — the sum of an axis's
counts. That is the right question for a phone chip row with room for four and
the wrong one for the column a person narrows a catalogue in: on a live cars
page it opened on *condition* and *colour*, because with three listings the
busiest axis is whichever three values happen to be counted, while *make*,
*model* and *year* — the three fields the category marks `mandatory`, i.e. the
three every seller had to fill — sat below them.

The rail now follows the **category's own order**, in four bands: pinned slugs,
then `mandatory` features in schema order, then the rest in schema order, then
whatever the schema does not name at all (evidence order among themselves —
with no schema there is no other order to have). Stable under a click, which a
rail that reshuffles as you tick is not.

```tsx
<SearchPage
  partition={<PartitionChips variant="segmented" items={children} … />}
  pinnedFacets={["body_type_ref_select"]}
/>
orderFacetGroupsBySchema({ groups, categoryFeatures, pinned })
```

Past `visibleGroups` the tail folds under one **All filters (K)** control —
except a group you have already chosen a value in, which is never folded
away: the control that removes a filter is the one you came back for.
Defaulted per layout through `<SearchPage>`: 16 in the desktop column
(`FACET_VISIBLE_GROUPS`, `<FacetPanelPane>`'s own default too), 8 in the
phone sheet — a surface already behind one tap costs less to fold again than
a column sitting on screen the whole time. Either number is a prop away from
being something else.

`facetGroupIsDrawable(group)` is the one rule the rail and the chip row share
for "is there anything to draw here", and the question it asks is **evidence**:
at least one value some candidate in this answer actually carries. A live
laptops leaf drew six of six groups as accordions a person could open and
narrow nothing by — every counted bucket zero, and the axes the facet budget
skipped standing on their authored option tables with `count: null` on every
row. Three exemptions, and nothing else:

- an axis the reader has already **filtered on** — a constraint with no
  control to remove it is worse than a bare heading;
- a **vocabulary-backed** axis: its control is a field over a dictionary the
  answer never enumerated, and that box searches the dictionary rather than
  the buckets — *make* on a cars leaf holding three cars, *vendor* on a
  laptops leaf holding one. `mandatory` is deliberately not asked: on the live
  laptops leaf not one of vendor/model/screen size carries it;
- an axis with evidence, obviously.

A dropped axis is **named** outside production: a `console.warn` says which
axis went, why, and whether the schema calls it required — the fault that took
*make* off a live cars rail while every `select`-typed comfort option drew its
own table and stayed. Note the consequence for a leaf whose plan was cut at
`MAX_FACET_FIELDS`: an axis the server never counted is not drawn unless it is
one of the two exemptions, so the way to put it back is to raise that budget
(stapel-search 0.14.5 spends it in schema order, required first).

## A vocabulary is a dictionary, not a checkbox list

A **vocabulary-backed** axis (`ref_select`/`ref_hierarchical_select`, whose
config is a pointer and never an option table — or an untyped group the answer
came back long for, the live case where no schema was threaded through) is
always a dictionary, **however many buckets came back**: the busiest values, a search box that filters them
locally, and the chosen values pinned above the box so a filter is never
invisible. The box matches **across alphabets** — `тойота` finds `Toyota`,
`тимберленд` finds `Timberland`, `ровер` finds `Land Rover` — by a prefix rule
over two keys per word, a transliteration and its consonant skeleton
(`translitPrefixMatch`, `translitKey`, `consonantKey`; table-driven, no
dependency). No request per keystroke: the whole bucket list is already in the
answer — stapel-search caps a vocabulary-backed group at
`MAX_FACET_VALUES_VOCABULARY` (1000, raised from the shared 200 for exactly
this), so a 418-term make dictionary arrives whole and the box has everything
it filters.

The bucket count used to decide this, and on a leaf holding three cars the make
drew three checkboxes over a vocabulary of four hundred makes — "а если там
сотни вариантов" is a question about the DICTIONARY, and the dictionary is
large whether or not this leaf has stock. An **inline** option set is never a
dictionary, whatever its length: a `select` carries its own table, and a small
one is a list a person reads at a glance.

A dictionary outranks the pills, too: the live `make` axis is `maxSelected: 1`
over a 418-value vocabulary, so "pick one" used to win and the control it drew
was four hundred pills in a 280px rail.

On the **desktop rail** a dictionary is a select-style FIELD
(`dictionaryMode="field"`, which `<SearchPage>` sets for the column layout):
closed it reads the chosen values or *Any*, and it opens the searchable list —
a real `role="combobox"` button, Enter/Space to open, ArrowDown to open,
Escape to close.

On a **phone** it is a SHEET (`dictionaryMode="sheet"`, the filter sheet's
default). The closed row reads *Any* or the chosen values with their count;
tapping it opens a nested picker — the shared `SkinPickerSheet`, the very
component the composer's vocabulary picker draws — with a search box, a
**Recommended** band (the busiest values by count, capped at
`FACET_VISIBLE_OPTIONS`, with anything chosen in front of it), **All values**
(the rest alphabetically, `FACET_SHEET_PAGE` at a time as the list is
scrolled), a checkmark per chosen row and one **Done** that writes the whole
draft. Typing collapses the two bands into one, because a *Recommended*
heading over rows that answer a query is a lie about which rows those are.
Swipe, Esc, the grab handle and the back gesture all close it and discard the
draft.

That mode commits through `onSetValues` (`useFacetPanel`'s `setValues`, the
bulk half of `toggle`): a draft of several ticks is one URL write, and N
`toggle` calls in one tick would collapse into the last. Without it the group
falls back to the field. `"inline"` is still there for a surface already
devoted to one group — the per-chip sheet of `<FilterChips>`.

```tsx
facetGroupShape(group)             // "segmented" | "nested" | "checkbox" | "dictionary"
isDictionaryFacet(group)           // vocabulary-backed, or untyped and long
facetGroupIsVocabularyBacked(group) // the schema's type, else the answer's `vocabulary`
```

`<SearchPage dictionaryMode>` overrides the per-layout default (`"field"` in
the column, `"sheet"` in the phone filter sheet).

A group with **no schema at all** (a branch category whose `/features/`
answered `[]`) has no `maxSelected` to read, so `facetGroupShape` falls back
to a guess: 2–3 counted buckets under a slug that reads as a condition or a
boolean (`condition`, `state`, `is_*`, `has_*`) draw as segmented pills;
every other small schemaless group stays checkboxes. There is no
`facet_meta` hint for this today — stated plainly as a guess keyed on the
slug, not a fact read off the wire, and the first thing to replace once the
plan sends one.

## The ends of a from/to come from the answer

stapel-search 0.14.7 measures every numeric axis of a page and reports it as
`facet_meta.ranges = {slug: {min, max}}` — core columns and attribute axes in
one map, measured with the range filters removed, uncapped by
`MAX_FACET_FIELDS`. `buildRangeGroups` takes it as `ranges` and the rail
reads two facts off it:

- **Where the ends are.** A catalogue's `year: 1900..2027` is what a year
  could ever be; `1990..2024` is what this page has. Measured bounds win, and
  `RangeGroup.measured` says which of the two a row is drawn from. The
  schema's declaration is the fallback, and the only source against a server
  that predates the report or an engine that has no `ranges` verb (see
  below) — silence is never read as "this category has no numbers".
- **Which axes exist.** An axis the catalogue types as a CHOICE — a
  vocabulary-backed `year`, a `floor`, a `doors` — is a from/to to a buyer,
  and the server measuring it is the fact that settles it. Every reported
  axis gets a row: a picker when its integer span is at most
  `RANGE_PICKER_MAX_VALUES`, two inputs otherwise. The row is drawn even when
  the schema names no such feature (labelled by slug then), and `facets=year`
  keeps its buckets — an axis can be both.

The core price row is left alone by it. Its ends move with every other filter
on the page, and an input that refuses the number a person meant to type is
worse than an unbounded one; the measured price is still on the envelope
(`useFacetPanel().ranges`) for a host that wants to draw over it.

An engine without the verb lists `facet_ranges` in `degraded[]`, which the bag
exposes as `rangesDegraded`. Its empty map is an ENGINE fact, not a corpus
fact, so nothing is remembered from it and the rail falls back to the schema.

## A bounded integer is a picker, not a bare number

A year is not a quantity a person computes, it is one of a hundred-odd values,
and on a live cars page it was two empty number fields. An `int` feature whose
schema declares both bounds and spans at most `RANGE_PICKER_MAX_VALUES` (300)
gets `RangeGroup.picker` — the value list, newest first — and
`<RangeFilterRow>` draws two from/to selects over it. Typing still works and
carries the bounds: a valid in-range number narrows the list, anything else
brings the whole list back **with the bounds said in words** ("from 1900 to
2027"), because a year below the catalogue's floor otherwise does nothing at
all, silently. A mileage (`1..1000000`) and the core price stay two typed
fields.

A typed bound commits on Apply, on Enter, and on **blur** — the picker path
above already committed on blur, and a typed field doing nothing until a
second click was the odd one out. Enter followed by the blur it triggers on
its own never double-commits (the row tracks what it last sent), and a blur
that changed nothing sends nothing.

## The attribute-range block reserves its box before it fills it

Measured on a category feed page at 1536px: the last layout shift on the
page (CLS 0.054, over the 0.05 target) was a 53px jump inside the rail the
instant `search-ranges-attributes` — the schema's own numeric axes, year,
mileage, whatever the category declares — arrived, because nothing on the
page had reserved its height beforehand.

`<FacetPanelPane>` now reserves it from the first paint, sized by whatever
is already known: with the category schema in hand it draws one skeleton row
(`<RangeRowSkeleton>`) per range axis, each `RANGE_ROW_MIN_HEIGHT` tall like
the real `<RangeFilterRow>` it becomes, so the swap costs no further height;
without the schema yet — `categoryFeatures` itself still unresolved — it
reserves one row's floor as `search-ranges-attributes-reserve`, a guess
rather than nothing.

The schema is only the FIRST guess at that count, because the answer may
measure axes the schema types as choices: a leaf that declares two numeric
attributes can answer with four, and the block would jump one answer later.
So the count is remembered. `<SearchStateProvider>` keeps the measured axis
list **per category** (`usePublishRangeAxes` / `useRememberedRangeAxes`,
published from the facet bag as `reservedRangeAxes`), and once a category has
reported one, that is what the rail reserves. Memory, never a control: it
only ever sizes a placeholder, so a stale entry costs pixels and never a
wrong row. A degraded answer writes nothing.

## The applied filters have a row of their own

`<FilterChips>` has two modes. The default, `mode="openers"`, is the phone's
row: one chip per axis, applied or not, each opening its own picker. Beside a
desktop rail that shape is wrong twice — it prints the whole panel a second
time, and no chip in it removes anything without a modal over the results.

`mode="applied"` is the other row, and a page mounts it with one prop:

```tsx
<SearchPage adapter={adapter} appliedChips="desktop" categoryFeatures={features} />
```

`"desktop"` draws it only where the rail is on screen (on the phone the opener
row below already states every applied filter on its own chip); `true` draws it
in both layouts. `<FilterChips mode="applied" />` mounts the same row anywhere
a host wants it.

What it draws:

- **one chip per applied VALUE and per applied numeric range**, never one per
  axis — three chosen brands are three chips and three removals;
- **each caption names the axis and the value** — "Brand: Bosch", "Price: from
  100 to 500" — because beside a dozen axes a bare value names nothing. A core
  money axis prints as money, in the currency the answer's own cards carry;
- **each chip is a real `<button>`** whose press drops exactly that constraint
  and whose accessible name says so (an antd `Tag closable` puts the removal in
  a `<span>` with no tab stop: a constraint a keyboard can read and cannot
  drop), plus the same clear-all the rail's footer runs;
- **the label path of the rail**, stamped: `data-label-source` for the axis and
  `data-value-label-source` for the value, both `server | schema | host | none`;
- **nothing at all when nothing is applied**, and nothing before the answer
  lands — a caption that renames itself under the reader is worse than one that
  arrives a moment later.

`buildAppliedChips`, `rangeChipText`, `rangeLabelSource` and
`appliedChipTestId` are exported for a host composing its own row.

## The rail's scrollbar is in the gutter, not on the filters

The rail scrolls on its own when it outgrows the window. `scrollbar-width:
thin` plus `scrollbar-gutter: stable` is the standard half and it is not
enough: on every overlay-scrollbar platform (a Mac by default, every iOS
browser) the bar is drawn OVER the content and the gutter reserves nothing. So
the rail also declares a classic bar through the WebKit pseudo-elements, with a
real width and every colour a `--stapel-*` custom property, so it is the
panel's own hairline in both themes. `railScrollbarCss()` and `RAIL_CLASS` are
exported for a host that lays out its own column.

The panel's footer — the live count, and the clear-all beside it — sits where
its frame wants it: `footerBar="static"` (what `<SearchPage>` passes in the
column layout) puts it after the last group, and `"sticky"` / `true` pins it to
the scroll port's floor, which is right in a sheet whose port IS the sheet. It
was pinned everywhere, and on the desktop rail an opaque bar over the last two
groups made them unreachable.

## The other sections are a line, and they come with the results

`<SearchPage otherCategories categoryName={...}>` draws

> Search in other categories: **Cars 12** · **Buses 3** · **Motorhomes 1** · 5 more

above the results, and every part of that sentence is already in the answer
that drew the cards. `/query` returns `facet_meta.categories` — `{path, count}`
for every section the candidate set contains — so the line renders in the SAME
commit as the first card. There is no second request to arrive late and push
the page, which is exactly what the shape it replaces did: a full-width block
of one row per section, fetched from `/suggest` after the page had settled.

One case still earns a request. An empty result set has no candidates, so the
answer names no sections, and that is the screen where "this word exists in
these sections" is worth the most — there `/suggest` is asked, into a slot
whose height is reserved from the first frame (`OTHER_CATEGORIES_SLOT_MIN_HEIGHT`)
so the answer lands without moving anything. `useOtherCategories()` says which
case a page is in (`source`, `reserving`, `pending`) for a host drawing its own.

Pressing an entry NARROWS the search on screen and keeps the query: the count
beside a name is the count for this query in that section, and a link to the
bare category feed would show a different number a click later.

`categoryName` is what makes the line useful on a catalogue addressed by ids.
The pair holds `"140/145"` and no tree — the same seam `categoryLabel` fills for
the chip. Without it the line still draws every row the server itself named (a
`/suggest` answer already in the cache names them for free) and every path whose
last segment is a slug; a row nothing can name is dropped rather than printed as
`163`.

`categoryHref` is what makes a row a real link. Without it every entry is a
`<button>` — no address to hover, no "open in a new tab", nothing a crawler can
follow. Pass it and a row it can resolve becomes a real `<a href>`: a plain
click still narrows THIS search in place (a full navigation would answer a
different query than the one the count beside the name was counted for), while
a modified click — the browser's own "open in new tab/window" — is left alone
and follows the address like any other link. A row `categoryHref` returns
nothing for keeps the in-app-only behaviour; whether a row is DRAWN AT ALL still
depends only on `categoryName`, exactly as without this prop.

On the phone surface the cap halves (8 → 4) and the collapsed line is clamped to
two rows besides, because it is name LENGTH and not entry count that turns a line
back into a block. `otherCategoriesCss()` and `OTHER_CATEGORIES_CLASS` are
exported for a host that hoists the sheet itself.

## Two browse surfaces the page places

Both are exported from `./default` and neither lays itself out — where they
belong on a category page is the storefront's decision.

`<PopularValues>` prints the busiest values of one group as a multi-column
`Toyota 802` list that applies the filter on click — a table of contents for a
category, from the same drill-down counts the panel shows. `hidden` is a prop,
not a media query: whether a 390px screen has room is a fact about the page.

```tsx
<PopularValues group={firstRefSelect} onApply={toggle} hidden={isPhone}
               onShowAll={openPanel} />
```

`<PartitionChips>` is the single-select row a `chips` category draws instead of
a tile grid: an "all" cell plus one per child, from `{id, path, name}`,
controlled (the choice is a `category` in the URL), a real `radiogroup` with
roving tabindex and arrow keys — because exactly one of them is true at a time,
and `aria-pressed` toggles say the opposite. `variant="segmented"` is the
desktop rail's shape (one joined control under its own label); the semantics do
not vary with it.

```tsx
<PartitionChips items={children} value={state.category ?? null}
                variant={isPhone ? "chips" : "segmented"}
                onChange={(path) => patch({ category: path })} />
```

## What the server admits, the screen repeats

| The envelope says | The page says |
|---|---|
| `exact_total: false` | "About 1 200 results", never "1 200" |
| `facet_meta.approximate` | "counts are approximate — too many candidates to count them all" |
| `facet_meta.skipped: [...]` | those slugs are named, and their options show **"not counted"** — never `0` |
| `degraded: ["category_rollup", …]` | a banner, one line per degradation, the scorer named |
| a `degraded` literal this build predates | the generic sentence **plus the raw literal** |

A silent `0` where a facet was not counted is the same defect class as
`data ?? []`: a number that looks like an answer and is not one.

## A failed search is never "nothing found"

A result read has **four** outcomes and the skin says a different thing for
each — `matchList`'s arms are all required, so forgetting one does not compile:

| What happened | What the person sees |
|---|---|
| in flight | a skeleton |
| 200, no hits | "nothing matches this search" |
| 5xx / network | "we could not run this search" + retry |
| 400 `search_window_exceeded` | "narrow the search instead of paging further" |

The last row matters on its own: the window refusal arrives as a 400 with no
rows, which is exactly the shape that renders as an empty page if nobody
branches on it.

## `promoted` is not optional

DSA Art. 26 marking rides **every** item under **every** sort. The card slot
receives the whole item, and the default card renders the tag:

```tsx
<SearchResultsPane renderCard={(item) => <ListingCard item={item} />} />
```

A storefront replaces the generic card with its own (`<ListingCard>` from
`@stapel/listings-react/default`); what it may not do is drop the marking. The
companion half — *why these results are in this order* — is the P2B Art. 5
disclosure, generated from the backend's scorer registry and shipped as both a
headless bag and a page (`<RankingDisclosurePane>`), including the parameters
the configured engine cannot evaluate.

## Surface

| Layer | Exports |
|---|---|
| api | `createSearchApi`, `searchQueryParams`, `SEARCH_SORTS`, wire types |
| state (pure) | `parseSearchState`, `writeSearchState`, `patchSearchState`, `toggleFilterValue`, `setFilterValues`, `setRangeValue`, `clearFilters`, `activeFilterCount`, `parseDegradations`, `countIsEstimate`, `buildFacetGroups`, `orderFacetGroupsBySchema`, `facetGroupIsDrawable`, `facetGroupHasEvidence`, `facetOptionLabel`, `translitPrefixMatch`, `translitKey`, `consonantKey` |
| model | `createSearchRuntime`, `searchQueryKeys`, `useSearchQuery`, `useRankingDisclosure` |
| headless | `SearchProvider`, `SearchStateProvider`/`useSearchState`, `SearchResults`, `FacetPanel`, `RankingDisclosure`, `useOtherCategories` |
| `./default` | `SearchPage`, `SearchResultsPane`, `FacetPanelPane`, `RankingDisclosurePane`, `SearchBox`, `SortSelect`, `PageSizeSelect`, `LanguageSelect`, `SearchResultCard`, `RangeFilterRow`, `DegradationNotice`, `UrlIssueNotice`, `PopularValues`, `PartitionChips`, `OtherCategoriesLine`, `otherCategoriesCss`, `FilterChips` (`mode="openers" | "applied"`), `buildAppliedChips`, `facetGroupShape`, `isDictionaryFacet`, `railScrollbarCss`, `RAIL_CLASS`, `FACET_VISIBLE_GROUPS` (the skin themes itself through `SkinTheme` from `@stapel/tokens-antd/skin`; the pair's own `SearchSkinTheme` is gone as of 0.6.0) |
| `./router` | `useRouterSearchParams` |
| i18n | `registerSearchI18n` (+ `./i18n/ru`, `./i18n/es`) |
| errors | `SEARCH_ERRORS`, `explainSearchError`, `SEARCH_WINDOW_EXCEEDED`, `SEARCH_BACKEND_UNAVAILABLE` |

## Not in this version

- **`suggest`** — the endpoint is typed and callable (`api.suggest(...)`), but
  there is no hook and no autocomplete widget: debounce and keyboard handling
  are their own piece of work.
- **`health` / `reindex`** — index-operator endpoints (`IsNotAnonymousUser` +
  `can_manage`). Not a storefront's surface, so not on this pair's client.
- **a map** — geo is complete on the wire (`lat`/`lon`/`radius_km`, `bbox`,
  `sort=distance`) and the state layer carries all of it; drawing a map is a
  tile provider, a key and a CSP change.
- **saved searches.**

## More

`MODULE.md` — why it is shaped this way. `llms.txt` — the agent-facing
description, generated and drift-gated.
