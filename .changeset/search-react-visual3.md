---
"@stapel/search-react": minor
---

Search: the five blank stories, the phone filter path, money, and the dark scope

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
