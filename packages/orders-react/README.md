# @stapel/orders-react

React pair for **stapel-orders**: a cart for guest and member sessions, one-call
checkout with an idempotency key, and anchor-paginated order history. Products
are opaque `(purchasable_type, purchasable_key)` pairs: a page names what is
sold, and the pair owns the request. Zero visual opinion in the main entry; the
opt-in `./default` subpath ships the antd pages and the top-bar cart badge.

Backend: `stapel-orders` mounted at `/orders/api/v1/`. See `MODULE.md` for the
hook table, the fixed test ids and the extension seams.

## Install

```
pnpm add @stapel/orders-react @stapel/core @tanstack/react-query react
```

## Wire the app once

One `<StapelProvider>` for the whole app (core's config + query + i18n in a
single component — slim wave §21/S4), one `<OrdersProvider>` for this pair:

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import {
  createOrdersRuntime,
  OrdersProvider,
  registerOrdersI18n,
} from "@stapel/orders-react";

const runtime = createOrdersRuntime({ baseUrl: "/orders/api/v1/" });
const i18n = createI18n({ locale: "en" });
registerOrdersI18n(i18n); // the pair's key bundle → core's engine

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.0.0">
      <OrdersProvider runtime={runtime}>{children}</OrdersProvider>
    </StapelProvider>
  );
}
```

Hooks and headless components work anywhere below `<OrdersProvider>`.

## Use it

```tsx
import { AddToCartButton } from "@stapel/orders-react";
// any product page, one line — the button owns POST cart/lines/:
<AddToCartButton purchasableType="part" purchasableKey={part.id} />

import { CartPage, CheckoutPage, OrderHistoryPane, OrderDetailPane, CartBadge }
  from "@stapel/orders-react/default";
```

Every control renders a fixed test id from `src/testids.ts` (`add-to-cart`,
`cart-line`, `checkout-link`, `checkout-submit`, `order-row`, `order-cancel`,
`page-cart`, `page-checkout`, `page-orders`, `page-order`, `cart-badge`, ...).
They are constants, never props. Already wired a `<StapelProvider>`
for another pair (or auth-react)? Keep the ONE provider: pass this runtime's
client as a per-module override — `clients={{ orders: runtime.client }}` —
and nest `<OrdersProvider>` next to your other pair providers. The
individual core providers (`StapelConfigProvider` + `QueryClientProvider` +
`I18nProvider`) remain exported for bespoke composition.

## Layers

```
src/
  api/        createOrdersApi — one method per stapel-orders endpoint
  model/      query keys, useCart/useOrders/useOrder, cart and checkout mutations
  headless/   OrdersProvider, AddToCartButton (native button) + useAddToCartButton
  default/    antd pages: CartPage, CheckoutPage, OrderHistoryPane, OrderDetailPane,
              CartBadge, AddToCartButton
  nav/        orders.cart, orders.checkout, orders.mine, orders.detail + the badge embed
  testids.ts  the fixed test ids
  i18n/       keys + en/ru/es bundles + generated backend error map
demo/         first-class demos (compiled, product-linted, smoke-rendered)
```

Locales ship as subpaths (`./i18n/ru`, `./i18n/es`); `test/i18nParity.test.ts`
fails the build if a key exists in en and not in ru/es. Product rules for this
pair: `docs/guidelines.md`.

## Generated surfaces (drift-gated)

| Surface | Path | Gate |
|---|---|---|
| Typed API schema | `src/api/generated/schema.ts`, from stapel-orders's own `docs/schema.json` | `pnpm gen:api:check` |
| Flow registry | `src/flows/generated/`, from stapel-orders `docs/flows.json` (cart, purchase, history, fulfilment) | `pnpm gen:flows:check` |
| Backend error map + en bundle | `src/i18n/generated/` | `pnpm gen:errors:check` |
| Typed-event registry | `src/analytics/generated/events.json` | `pnpm gen:events:check` |
| Demos → Ladle stories | `demo/generated/` | `pnpm gen:demos:check` |
| `manifest.json` + `llms.txt` | package root | `pnpm gen:manifest:check` |

These drift gates run at the **monorepo root** (`pnpm gen` / `pnpm gen:check`) —
the etalon's env-parametrized `scripts/gen-*.mjs` drivers are shared, not forked.
`stapel-new-react-lib` wired this pair into the root `gen`/`gen:check` aggregates
at scaffold time (one env-parametrized invocation per driver, including
`gen:api`). The typed `schema.ts` is package-LOCAL, generated from
stapel-orders's own `docs/schema.json`; design tokens are tokens-owned
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
