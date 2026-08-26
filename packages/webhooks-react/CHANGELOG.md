# @stapel/webhooks-react

## 0.1.1

### Patch Changes

- f9d8b66: The new-rule and delivery sheets keep their action on screen: Create/Save and Replay are pinned to the bottom of the dialog's own scroll box instead of sitting below an invisible fold, the delivery card folds its headers and envelope dumps behind a labelled disclosure, and the delivery-type `Segmented` scrolls inside its box instead of overflowing a 390px sheet.

## 0.1.0

### Minor Changes

- 308e3d6: First real release of the stapel-webhooks pair: the developer-settings feature, not a bag of hooks.

  **api** — all ten operations of stapel-webhooks 0.1.1 (`event-catalog`, subscriptions CRUD, secret
  rotation, deliveries list/detail/replay), typed off the backend's own generated schema, on the paths
  `urls_v1.py` registers and with **no trailing slashes** (a POST to `subscriptions/` is a 301 a browser
  replays as a GET — a create that silently becomes a list). The list limit is clamped to the per-owner
  ceiling the view clamps to server-side.

  **model** — `createWebhooksRuntime({ baseUrl?, docsHref?, retention? })` carries the two facts the HTTP
  surface does not serve: where a host documents signature verification, and how long a delivery row
  survives. Reads and writes: `useEventCatalog`, `useSubscriptions` (+ create/toggle/remove),
  `useSubscription`, `useSubscriptionForm`, `useSecretRotation`, `useDeliveries` (self-stopping 15 s poll
  — the module has no stream), `useDelivery`. The filter grammar of `filters.py` is ported to the browser
  (`validateFilterText`, depth ≤ 4) so a malformed predicate is answered by operator and path instead of
  by the backend's single positionless `invalid_filter`. Twelve named refusals, including
  `isMandateUnavailable` — every route is `HasWorkspaceMandateIfScoped` and can answer **503
  `error.503.mandate_unavailable`**, which is neither a permission failure nor a fault in anybody's
  configuration and now has an arm of its own on every read.

  **default skin** — `WebhooksSettingsPane` (the page), `SubscriptionsPane` (table on a desktop, cards on
  a phone; the active switch says that re-activating clears the failure count; a rule the backend switched
  off is marked as such), `SubscriptionSheet` (event picker read from the deployment's catalogue, target
  fields per delivery type, live filter validation), `SecretReveal` / `SecretRotation` (shown once, copy
  control with an `aria-label`, acknowledgement as the only exit, and a confirm that names the missing
  overlap window instead of asking "are you sure?"), `DeliveriesPane` + `DeliveryDetailSheet` (retention
  stated, replay gated to dead letters with the reason beside it, envelope and headers rebuilt and
  labelled as rebuilt — the signature deliberately not fabricated), `MandateNotice`.

  **nav** — one entry, `account.webhooks`, as a submenu under `profiles.settings`: webhooks are developer
  settings, not a third of a product's primary navigation.

  i18n en/ru/es complete over the pair's own keys and the backend's 53 error codes. Nine demos with phone
  variants; 137 tests.

  BREAKING (pre-1.0, so a minor): the scaffold's `WebhooksPanel` is gone, replaced by
  `WebhooksSettingsPane`; the nav entry id changed from `webhooks.overview` to `account.webhooks` and
  moved from top level to a settings submenu; the `webhooks.panel.*` / `webhooks.nav.overview` keys are
  replaced. The `@stapel/core` peer floor rises to `>=0.18.0` (the shared skin substrate).

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
