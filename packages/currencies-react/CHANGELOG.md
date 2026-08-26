# @stapel/currencies-react

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
