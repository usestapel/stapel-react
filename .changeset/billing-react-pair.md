---
"@stapel/billing-react": minor
---

New headless React flow pair for **stapel-billing** — the third pipeline pair
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
