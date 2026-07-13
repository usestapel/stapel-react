# @stapel/billing-react

## 0.4.2

### Patch Changes

- ca3ba45: Re-pin to the stapel-billing `v0.4.9` contract. The 0.4.9 release refines the
  semantics of `current_period_end` (the subscription's period-end timestamp); the
  contract _shape_ is unchanged, so the generated surface is byte-identical and
  this is a documentation/pin patch only. `backend.contract` stays `>=0.4 <0.5`.
- 2fa025a: §17 arch-contract-pipeline Wave 2 + Wave 3 — the five original pairs are now
  self-contained per-module contracts, aligned to their backend minor.

  **Wave 2 (contract isolation).** Each pair generates its typed surface from its
  backend module's OWN committed `docs/{schema,flows}.json` (byte-identical to the
  former monolith slice) instead of the unified monolith aggregate:

  - `gen:api` emits a package-LOCAL `src/api/generated/schema.ts` per pair (via the
    `API_SCHEMA`/`API_OUT` knobs — the calendar/recordings §17-native shape);
    `api/types.ts` aliases `components` from `./generated/schema.js`, no longer from
    `@stapel/core`. `@stapel/core` stays a RUNTIME peer (client / react-query),
    not the type source.
  - `gen:flows` reads `../stapel-<mod>/docs/flows.json`; `gen:manifest` reads the
    per-module `docs/schema.json`. Public types are unchanged — the repoint is a
    zero-diff source-swap (byte-identity proven), so no consumer breaks.

  **Wave 3 (version scheme B).** Each pair's minor now tracks its backend minor:
  `auth-react → 0.5.0` (stapel-auth 0.5.x), `notifications-react → 0.3.0`,
  `profiles-react → 0.3.0`, `billing-react → 0.4.0`, `workspaces-react → 0.3.0`.
  `manifest.backend.contract` records the one-minor compatibility window
  (`>=0.5 <0.6` etc.), auto-derived from the backend `pyproject.toml`.

- 4e6f442: Internal plumbing swap (slim wave §21/S2) — the pair's stamped
  `model/runtime.ts` / `model/context.tsx` / `headless/<Mod>Provider.tsx`
  boilerplate (byte-identical across the six standard pairs) now binds
  `@stapel/core`'s `createModuleRuntime` / `createModuleContext` factories
  instead of carrying its own copy. Public API preserved exactly: same exported
  names and signatures (`create<Mod>Runtime`, `<Mod>Runtime`,
  `Create<Mod>RuntimeOptions`, `<Mod>RuntimeContext`, `use<Mod>Runtime`,
  `use<Mod>Api`, `use<Mod>Analytics`, `<Mod>Provider>`), same guard-hook error
  messages. No behavior change.
- c3482e7: README wave (slim wave §21/S4): every pair now documents its setup — a new
  Install + "Wire the app once" section built on core's `<StapelProvider>`
  (previously only auth-react's README showed any wiring, as a 5-level provider
  nest). auth-react's wiring example moves to the one-provider shape with the
  `queryRuntime`/`i18n` escape hatches spelled out.
- d3232a9: Zero-flow scaffolding removed (slim wave §21/S3). These six backends annotate
  no `@flow_step`, so `gen:flows` now skips emission for them and the pair's
  `src/flows/generated/` files are gone. The public flow surface is preserved
  exactly by a tiny hand-written shim (`src/flows/registry.ts`): `<MOD>_FLOWS`
  (still `{}`), `<Mod>FlowId`/`<Mod>FlowSpec` (still `never`), `FlowEndpoint`,
  and `flowEndpoints` keep their names, types, and behavior. `toFlowError` and
  the core flow-machine re-exports are untouched. No public-surface delta; the
  generated registry returns automatically once the backend documents its first
  flow.

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
