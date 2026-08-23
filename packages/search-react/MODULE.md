# @stapel/search-react — module guide

The human companion to the generated `llms.txt` (agent context) and
`manifest.json` (machine catalog). `README.md` is the how-to; this is the
why-it-is-shaped-this-way.

Built against **stapel-search 0.1.0** (contract pin
`352cce979cee11936a8c822212fe87e377dd08cf`).

## Layers

- **api/** — `createSearchApi(client)`, one method per endpoint a storefront may
  call (`query`, `suggest`, `ranking`), over the generated
  `components["schemas"]` from this pair's own package-local
  `api/generated/schema.ts` (`pnpm gen:api` ← stapel-search `docs/schema.json`).
  `searchQueryParams(state)` is exported from here because it is *also* what the
  query key is built from — see "the key is the request" below.
- **state/** — the pure layer, and the biggest one: the URL codec
  (`urlState.ts`), the `degraded[]` parser, and the facet model. No React, no
  router, no fetch, which is what makes the round trip testable in both
  directions without a DOM.
- **model/** — `searchQueryKeys` (one factory, `["search"]` namespace),
  `createSearchRuntime`, context/hooks, and the two read hooks.
- **headless/** — `SearchProvider`, `SearchStateProvider`, `SearchResults`,
  `FacetPanel`, `RankingDisclosure`.
- **i18n/** — the en floor + generated backend error bundles; `ru`/`es` as their
  own subpaths. `ru` is the storefront's default language (storefront spec verdict F1).
- **default/** — the antd skin, a separate entry point.
- **router/** — the react-router binding, a third entry point (see below).
- **nav/** — two public entries: `/s` and `/ranking-disclosure`.

There is **no `flows/` layer**: stapel-search annotates no `@flow_step`, and a
search is not a multi-step flow (spec §8.1 — `flows/` only where one exists).

## Why the URL codec is the centre of the package

A search that cannot be shared is not a search — the acceptance criteria the
spec sets (§4.2) are all about a link: copy it into another tab and get the same
page, press Back and lose exactly the last filter, reload and lose nothing.

Every one of those follows from a single decision: **the query string is the
only copy of the state.** No component holds a duplicate, so there is nothing to
keep in sync. `SearchStateProvider` parses on every render from the adapter's
`URLSearchParams` and writes back through `writeSearchState`; the components
below it read a bag and call mutators.

Two consequences worth stating because they are easy to get wrong:

1. **The parameter names are the backend's**, not a prettier set of our own. A
   browser URL is then the API query string — a support ticket that pastes a
   link is a request anyone can replay with curl — and there is no translation
   table to drift.
2. **Push vs replace is deliberate.** A filter change PUSHES (that is what makes
   Back remove exactly one filter); typing in the search box and changing the
   page size REPLACE (one history entry per keystroke would make Back useless).
   The adapter forwards the flag; an adapter that ignores it breaks the Back
   button, which is why the seam has it rather than hiding it.

### The cursor is dropped by every change that is not a page move

`anchor` is `{v, k, o}` base64url-encoded — a position inside ONE ordered
candidate set, over the active sort. Carried across a filter or sort change the
server either refuses it (`error.400.search_bad_cursor`) or honours it against a
different set and answers page 4 of something nobody asked for.

So `patchSearchState` drops `anchor`/`direction` unless the patch itself sets
them, and every mutator in the provider goes through it. "Changing a filter
returns you to the first page" is a property of the state machine, not a rule
each call site remembers.

## Why `@stapel/core` gained repeatable query parameters

`f.<slug>` is read with `getlist` server-side: repeating the key is the OR
within a slug (`stapel-search/query.py`). Core's client built its query string
with `URLSearchParams.set`, which cannot express that — a second value silently
replaced the first, and the only alternative was for this pair to hand-build its
own URL. That would have been a second query encoder sitting next to core's,
outside its escaping and outside `stapel/no-string-paths`.

Core 0.15.0 therefore accepts an ARRAY value and `append`s it, in order; an
empty array contributes nothing, exactly like `undefined` ("no filter" and "a
filter with no values" must not produce different URLs). This pair's peer floor
is `>=0.15.0` for that reason and no other — the symbol set is unchanged, so
`check:peer-floors` could not have caught an understated floor here.

## The key is the request

`searchQueryKeys.query()` is keyed on the very object `searchQueryParams()`
hands the client. A key built from a hand-picked subset is how a parameter comes
to change the request but not the key — new filter, cached rows. TanStack hashes
with sorted-key JSON, so equal states hash equal regardless of construction
order, and each cursor's page stays cached under its own key, which is what
makes Back instant.

## `keepPreviousData`, and why it is a correctness choice here

Facets are drill-down: the point of the panel is that choosing a value leaves
its siblings showing what you would get by switching to them. A panel that
blanks to a spinner between clicks cannot show that — the numbers vanish and
reappear, which reads exactly like the naive facets this contract avoids. So the
previous answer stays on screen while the next is in flight, with `isFetching`
for a skin that wants to dim it.

The load discipline is intact: the first load has nothing to keep and is
`loading`, and a failure still lands as `failed` rather than leaving stale rows
pretending to be current.

## The two slot seams

L2 pairs do not import each other, so the two things a storefront must supply
are props, not dependencies (spec §6.2 items 1–2):

- **`renderCard`** — `<ListingCard>` from `@stapel/listings-react/default`. The
  generic card here is a working default over a documented set of conventional
  `card` fields (`title`, `price`, `currency`, `location`, `image_url`), because
  `SearchItem.card` is deliberately free-form: "stored row fields, so a result
  page costs one query".
- **`categoryFeatures`** — the category's feature schema, from
  `categories-react`. The server sends `{value: count}` and no labels; the
  captions are translation keys in that schema.

Facet values are rendered through `@stapel/attributes-react`'s
`formatFeatureValue` — the same formatter a card and a spec table use, so a
value cannot read one way in the filter and another way in the result. The wire
carries facet values as index TERMS (strings), so `facetOptionLabel` coerces
back into the shape each type's formatter expects: `select` is a list even for
one value, `date` is a Unix timestamp integer, `int`/`float` are numbers.

## Honesty flags are not decoration

Four independent signals, all surfaced:

| Signal | Where it comes from | What must not happen |
|---|---|---|
| `count` / `count_is_lower_bound` / `exact_total` | envelope | rendering a floor, or an unknown, as a total |
| `facet_meta.approximate` | candidate set over `FACET_CANDIDATE_CAP` | a precise-looking number |
| `facet_meta.skipped` | plan slugs dropped at `MAX_FACET_FIELDS` | a `0` where nothing was counted |
| `degraded[]` | `_degradations` + backend + facet counter | silence |

`degraded[]` is de-duplicated on parse, because the backend concatenates three
contributions without de-duplicating them (`services.py`) and the same literal
can arrive twice. An unrecognised literal is kept with `kind: "unknown"` and
shown with its raw text — a build that predates a new limitation should say so.

### The count has three states, and one of them prints nothing

stapel-search 0.2.0 replaced "a number, possibly approximate" with three
distinct answers, because the two-state version had to spell "we do not know"
as `0` — and the live storefront printed «Примерно 0 объявлений» over four
visible cards.

| envelope | `page.countKind` | rendered |
|---|---|---|
| `count: 25`, `count_is_lower_bound: false` | `"exact"` | «25 объявлений» |
| `count: 1200`, `count_is_lower_bound: true` | `"at_least"` | «1200+ объявлений» |
| `count: null` | `"unknown"` | nothing at all |

`countKind()` is the whole decision in one call, and it is deliberately
conservative: a bare `exact_total: false` (a server that predates
`count_is_lower_bound`) reads as a floor, never as a total, because "at least
N" is the one claim the visible page cannot contradict. `page.countIsEstimate`
survives as a deprecated alias; it cannot see `count: null`.

### An `exact_total`-only degradation raises no banner

The rule, and the reasoning, live in `isCountNuanceOnly()` and
`<DegradationNotice>`: `exact_total` is a count NUANCE, not a failed search.
The rows are the right rows, and its single consequence — the total is a floor
— is already spoken by the count as "N+". A warning box over an otherwise
perfect page teaches the reader that the page is broken, and a banner that
cries wolf on every landing page is a banner nobody reads on the day
`category_rollup` appears in it. Beside ANY other degradation it renders
normally, because the list is then describing an answer that really is
degraded.

Volume is the container's choice, not the library's: `<SearchResultsPane>` (and
`<SearchPage>`) take `degradationNotice?: "banner" | "inline" | "off"`,
defaulting to `"banner"`. A catalogue keeps the box; a landing page with six
cards under a hero passes `"inline"` (the same sentences, quiet secondary text)
or `"off"`. Nothing about `"off"` silences a degradation for other surfaces —
it is one surface saying "not here".

## Where the refusals go

`error.400.search_window_exceeded` gets its own branch in the results pane.
Everything about it looks like an empty page — a 400, no rows — and it means the
opposite: there are more results, they are just past `MAX_RESULT_WINDOW`. The
sentence is "narrow the search".

The views turn EVERY backend exception into `503
error.503.search_backend_unavailable`, so a client never has to distinguish a
500 from an outage: a dead engine is always "we could not ask", never "there is
nothing here".

## Notes on the contract, recorded rather than worked around

1. **`docs/flows.json` is `{}`.** Every other module ships `[]`. The monorepo's
   `gen-flows.mjs` requires an array and throws on an object, so this pair is
   not wired into `gen:flows` at all — which costs nothing, because there are no
   flows to generate. Upstream ask: emit `[]` for uniformity.
2. **The schema declares no `enum`s.** `sort`, `direction` and `facets` have
   their vocabularies in prose and in Python (`SORTS` is a setting a deployment
   may extend). So `sort` is typed as `string`, `SEARCH_SORTS` is the shipped
   list a control offers, and an unknown value is passed through for the server
   to refuse by name — a client that reset it would rewrite a shared link's
   meaning on load.
3. **`info.title` is empty and `info.version` is `0.0.0`** in the schema. The
   manifest's `backend.contract` comes from `pyproject.toml`, as everywhere else
   in this repo; nothing reads the schema's version.
4. **`prev_anchor` is absent when the previous page is the first one.** The
   cursor's absence is what "page 1" means under keyset paging, so walking back
   clears `anchor` rather than inventing one.
5. **`minLon > maxLon` in a bbox is legal** — the box crosses the antimeridian.
   The codec does not normalize it.

## Tests

103, in 12 files. The ones that exist for a named reason:

- `urlState.test.ts` — the round trip in both directions, the repeated `f.`
  key, the antimeridian bbox, unknown parameters preserved, and the cursor
  dropped by every non-paging change.
- `urlSync.test.tsx` — the same properties through the real provider and skin:
  a facet click lands in the URL and in the next request, the history gains one
  entry per filter (so Back removes one), a shared link reproduces the request.
- `facets.test.tsx` — drill-down siblings keep their counts, closed sets keep
  their declared order, a skipped slug says "not counted", labels resolve
  through the category schema.
- `results.test.tsx` — the four load outcomes, the window refusal as its own
  sentence, the three count states (`N`, `N+`, and no line at all), and
  `promoted` under every one of the five sorts.
- `pagination.test.tsx` — cursor forward and back with `direction`, both
  controls blocked WITH a reason, and the panel not blanking between clicks.
- `degraded.test.tsx` — every literal parsed, duplicates collapsed, unknown
  kept, an `exact_total`-only degradation raising no banner (and raising one
  again beside a real degradation), and the `off`/`inline` variants.
- `contract.test.ts` — every operation lands on a path the backend declares,
  every query parameter is one it declares, and `f.<slug>` is repeated rather
  than comma-joined.
- `pair.test.ts` — nav ids unique and namespaced, `surface` explicit, every
  component the manifest names actually exported, every `labelKey` in the
  bundle.
