# @stapel/currencies-react — module guide

Headless React flow pair for **stapel-currencies**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## Layers

- **api/** — `createCurrenciesApi(client)`; types are aliases over the
  package-LOCAL generated `components["schemas"]` (`src/api/generated/schema.ts`,
  produced by `pnpm gen:api` from stapel-currencies's own `docs/schema.json`; never
  parallel hand-written bodies). Named typed operations arrive with gen-api v2
  (`core-typed-ops`); hand-authored, un-generatable surface lives in
  `api/extensions.ts`.
- **model/** — `currenciesQueryKeys` (single key factory, `["currencies"]`
  namespace), `createCurrenciesRuntime`, React context/hooks. Declare the
  persist/optimistic policy here as you add read hooks and mutations.
- **model/money.ts** — the Money layer (see below): pure decimal arithmetic and
  `Intl.NumberFormat` formatting, no React.
- **flows/** — `toFlowError` + the zero-flow `CURRENCIES_FLOWS` registry shim
  (`registry.ts`, slim wave §21/S3 — `gen:flows` emits no scaffolding for a
  zero-flow module). Once stapel-currencies annotates `@flow_step`, `pnpm gen:flows`
  emits `generated/flows.gen.ts`: swap the shim for re-exports, scaffold
  `createFlowMachine`-based machines (primitive imported from `@stapel/core`)
  and keep them under `gen:flows:check`.
- **headless/** — render-prop components; `<CurrenciesProvider>` wires the
  runtime into context. shadcn-copyable (frontend-standard §7).
- **i18n/** — `CURRENCIES_I18N_KEYS` + en bundle; the generated backend error
  bundle is merged in so every `error.*` code has a fallback.
- **analytics/** — `generated/events.json`, the typed-event registry projected
  from `defineEvent` (`@stapel/analytics` — the impl package; core keeps only
  the type seam, slim wave §21/S1) call sites + flow funnels (`pnpm gen:events`).
  Read by the analytics lint and embedded into `manifest.json`; nothing to
  hand-edit.
- **demo/** — first-class demos (`defineDemo`, `@stapel/showcase`): `_harness.tsx`
  wires a mock runtime + i18n + query client; each `<Name>.demo.tsx` is compiled,
  product-linted, smoke-rendered, and projected to a Ladle story (`pnpm gen:demos`).
  The completeness gate requires ≥1 demo per exported headless component; the
  starter `Currencies.demo.tsx` covers `CurrenciesProvider`. Demos never ship.

## Extension seams (frontend-standard §7)

- Client is injected via `<CurrenciesProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client.
- Flow deps are injected through `create<X>Flow(deps)` factories.
- The headless layer is fully replaceable (copy-and-own).

## The Money layer

This pair is the fleet's ONE money formatter. `model/money.ts` is pure (no
React, no network): `parseDecimal`/`quantize` (BigInt scaled integers,
ROUND_HALF_UP), `convert`/`crossRate` (cross-rate through the base currency, in
parity with `services.convert`), `formatMoney`/`minorUnitsOf` (`Intl.NumberFormat`
per locale). `useMoney()` binds it to the viewer's locale and the loaded rate
catalogue; `usePrice()`/`<Money>` add the display-currency axis; `<Price>` is
the drawn form.

| Surface | Kind | Notes |
|---|---|---|
| `useCurrencies` | read hook | one request for the whole catalogue, `staleTime` 1h (no `updated_at` to key on — BACKEND-GAP C-2) |
| `useCurrency(code)` | read hook | one row; the retrieve route is case-insensitive since backend 0.1.9 |
| `useMoney` | headless | `format` / `convert` / `rate` / `rates` / `base` |
| `useDisplayCurrency` | headless | persisted via `createRepository` — user scope signed in, visitor scope otherwise |
| `usePrice`, `Money` | headless | original always present; converted is the optional half |
| `Price`, `CurrencyPicker`, `CurrencyField`, `RateTable` | `./default` | phone = sheet for the picker; no tooltips anywhere |

## Backend gaps this pair works around

- **C-2** the catalogue serves no rate timestamp, so nothing can say how fresh a
  conversion is. Consequence: `<Price>` never shows a converted number alone,
  and `RateTable` says so in text.
- **C-3** `BASE_CURRENCY` and `CONVERSION_DECIMAL_PLACES` are settings the
  backend reads but does not serve. They are declared once on
  `createCurrenciesRuntime` instead of guessed per call site.
- The retrieve route answers a BARE DRF 404 (no Stapel envelope); the api layer
  folds it to `error.400.unknown_currency` so the sentence a person reads names
  the real condition.

## Consumers

`@stapel/billing-react` and `@stapel/listings-react` render prices through this
package (follow-up changesets): `ListingCard`/`ListingDetailPane` take a
`renderPrice?(amount, currency)` slot the container fills with `<Price>`, and
the composer's price row takes `renderPriceField?` filled with `<CurrencyField>`.
