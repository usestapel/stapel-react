# @stapel/video-react — module guide

Headless React flow pair for **stapel-video**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## Layers

- **api/** — `createVideoApi(client)`; types are aliases over the
  package-LOCAL generated `components["schemas"]` (`src/api/generated/schema.ts`,
  produced by `pnpm gen:api` from stapel-video's own `docs/schema.json`; never
  parallel hand-written bodies). Named typed operations arrive with gen-api v2
  (`core-typed-ops`); hand-authored, un-generatable surface lives in
  `api/extensions.ts`.
- **model/** — `videoQueryKeys` + `usageQueryKeys` (the key factories, all
  under the `["video"]` namespace; the requested time zone is part of every
  usage key because it decides where the month buckets are CUT),
  `createVideoRuntime` (which also carries the host's optional `scopeKey`),
  React context/hooks, `queries.ts` (`useScopeUsage` — the window read and the
  month read, kept as two entries so clicking through months does not re-ask
  for the window), and `usage.ts` (the ONE place `months`/`users` being absent
  on the wire becomes an empty array, plus `formatPresence`, `usageTotals` and
  the two refusal predicates). No mutations: the pair's whole surface is one
  read, so there is no optimistic policy to declare.
- **flows/** — `toFlowError` + the zero-flow `VIDEO_FLOWS` registry shim
  (`registry.ts`, slim wave §21/S3 — `gen:flows` emits no scaffolding for a
  zero-flow module). Once stapel-video annotates `@flow_step`, `pnpm gen:flows`
  emits `generated/flows.gen.ts`: swap the shim for re-exports, scaffold
  `createFlowMachine`-based machines (primitive imported from `@stapel/core`)
  and keep them under `gen:flows:check`.
- **headless/** — `<VideoProvider>` wires the runtime into context, and
  `<CallsProvider>` holds the 1:1 CALL for the whole app: the live call, the
  media grant, the ring clock, the cross-tab claim and the out-of-focus
  notification. It renders `children` and nothing else — `useCalls()` /
  `useIncomingCall()` are what a host's own overlay reads. It takes its live
  frames through a `subscribe` SEAM rather than importing a socket, so the
  main entry stays socket-free; `/default`'s `<LiveCallsProvider>` is the same
  provider with `@stapel/realtime` attached. Both shadcn-copyable
  (frontend-standard §7).
- **default/** — the antd skin, on its own subpath so the main entry carries no
  visual dependency: `<ScopeUsagePane>` (the wired screen the nav entry mounts)
  and `<ScopeUsageTable>` (the same table with the data handed in). Four arms,
  none collapsible into another — loading, the uniform 404 rendered as an
  explained refusal, any other failure with a retry, and a month that succeeded
  and holds nobody.
  The call surface lives here too: `<LiveCallsProvider>` + `<IncomingCallOverlay>`
  are mounted ONCE at the app root (a call arrives while the person is on some
  other page, so a provider mounted per-screen rings only for whoever was
  already looking), `<CallPanel>` is the 1:1 `renderMedia` for `<CallStage>`,
  and `<CallRoute>` is the three of them wired together for a host that just
  wants one. `callHooks.ts` carries the three phone workarounds — media
  session, wake lock, audio keep-alive — each a fix for an observed way a call
  dies in a pocket, and `useRingtone.ts` treats an autoplay refusal as a normal
  state rather than an error.
- **nav/** — one `NavEntry`, `admin.usage`, a submenu under the
  container-owned `admin.root`. The id names the MENU rather than the module
  because nobody looks for their team's call time under "Video"; `surface` is
  declared `member` explicitly, since a session is not a mandate.
- **i18n/** — `VIDEO_I18N_KEYS` + the inline en bundle and the opt-in
  `./i18n/ru` subpath; the generated backend error bundle is merged in so every
  `error.*` code has a fallback. The 9 keys stapel-video owns are authored in
  `i18n/ru.ts` because the module ships no `translations/` at all, so the
  generated ru bundle is a `Partial` over the 42 keys core owns.
- **analytics/** — `generated/events.json`, the typed-event registry projected
  from `defineEvent` (`@stapel/analytics` — the impl package; core keeps only
  the type seam, slim wave §21/S1) call sites + flow funnels (`pnpm gen:events`).
  Read by the analytics lint and embedded into `manifest.json`; nothing to
  hand-edit.
- **demo/** — first-class demos (`defineDemo`, `@stapel/showcase`): `_harness.tsx`
  wires a mock runtime + i18n + query client; each `<Name>.demo.tsx` is compiled,
  product-linted, smoke-rendered, and projected to a Ladle story (`pnpm gen:demos`).
  The completeness gate requires ≥1 demo per exported headless component;
  `Video.demo.tsx` covers `VideoProvider` and shows the usage read in its three
  reachable states (rows, a month holding nobody, the uniform refusal),
  `Ring.demo.tsx` covers `CallsProvider` by photographing the overlay OVER a
  page (seeded through `callQueryKeys.active`, because a canned fetch resolves
  a tick after a static render and four variants of an empty page are
  byte-identical), and `Calls.demo.tsx` is the call itself. `CallRoute` and
  `LiveCallsProvider` are in `demo/skin-coverage.allow.json` with why they
  cannot be photographed. Demos never ship.

## Extension seams (frontend-standard §7)

- Client is injected via `<VideoProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client.
- Flow deps are injected through `create<X>Flow(deps)` factories.
- The headless layer is fully replaceable (copy-and-own).

## Open, and written down rather than papered over

1. The nav entry hangs off `admin.root`, which no package in this monorepo
   declares — a container supplies it in its `stapel.nav.json` override.
   `resolveNav` drops an orphaned submenu entry instead of throwing, so a host
   without an admin area gets a smaller menu, not a broken build.
2. stapel-video ships no `translations/`, so this pair authors ru for the 9
   keys the module owns. When upstream ships `translations/errors.ru.json`,
   those nine lines are deleted and the generated bundle covers them — the keys
   and the texts do not move.
3. `manifest.json` lists all 8 contract paths; only the usage read has a typed
   operation. Adding the meeting endpoints later is additive.
4. No `@flow_step` upstream, so `flows/registry.ts` is still the zero-flow shim.
   Once stapel-video annotates flows, `pnpm gen:flows` emits
   `generated/flows.gen.ts` and the shim is replaced by re-exports.
