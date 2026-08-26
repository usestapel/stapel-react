---
"@stapel/currencies-react": minor
---

Money is formatted as money, and one catalogue speaks with one voice.

**The glyph.** `formatMoney` now prefers the CATALOGUE's symbol in the slot the
LOCALE chose. `en-US` ships `€` for euros and no `₽` for roubles, so the same
screen printed `€1,500.00` beside `RUB 1,500.00` — one price with a symbol,
the next with an ISO code. When Intl falls back to the code and the catalogue
carries a real glyph, the glyph goes in; placement, spacing and grouping stay
the locale's decision. Nothing is substituted for `symbolDisplay: "code"`, for
a locale that already found a symbol, or for a catalogue with no symbol.

**`formatRate()`** — new, exported, and on the `useMoney()` bag. The wire spells
a rate as `Decimal(20, 8)`, so `RateTable` printed `92.59000000` and
`1.00000000` as user copy: eight trailing zeros of precision nobody reads, in
the one column the table exists for. Rates are now trimmed to at most four
places (never fewer than two, so the decimal points line up), grouped in the
viewer's locale, and carry no currency token — a ratio is not an amount of
money. The Rate column is `align: "right"` with `font-variant-numeric:
tabular-nums`, and the redundant `Symbol` column folds into the code cell.

**One catalogue, one voice.** `rate-table--failed` rendered the server's own
`error` string ("Something went wrong") while the identical failure in the
picker rendered the pair's localized sentence. Both now say
`currencies.catalog.failed`, and both empties are the same `EmptyState` with
the same hint — replacing `currencies.picker.empty`/`failed` and
`currencies.table.empty`/`symbol` (en/ru/es).

**The phone picker is a control.** The trigger was a centred label in a block
with no caret, which reads as a disabled read-only field; it is now a field —
label leading, caret pinned to the end, on the 44px floor — with `≥44px` sheet
rows, and a `compact` mode (`€ EUR`) for the currency half of a `CurrencyField`,
whose amount input also gains a visible label. `defaultOpen` lets a story (and
a host that routes straight to the choice) mount with the sheet OPEN: the phone
variant's shot was a closed trigger, so the sheet the story documents had never
been photographed.

`<Price>` renders at display size instead of body weight, and "Conversion
unavailable" no longer wears the same muted grey as a successful estimate.
