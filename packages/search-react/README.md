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
| state (pure) | `parseSearchState`, `writeSearchState`, `patchSearchState`, `toggleFilterValue`, `setFilterValues`, `setRangeValue`, `clearFilters`, `activeFilterCount`, `parseDegradations`, `countIsEstimate`, `buildFacetGroups`, `facetOptionLabel` |
| model | `createSearchRuntime`, `searchQueryKeys`, `useSearchQuery`, `useRankingDisclosure` |
| headless | `SearchProvider`, `SearchStateProvider`/`useSearchState`, `SearchResults`, `FacetPanel`, `RankingDisclosure` |
| `./default` | `SearchPage`, `SearchResultsPane`, `FacetPanelPane`, `RankingDisclosurePane`, `SearchBox`, `SortSelect`, `PageSizeSelect`, `LanguageSelect`, `SearchResultCard`, `RangeFilterRow`, `DegradationNotice`, `UrlIssueNotice` (the skin themes itself through `SkinTheme` from `@stapel/tokens-antd/skin`; the pair's own `SearchSkinTheme` is gone as of 0.6.0) |
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
