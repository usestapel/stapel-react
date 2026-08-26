# @stapel/currencies-react

## 0.2.0

### Minor Changes

- 456b30a: Money is formatted as money, and one catalogue speaks with one voice.

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

## 0.1.0

### Minor Changes

- 80617e9: First release — the Money layer of the fleet.

  `@stapel/listings-react` printed a price as `` `${price} ${currency}` `` — `1500
EUR`, no grouping, no symbol, the same string in every locale — and every other
  pair that shows an amount was one copy away from doing it again. So the
  formatter is a package, not a helper.

  **The model (pure, no React).** `formatMoney(amount, code, { locale })` over
  `Intl.NumberFormat`: locale separators and grouping, the currency's own minor
  units (`¥1,234`, not `¥1,234.00`), symbol placement the locale decides. `convert`
  is the client-side twin of `stapel_currencies.services.convert` — cross-rate
  through the base, ROUND_HALF_UP, and arithmetic on `BigInt` scaled integers so a
  decimal string never becomes a double. `test/money.test.ts` re-runs the
  backend's own `tests/test_convert.py` cases; a code `Intl` refuses falls back to
  the catalogue's symbol through a placeholder-currency pass that keeps the
  locale's placement.

  **The hooks.** `useCurrencies` (one request, cached an hour — the catalogue
  serves no `updated_at` to key on), `useMoney`, `useDisplayCurrency` (persisted
  through `createRepository`: user scope when signed in, visitor scope otherwise),
  `usePrice` and the `<Money>` render prop.

  **The default skin.** `<Price>` — the seller's own number on the first frame,
  the conversion as a marked estimate under it, and a visible rate line rather
  than a tooltip; the estimate is never shown alone, because the contract carries
  no rate timestamp. `<CurrencyPicker>` — a searchable Select on desktop, a
  `SkinDialog` bottom sheet on a phone. `<CurrencyField>` — a decimal-STRING price
  input (not `InputNumber`), the control `@stapel/listings-react`'s composer price
  row should adopt. `<RateTable>` — the catalogue, with the note that these are
  the latest stored values and not a quote.

  Wired against stapel-currencies 0.1.9's own codegen triad: `src/api/generated/schema.ts`
  from its `docs/schema.json`, and en/ru/es error bundles from its `docs/errors.json`
  plus `translations/errors.{ru,es}.json`. A bare DRF 404 on the retrieve route is
  folded to `error.400.unknown_currency`, the condition's real name, so a skin
  renders "Unknown or inactive currency code" instead of "Requested resource not
  found".

  No nav entry: this pair owns no page. A picker lives in the host's chrome, a
  price renders inside somebody else's card, and `RateTable` is a slot.

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
