# @stapel/webhooks-react — module guide

Headless React flow pair for **stapel-webhooks**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## Layers

- **api/** — `createWebhooksApi(client)`; types are aliases over the
  package-LOCAL generated `components["schemas"]` (`src/api/generated/schema.ts`,
  produced by `pnpm gen:api` from stapel-webhooks's own `docs/schema.json`; never
  parallel hand-written bodies). Named typed operations arrive with gen-api v2
  (`core-typed-ops`); hand-authored, un-generatable surface lives in
  `api/extensions.ts`.
- **model/** — `webhooksQueryKeys` (single key factory, `["webhooks"]`
  namespace), `createWebhooksRuntime`, React context, and the pair's reads and
  writes: `useEventCatalog`, `useSubscriptions`, `useSubscription`,
  `useSubscriptionForm`, `useSecretRotation`, `useDeliveries`, `useDelivery`.
  Also three things that are model, not skin, and are exported for a host
  writing its own screens: `filter.ts` (the port of the backend's predicate
  grammar), `deliveryTypes.ts` (the built-in registry's target shapes) and
  `refusals.ts` (twelve named error predicates, `isMandateUnavailable` among
  them). No optimistic writes: every mutation invalidates and re-reads, because
  the server decides which rules are yours to see and a spliced row would not
  survive the refetch.
- **flows/** — `toFlowError` + the zero-flow `WEBHOOKS_FLOWS` registry shim
  (`registry.ts`, slim wave §21/S3 — `gen:flows` emits no scaffolding for a
  zero-flow module). Once stapel-webhooks annotates `@flow_step`, `pnpm gen:flows`
  emits `generated/flows.gen.ts`: swap the shim for re-exports, scaffold
  `createFlowMachine`-based machines (primitive imported from `@stapel/core`)
  and keep them under `gen:flows:check`.
- **headless/** — render-prop components; `<WebhooksProvider>` wires the
  runtime into context. shadcn-copyable (frontend-standard §7).
- **i18n/** — `WEBHOOKS_I18N_KEYS` + en bundle; the generated backend error
  bundle is merged in so every `error.*` code has a fallback.
- **analytics/** — `generated/events.json`, the typed-event registry projected
  from `defineEvent` (`@stapel/analytics` — the impl package; core keeps only
  the type seam, slim wave §21/S1) call sites + flow funnels (`pnpm gen:events`).
  Read by the analytics lint and embedded into `manifest.json`; nothing to
  hand-edit.
- **demo/** — first-class demos (`defineDemo`, `@stapel/showcase`): `_harness.tsx`
  wires a mock runtime + i18n + query client; each `<Name>.demo.tsx` is compiled,
  product-linted, smoke-rendered, and projected to a Ladle story (`pnpm gen:demos`).
  The completeness gate requires ≥1 demo per exported headless component AND one
  per `src/default` export, each with a `phone` variant. Demos never ship.

## Extension seams (frontend-standard §7)

- Client is injected via `<WebhooksProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client.
- Flow deps are injected through `create<X>Flow(deps)` factories.
- The headless layer is fully replaceable (copy-and-own).

## What the backend does not serve, and where it lives instead

stapel-webhooks 0.1.1 ships its own contract triad, so schema and errors are
generated. Five facts the screens need are still settings rather than fields;
each one has exactly one home in this package and a comment saying why:

| Fact | Where it is | Backend source |
|---|---|---|
| Delivery-type target keys, and which types are signed | `model/deliveryTypes.ts` | `registry.py` `BUILTIN_DELIVERY_TYPES` |
| Filter grammar + max depth | `model/filter.ts` | `filters.py`, `conf.py` `MAX_FILTER_DEPTH` |
| Delivery-row retention | `createWebhooksRuntime({ retention })`, default `DEFAULT_RETENTION` | `conf.py` `SUCCEEDED_/DEAD_RETENTION_DAYS` |
| Signature scheme + headers for a receiver | `createWebhooksRuntime({ docsHref })` — the host's own docs, never pasted copy | `signing.py`, `transport.py` |
| The auto-disable threshold | nowhere: the copy says "after repeated failures" | `conf.py` `DISABLE_AFTER_DEAD` |

The list is deliberately short and deliberately visible: each row is a place a
deployment can diverge from this package, and each one is a candidate for a
field on `GET event-catalog` (which would delete the row).

## TODO

1. Once stapel-webhooks annotates `@flow_step`, scaffold flow machines from
   flows.json and put them under `gen:flows:check`.
2. If the backend starts serving `required_target_keys` / retention on the
   catalogue, delete `model/deliveryTypes.ts`'s mirror and the `retention`
   runtime option rather than keeping both.
