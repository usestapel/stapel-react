# @stapel/billing-react

## 0.1.0

### Minor Changes

- 6aa342d: Russian locale as an opt-in `@stapel/billing-react/i18n/ru` subpath
  (i18n-shipping wave 2, following the auth-react etalon — wave 1).

  - `errors.ru.gen.ts` — generated per-locale error bundle, auto-discovered by
    the shared `gen-errors.mjs` driver from stapel-billing's
    `translations/errors.ru.json` catalog. `pnpm gen:errors:check` remains the
    drift gate; existing en outputs are byte-identical.
  - `@stapel/billing-react/i18n/ru` — `billingI18nBundleRu` (generated backend
    ru + hand-written ru UI copy) and `registerBillingI18nRu(engine)`, which
    registers the en floor UNDER the ru texts so a missing key degrades to
    English, never to a raw key. Host bundles registered after the pair's win
    (merge-priority convention, now documented on `registerBillingI18n`).
  - Tree-shake purity is gated twice: the main-entry size-limit budget is
    unchanged (the ru locale is not in its graph; the ru subpath is its own
    chunk with its own budget) and `test/i18nRu.test.ts` walks the compiled
    `dist/index.js` module graph asserting the ru modules never appear.

- f1fdc52: New headless React flow pair for **stapel-billing** — the third pipeline pair
  after notifications and profiles (scaffolded by `stapel-new-react-lib`, tools
  0.8.2). Business + state only, zero visual opinion, built on `@stapel/core`'s
  StapelClient.

  - **API surface (`billingApi`)** — eight typed operations over the signed-in
    billing endpoints: `getWallet` / `updateWallet` / `listTransactions` /
    `getCatalog` / `createCheckout` / `getSubscription` / `cancelSubscription` /
    `getCustomerPortal`. Wire types alias the generated `@stapel/core` schema
    (one documented correction: the `SubscriptionStatus` union narrows the
    backend's bare `status` string). The service-to-service `POST /internal/debit`
    and `POST /webhooks/stripe` are intentionally excluded — machine-to-machine
    surfaces, not part of the signed-in UI.
  - **Model hooks** — read hooks `useWallet` / `useTransactions` / `useCatalog` /
    `useSubscription` and write hooks `useUpdateWallet` / `useCreateCheckout` /
    `useCancelSubscription` / `useOpenCustomerPortal`, all under the namespaced
    `billingQueryKeys`. Payments are server truth, so no mutation is optimistic
    (frontend-core-architecture §2.6).
  - **Headless components** — `Wallet` (balance + auto-recharge settings),
    `PricingTable` (catalogue + Stripe Checkout redirect), `Subscription`
    (status + cancel + customer-portal link), plus the `BillingProvider` root.
    Each ships a demo (completeness gate green) and msw happy-path tests,
    including a negative payment case that surfaces a localizable
    `error.400.invalid_package`.
  - **i18n** — an English `billing.*` key bundle spread over the generated backend
    error fallbacks, so a `StapelApiError.code` never renders as a raw key.

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
