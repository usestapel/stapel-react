---
"@stapel/search-react": minor
---

search: the chip row gains an APPLIED mode — one chip per constraint, each beside the control that drops it

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
