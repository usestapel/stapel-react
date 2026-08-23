---
"@stapel/search-react": minor
---

The count stops lying, and the banner stops crying wolf.

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
