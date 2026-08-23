---
"@stapel/search-react": minor
---

A result page that reads like one: plural counts, a grid, and one of each label

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
