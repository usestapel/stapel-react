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

Past `visibleGroups` (default `FACET_VISIBLE_GROUPS`, 8) the tail folds under
one **All filters (K)** control — except a group you have already chosen a
value in, which is never folded away: the control that removes a filter is the
one you came back for. The phone sheet passes `visibleGroups={null}`; a surface
devoted to filtering has the room.

`facetGroupIsDrawable(group)` is the one rule the rail and the chip row share
for "is there anything to draw here". A group with no options is a heading over
nothing — after `buildFacetGroups` learned to read the schema, what is left in
that state is a `ref_select` whose config is a bare `optionsRef` pointer and
which the server did not count, so there is nothing to enumerate from either
side. It is not drawn, and outside production it is **named**: a
`console.warn` says which axis went, why, and whether the schema calls it
required. That is the fault that took *make* off a live cars rail while every
`select`-typed comfort option drew its own table and stayed.

## A vocabulary is a dictionary, not a checkbox list

Past eight **evidence buckets** a `ref_select` group (or an untyped group that
long — the live case, where no schema was threaded through) stops being a list
and becomes a dictionary: the busiest values, a search box that filters them
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

A dictionary outranks the pills, too: the live `make` axis is `maxSelected: 1`
over a 418-value vocabulary, so "pick one" used to win and the control it drew
was four hundred pills in a 280px rail.

On the **desktop rail** a dictionary is a select-style FIELD
(`dictionaryMode="field"`, which `<SearchPage>` sets for the column layout):
closed it reads the chosen values or *Any*, and it opens the searchable list —
a real `role="combobox"` button, Enter/Space to open, ArrowDown to open,
Escape to close. The phone sheet keeps the list inline, because the sheet is
already the disclosure.

```tsx
facetGroupShape(group)   // "segmented" | "nested" | "checkbox" | "dictionary"
isDictionaryFacet(group) // > FACET_DICTIONARY_THRESHOLD counted buckets
```

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

## The rail's scrollbar is in the gutter, not on the filters

The rail scrolls on its own when it outgrows the window. `scrollbar-width:
thin` plus `scrollbar-gutter: stable` is the standard half and it is not
enough: on every overlay-scrollbar platform (a Mac by default, every iOS
browser) the bar is drawn OVER the content and the gutter reserves nothing. So
the rail also declares a classic bar through the WebKit pseudo-elements, with a
real width and every colour a `--stapel-*` custom property, so it is the
panel's own hairline in both themes. `railScrollbarCss()` and `RAIL_CLASS` are
exported for a host that lays out its own column.

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
| headless | `SearchProvider`, `SearchStateProvider`/`useSearchState`, `SearchResults`, `FacetPanel`, `RankingDisclosure` |
| `./default` | `SearchPage`, `SearchResultsPane`, `FacetPanelPane`, `RankingDisclosurePane`, `SearchBox`, `SortSelect`, `PageSizeSelect`, `LanguageSelect`, `SearchResultCard`, `RangeFilterRow`, `DegradationNotice`, `UrlIssueNotice`, `PopularValues`, `PartitionChips`, `facetGroupShape`, `isDictionaryFacet`, `railScrollbarCss`, `RAIL_CLASS`, `FACET_VISIBLE_GROUPS` (the skin themes itself through `SkinTheme` from `@stapel/tokens-antd/skin`; the pair's own `SearchSkinTheme` is gone as of 0.6.0) |
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
