# @stapel/billing-react

## 0.10.0

### Minor Changes

- 57bd738: Billing skin: close the VISUAL3 blockers and delete the legacy harness stories.

  **The two blockers.** A `past_due` subscription drew its "Payment overdue" chip
  in GREEN — the card asked "is it cancelled?" and painted every other answer as a
  success. Tone now comes from the state, in one table beside the label
  (`subscriptionStatusTone`), so five statuses have five decided readings and an
  unknown one is drawn neutral rather than guessed. And a catalogue 503 the
  pair has no key for (`error.503.service_unavailable`) rendered as that raw code,
  wrapped mid-token; core's HTTP status floor answers it now, and a regression
  test keeps any `error.*` key and any snake_case enum off the rendered page.

  **The harness stories are gone**, not supplemented: `billing.provider`,
  `billing.wallet`, `billing.pricing_table` and `billing.subscription` — four
  `state.step` chips that still printed `1240 USD` beside the real skin — are
  deleted, and the surviving default-skin demos declare the headless exports they
  cover. The demo harness lost its `DemoCard`/`StepBadge`/`DemoButton` chrome with
  them.

  **Screen fixes.** The "Best value" badge moves inside the offer card (as a
  `Badge.Ribbon` it hung off the card's right edge and a 390px viewport clipped it
  away). The debt is stated ONCE above the shop instead of once per offer card,
  and each offer now says what it would LEAVE — a different number on every card.
  Automatic top-up switches its whole group off when the shop answers with no
  packages, states that reason once, and stops contradicting itself in
  consecutive sentences. The purchase button is `large` and spans the card on a
  phone. The billing page gets a real heading hierarchy (page → section → column
  label) and, on a narrow layout, a row of section anchors, so the ledger is one
  tap away rather than seven viewports of scroll. A debt row is two lines instead
  of a `·`-joined run-on. The demo ledger reconciles: it ran to
  "Balance after: −40" beside a stated balance of 1,240.

  **i18n.** `billing.pricing.settles_debt` is replaced by
  `billing.pricing.debt_note` and `billing.pricing.spendable_after_debt`; new
  `billing.wallet.sections_label` and `billing.wallet.package_none`. All in en,
  ru and es with their CLDR plural categories.

## 0.9.0

### Minor Changes

- 80617e9: The wallet becomes a product: two credit pools, the debt, the subscription, auto-recharge and the ledger.

  The backend's whole 0.8 → 0.11 arc reached the model layer and stopped before the skin. Five of eight
  caller-facing operations had hooks and no pixels; `GET /wallet/transactions` had no consumer anywhere.

  **The two pools.** A wallet holding 840 bought credits and 400 that die on the 1st rendered as "1240 USD".
  It now renders as two lines with their fates in words, and `creditPools()` has no field that could spell
  their sum. The split is on `expires_at`, not `source` — a bought credit a deployment expires is an
  expiring credit. The deadline is still the server's `expiring_soon`, never a client-side scan.

  **The debt** (`debts[]` / `debt_outstanding`, new in 0.11.0) is stated with what it will do to the next
  credits, and every offer in the shop says how many of ITS credits are already spoken for.

  **New default skins** — `SubscriptionCard`, `WalletSettings`, `TransactionHistory` — filling two §54 holes
  and spending seven i18n keys that were written, translated and rendered by nothing. `BuyOptions` reads
  `useSubscription` and no longer offers the plan the caller already holds; its columns are sized by the
  ELEMENT, not the viewport, so the shop in a narrow panel gets the narrow layout.

  **Spanish is real.** All 31+ pair-owned UI keys are translated; `es` shipped Spanish errors inside an
  English screen before. Counts go through `tPlural` (CLDR families, four forms in Russian) instead of
  `credit(s)`.

  **Breaking (pre-1.0 = minor):** `/default` no longer exports `BillingSkinTheme` or its own `ErrorAlert` —
  both come from `@stapel/tokens-antd/skin` (`SkinTheme`, `ErrorAlert`), one reviewed copy for the fleet,
  reactive to the document's live `data-theme`. Peer floors are now `@stapel/core >=0.18.0` and
  `@stapel/tokens-antd >=0.6.0`. `WalletCredits` gains `debts` / `debtOutstanding` as LoadStates, so a
  custom `WalletBag` consumer implementing the interface by hand must supply them. Schema regenerated
  against stapel-billing 0.11.0; contract pin `>=0.11 <0.12`. New nav entry `account.billing`.

## 0.8.0

### Minor Changes

- 7133acd: The wallet stops being a number: lots, holds, the next deadline, and both ways to buy on one screen

  stapel-billing 0.8.1 turned a balance into a set of credit lots with expiry
  dates, and `GET /wallet` now carries `lots[]`, `holds[]` and `expiring_soon`
  beside the scalar. The pair catches up:

  - `useWallet` exposes `lots`, `holds` and `expiringSoon` as `LoadState`s, so a
    wallet read that FAILED can never be drawn as a wallet with no credits.
    Everything is the server's: the lots keep the spend order the backend debits
    in (`expires_at ASC NULLS LAST`) and `expiringSoon` is the server's own
    `expiring_soon` — no client-side re-sort, no second implementation of a rule
    that already has one. The three wire fields are optional, so a host still on
    a 0.7.x server reads an answered, empty structure rather than a broken one.
    Additive: the hook still returns the query result every existing call site
    reads.
  - New `@stapel/billing-react/default` subpath: `<WalletPanel/>` — the balance,
    "N credits expire on &lt;date&gt;" when something does, the reserved credits
    stated separately (`balance` already excludes them), and the two ways to buy
    side by side. Both columns print the same derived number — price per credit —
    and the plan's is the lower one, said out loud as "save N% per credit"
    against the best package. Loading, empty and failed are three different
    screens on both reads, and a wallet outage does not take the way to buy
    credits down with it. `antd` and `@stapel/tokens-antd` are OPTIONAL peers;
    the main entry stays visual-opinion-free and antd-free.
  - `packageOffer` / `planOffer` / `bestPerCredit` / `perCreditSavingsPercent`
    and the `Intl` formatters are exported from the main entry, for a host that
    draws its own shop: the comparison is business logic, not styling. It refuses
    to divide by zero credits and refuses to compare across currencies.
  - New wire types `CreditLot`, `CreditHold`, `ExpiringCredits` (+ the
    `CreditLotSource` / `CreditHoldStatus` narrowings), and ru/en copy for every
    new key.

## 0.7.1

### Patch Changes

- a8bd3f4: Raise the `@stapel/core` peer floor to the version that actually exports what each package imports.

  `@stapel/workspaces-react` 0.15.0 shipped declaring `>=0.12.0` while importing
  `LoadState`, which core did not export until 0.13.0. npm installed it happily;
  the host's typecheck then failed on a type the package's own `.d.ts` referenced
  and the host could not resolve. Nine packages were wrong the same way — most by
  a wider margin (`recordings-react` allowed 0.3.0).

  Nothing here could have caught it by building: in this monorepo every package
  compiles against the workspace core, always the newest one, so a declared floor
  is never the version anything is compiled against. `pnpm check:peer-floors` now
  reads each package's imports from `@stapel/core`, asks core's own tagged history
  which release first exported each name, and fails when the floor is older —
  wired into CI **and** the publishing path, since a gate only on the merge path
  does not stop a release.

  Also invalidates the workspace audit query after an invite, a role change and a
  removal: the history sits beside the roster and an admin who acts on one expects
  to see it in the other. Its key is its own root, so the members invalidation did
  not reach it.

## 0.7.0

### Minor Changes

- 400f9e6: A pricing table whose catalogue read failed no longer tells customers the shop sells nothing: `PricingTableBag` hands out one `state: LoadState<PricingCatalog>` — packages and plans arrive in the same `GET /products` body, so a single state is the only honest shape — instead of pre-flattened `packages` / `plans` / `isLoading`, and gains `refetch()` so the failed arm has a retry. `isError` / `error` survive but now describe the checkout WRITE only.

  Render the catalogue through `matchList(mapLoad(state, (c) => c.packages), …)`, whose four required arms keep "loaded and genuinely empty" and "the request failed" from sharing a branch. New keys `billing.pricing.error` / `billing.pricing.retry` (en + ru).

## 0.6.0

### Minor Changes

- a5b8faa: Spanish ships as a locale of the pairs: the `./i18n/es` subpath

  Each of these five pairs gains a generated Spanish error bundle
  (`src/i18n/generated/errors.es.gen.ts`) and the `@stapel/<pair>/i18n/es` subpath
  that makes it reachable — `registerXI18nEs(engine)`, mirroring the existing `ru`
  contour. Key counts, complete over each backend's error registry by
  construction: auth 127, workspaces 67, profiles 53, billing 53,
  notifications 43.

  **Declared coverage — read this before adopting.** The `es` bundle translates
  the BACKEND ERROR CODES only. The pairs' own UI copy (`AUTH_I18N_KEYS` and its
  siblings) has no hand-written Spanish yet, and `registerXI18nEs` deliberately
  registers the en floor UNDERNEATH the Spanish texts, so those keys resolve to
  their English text — never to a raw key. A Spanish-speaking user therefore reads
  Spanish error messages and English UI copy. That boundary is asserted in each
  pair's `test/i18nEs.test.ts`, not left to be discovered. Hand-written Spanish UI
  copy lands later, additively: the subpath and the `xI18nBundleEs` export keep
  their names and shapes when it does.

  The locale stays out of the main entry (size-limit budget per subpath + a
  module-graph purity test), so hosts that never register it carry none of it.

  Regenerated against bumped contract pins — auth v0.20.1, notifications v0.7.1,
  billing v0.6.1, workspaces v0.22.1 (profiles was already pinned at v0.12.0,
  which already carried its catalogue). Besides the catalogues, those pins bring:

  - **auth** — two new error codes, `error.403.privileged_account` and
    `error.403.registration_closed`; and the OTP `code` field's documented length
    goes 4 → 8 digits across the password/TOTP/disable-otp request bodies. In the
    emitted TypeScript this is a doc-comment change only (`maxLength` is a runtime
    validation, not a TS type), so no generated type moved.
  - **workspaces** — one new error code, `error.503.profiles_not_configured`: the
    deployment-has-no-profiles-service half of the member-rename 503, distinct
    from `error.503.profiles_unavailable` (the call was made and failed).
  - **notifications** — the push-token register/unregister permission is restated
    as `IsNotAnonymousUser`; OpenAPI description prose only.
  - **billing** — nothing but the catalogue and the backend-version pin.

  No path, method, field or type was added, removed or retyped in any pair's
  generated `schema.ts`. `calendar-react` and `recordings-react` are deliberately
  untouched: `stapel-calendar` and `stapel-recordings` ship no locale catalogues at
  all (they have no Russian either), and a fabricated empty Spanish file would only
  make the set look uniform.

## 0.5.0

### Minor Changes

- 6ef6c44: Gate top-level "the caller's own …" query hooks on `@stapel/core`'s new
  `useActiveSessionReady()` (owner-diagnosed live incident, 2026-07-17): a hook
  with no natural `enabled` condition of its own (`useWorkspaces`, `useWallet`,
  `useTransactions`, `useSubscription`, `useNotificationFeed`/
  `useInfiniteNotificationFeed`, `useCalendar`/`useEvents`/`useAvailability`,
  `useRecordings`) fires the instant a component mounts — which used to race a
  session still bootstrapping and read a live one as "expired". Detail hooks
  keyed by an id (`useWorkspace`/`useMembers`/`useEvent`/`useRecording`) now
  ALSO gate on session readiness in addition to their existing non-empty-id
  check, since an id can be known synchronously (e.g. a URL param) before the
  session settles.

  Deliberately NOT gated: `useCatalog` (billing) and `useLanguages` (profiles,
  unaffected by this changeset but worth noting for symmetry) — both are
  public reference lists a signed-out visitor legitimately needs.

  Zero manual wiring at any call site: `useActiveSessionReady()` reads
  whichever `SessionManager` a session-owning module (e.g.
  `@stapel/auth-react`'s `createAuthRuntime`) registered as "active", and
  defaults to `true` (never blocks) when no such module exists in the host at
  all.

## 0.4.3

### Patch Changes

- ae57230: v1 canon sweep §60 (api-versioning.md §2, §6): regenerated schema.ts /
  flows / manifest / llms.txt against the backends' `/…/api/v1/` contracts;
  gen scripts and manifest tag prefixes repointed to `/api/v1/`; documented
  `baseUrl` examples and the auth QR same-origin guard now use
  `/<mod>/api/v1/`. Public TS types unchanged — only the fetch base / path
  literals carry the new version segment. Mount your runtimes at
  `/<mod>/api/v1/`.

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
