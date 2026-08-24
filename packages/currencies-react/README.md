# @stapel/currencies-react

**The Money layer of the fleet.** One formatter, one converter, one picker —
imported by every pair that puts an amount on screen.

```tsx
import { useMoney } from "@stapel/currencies-react";
import { Price } from "@stapel/currencies-react/default";

// headless: format anywhere, in the viewer's locale
const money = useMoney();
money.format("1500.00", "EUR");        // en: €1,500.00 · ru: 1 500,00 € · es: 1500,00 €

// the shipped skin: the price, plus the estimate in the viewer's currency
<Price amount="1500.00" currency="EUR" />
```

`@stapel/billing-react` and `@stapel/listings-react` render prices through
THIS package — a `` `${amount} ${code}` `` template anywhere in the fleet is a
defect, not a shortcut. `ListingCard` printed `1500 EUR`: no grouping, no
symbol, identical in every language. That is what this package exists to end.

Three rules it holds so callers do not have to:

1. **Money is a decimal STRING, never a number.** Rates are `Decimal(20, 8)` on
   the wire; `convert()` does `BigInt` scaled-integer arithmetic and matches
   `stapel_currencies.services.convert` case for case (its own tests are ported
   in `test/money.test.ts`).
2. **A converted price is an estimate, and an estimate never replaces the real
   number.** The catalogue serves no rate timestamp, so `<Price>` always shows
   the currency the seller quoted, with the conversion beside it.
3. **`display_name` off the wire is a translation KEY** (`currency.usd`), not a
   name. All 16 seeded codes ship in en/ru/es here.

## Install

```
pnpm add @stapel/currencies-react @stapel/core @tanstack/react-query react
```

## Wire the app once

One `<StapelProvider>` for the whole app (core's config + query + i18n in a
single component — slim wave §21/S4), one `<CurrenciesProvider>` for this pair:

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import {
  createCurrenciesRuntime,
  CurrenciesProvider,
  registerCurrenciesI18n,
} from "@stapel/currencies-react";

// baseUrl is the module's MOUNT; the api/v1/ prefix belongs to the module.
// baseCurrency / decimalPlaces mirror STAPEL_CURRENCIES settings the backend
// reads but does not serve — state them once, here.
const runtime = createCurrenciesRuntime({
  baseUrl: "/currencies/",
  baseCurrency: "USD",
  decimalPlaces: 2,
});
const i18n = createI18n({ locale: "en" });
registerCurrenciesI18n(i18n); // the pair's key bundle → core's engine

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.0.0">
      <CurrenciesProvider runtime={runtime}>{children}</CurrenciesProvider>
    </StapelProvider>
  );
}
```

Hooks and headless components work anywhere below `<CurrenciesProvider>`
(`useCurrenciesApi`, the query/mutation hooks you add in `model/`, the
render-prop components — see `MODULE.md`). Already wired a `<StapelProvider>`
for another pair (or auth-react)? Keep the ONE provider: pass this runtime's
client as a per-module override — `clients={{ currencies: runtime.client }}` —
and nest `<CurrenciesProvider>` next to your other pair providers. The
individual core providers (`StapelConfigProvider` + `QueryClientProvider` +
`I18nProvider`) remain exported for bespoke composition.

## Layers

```
src/
  api/        typed client — thin adapter over this pair's own generated `components`
  model/      query keys, runtime wiring, context/hooks
  flows/      toFlowError + zero-flow registry shim (machines + generated
              registry arrive with the backend's first @flow_step)
  headless/   renderless components (CurrenciesProvider, flow render-props)
  i18n/       translation keys + generated backend error map
  analytics/  generated typed-event registry (events.json)
demo/         first-class demos (compiled, product-linted, smoke-rendered)
```

`./default` is the pair's **shipped** half — `<Price>`, `<CurrencyPicker>`
(a bottom sheet on a phone), `<CurrencyField>` and `<RateTable>` — themed through
`SkinTheme` from `@stapel/tokens-antd/skin` (one bridge for the whole fleet — a
pair never mounts its own `ConfigProvider` and never defaults a theme mode).
Importing it is the opt-in that pulls `antd`; a host with its own design system
keeps importing the root entry and draws its own screens.

```tsx
import {
  Price,
  CurrencyPicker,
  CurrencyField,
  RateTable,
} from "@stapel/currencies-react/default";
import { registerCurrenciesI18nRu } from "@stapel/currencies-react/i18n/ru";
```

Locales ship as subpaths (`./i18n/ru`, `./i18n/es`) so a host carries only the
ones it registers; `test/i18nParity.test.ts` fails the build if a key exists in
en and not in ru/es. Product rules for this pair: `docs/guidelines.md`.

## Generated surfaces (drift-gated)

| Surface | Path | Gate |
|---|---|---|
| Typed API schema | `src/api/generated/schema.ts`, from stapel-currencies's own `docs/schema.json` | `pnpm gen:api:check` |
| Flow registry | none — zero-flow module (`src/flows/registry.ts` shim); `gen:flows` emits `src/flows/generated/` once the backend documents flows | `pnpm gen:flows:check` |
| Backend error map + en bundle | `src/i18n/generated/` | `pnpm gen:errors:check` |
| Typed-event registry | `src/analytics/generated/events.json` | `pnpm gen:events:check` |
| Demos → Ladle stories | `demo/generated/` | `pnpm gen:demos:check` |
| `manifest.json` + `llms.txt` | package root | `pnpm gen:manifest:check` |

These drift gates run at the **monorepo root** (`pnpm gen` / `pnpm gen:check`) —
the etalon's env-parametrized `scripts/gen-*.mjs` drivers are shared, not forked.
`stapel-new-react-lib` wired this pair into the root `gen`/`gen:check` aggregates
at scaffold time (one env-parametrized invocation per driver, including
`gen:api`). The typed `schema.ts` is package-LOCAL, generated from
stapel-currencies's own `docs/schema.json`; design tokens are tokens-owned
(`pnpm gen:tokens`).

## Guardrails

Linted by the shared `@stapel/eslint-plugin` flat config (no raw colours, no raw
token imports, no raw fetch, i18n-key existence, typed analytics, headless-only)
and the shared **stylelint** preset — `pnpm lint` per package plus `pnpm lint:css`
at the root (colours only ever `var(--stapel-*)`). Demos are first-class code:
compiled by `tsconfig.demo.json`, linted with the product ruleset, and
smoke-rendered by `test/demos.test.tsx` — but never shipped (excluded from the
`files` allowlist; proven by `test/prodBundlePurity.test.ts`).

## License

MIT
