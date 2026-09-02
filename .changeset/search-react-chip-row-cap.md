---
"@stapel/search-react": minor
---

The chip row is capped behind a "more" door, and the counted-facet band leads
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
