# @stapel/notifications-react — module guide

Headless React flow pair for **stapel-notifications**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## Layers

- **api/** — `createNotificationsApi(client)`; types are aliases over the generated
  `components["schemas"]` from `@stapel/core` (never parallel hand-written
  bodies). Named typed operations arrive with gen-api v2 (`core-typed-ops`);
  hand-authored, un-generatable surface lives in `api/extensions.ts`.
- **model/** — `notificationsQueryKeys` (single key factory, `["notifications"]`
  namespace), `createNotificationsRuntime`, React context/hooks. Declare the
  persist/optimistic policy here as you add read hooks and mutations.
- **flows/** — `createFlowMachine`-based machines (primitive imported from
  `@stapel/core`), bound to the generated `NOTIFICATIONS_FLOWS` registry. Scaffold
  new machines from flows.json; keep them under `gen:flows:check`.
- **headless/** — render-prop components; `<NotificationsProvider>` wires the
  runtime into context. shadcn-copyable (frontend-standard §7).
- **i18n/** — `NOTIFICATIONS_I18N_KEYS` + en bundle; the generated backend error
  bundle is merged in so every `error.*` code has a fallback.
- **analytics/** — `generated/events.json`, the typed-event registry projected
  from `defineEvent` call sites + flow funnels (`pnpm gen:events`). Read by the
  analytics lint and embedded into `manifest.json`; nothing to hand-edit.
- **demo/** — first-class demos (`defineDemo`, `@stapel/showcase`): `_harness.tsx`
  wires a mock runtime + i18n + query client; each `<Name>.demo.tsx` is compiled,
  product-linted, smoke-rendered, and projected to a Ladle story (`pnpm gen:demos`).
  The completeness gate requires ≥1 demo per exported headless component; the
  starter `Notifications.demo.tsx` covers `NotificationsProvider`. Demos never ship.

## Extension seams (frontend-standard §7)

- Client is injected via `<NotificationsProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client.
- Flow deps are injected through `create<X>Flow(deps)` factories.
- The headless layer is fully replaceable (copy-and-own).

## TODO after scaffold

1. `pnpm install && pnpm gen` — materialize the generated surfaces.
2. Alias the stapel-notifications schemas you use in `api/types.ts`.
3. Add read hooks + mutations in `model/` and a persist/optimistic policy.
4. Once stapel-notifications annotates `@flow_step`, scaffold flow machines from
   flows.json and put them under `gen:flows:check`.
5. Fill `MODULE.md`'s machine table and link the SA-doc flows.
