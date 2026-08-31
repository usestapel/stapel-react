---
"@stapel/search-react": minor
---

**"How many results would this give me?" is a hook now — and it says out loud that the backend has no way to answer it cheaply.** `useSearchCount(state)`, headless, from the package root.

A quick-search panel's button ("Show 128 listings") has to know the total for a state that is not on screen and not in the URL: the person is still composing it. `<SearchResults>` cannot answer that — it reads the committed URL state — and `useAppliedCount` deliberately reads the page already in cache rather than issuing a search of its own. So this is a read over a state the caller hands in, and it returns the fleet's shape for one: `LoadState<{ count: number | null; kind: SearchCountKind }>`.

**There is no count-only endpoint, and this hook rides the full query on purpose.** `SearchApi` is `query`, `suggest` and `ranking`; nothing answers "how many" without also assembling a page. So the request is the ordinary `/query` with `limit=1` and `facets=off`, and the total comes out of the envelope. That has a real cost — the engine still ranks the candidate set — and it is written into the hook's doc comment rather than hidden behind a name that sounds cheap. **Follow-up for stapel-search:** a `GET /count` verb answering the three count fields plus `degraded[]` and nothing else. When it lands, this hook's body changes and its signature does not.

**What is dropped from the state is the interesting half.** `anchor`/`direction` go, because a cursor asks about a PAGE and a count is about the whole set (keeping one would also cache the same total once per page somebody walked through). `sort` goes, because the total does not depend on the order and keeping it would miss the cache on every sort change. `facets` goes to `"off"`, because counting facets is the expensive half of a request that draws no facet panel. Everything that changes the ANSWER — `q`, `category`, `owner`, filters, ranges, geo, `lang` — is sent exactly as a real search would send it. `countQueryState()` is exported so this is readable rather than inferred.

**The debounce is the mitigation the endpoint gap forces.** The FIRST state is asked about immediately — a panel that opens should not wait a quarter second to say its number — and every change after that is coalesced onto the LAST one (`SEARCH_COUNT_DEBOUNCE_MS`, 250ms; `0` disables it). Typing "hond" then "honda" asks once, about "honda", never about "hond" late. `enabled: false` holds the hook at `loading` for a panel still resolving its category.

**The kind travels with the number.** `"exact"` is a total, `"at_least"` is a floor, `"unknown"` is the engine declining to say — and `count: null` under `"unknown"` is never rendered as `0`. That is the same contract `state/degradations.ts` states for the results page, reused rather than restated, so a counted button cannot drift from a counted heading.

Also exported: `SEARCH_COUNT_PAGE_SIZE`, `SEARCH_COUNT_DEBOUNCE_MS`.
