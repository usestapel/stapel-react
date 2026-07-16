# @stapel/workspaces-react

Headless React flow pair for stapel-workspaces: typed API client, TanStack Query hooks, flow machines, headless components, and i18n keys. Zero visual opinion.

Headless React flow pair for **stapel-workspaces** (frontend-standard §2). Business +
state only, zero visual opinion — any design layers on top. Built on
`@stapel/core` (typed client + `StapelApiError` envelope, token refresh,
verification-403 interception, i18n engine, analytics seam, TanStack Query).

Scaffolded by `stapel-new-react-lib`. See `MODULE.md` for the layer map, machine
table, extension seams, and persist policy.

## Install

```
pnpm add @stapel/workspaces-react @stapel/core @tanstack/react-query react
```

## Wire the app once

One `<StapelProvider>` for the whole app (core's config + query + i18n in a
single component — slim wave §21/S4), one `<WorkspacesProvider>` for this pair:

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import {
  createWorkspacesRuntime,
  WorkspacesProvider,
  registerWorkspacesI18n,
} from "@stapel/workspaces-react";

const runtime = createWorkspacesRuntime({ baseUrl: "/workspaces/api/v1/" });
const i18n = createI18n({ locale: "en" });
registerWorkspacesI18n(i18n); // the pair's key bundle → core's engine

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.1.0">
      <WorkspacesProvider runtime={runtime}>{children}</WorkspacesProvider>
    </StapelProvider>
  );
}
```

Hooks and headless components work anywhere below `<WorkspacesProvider>`
(`useWorkspacesApi`, the query/mutation hooks, the render-prop components — see
`MODULE.md`). Already wired a `<StapelProvider>` for another pair (or
auth-react)? Keep the ONE provider: pass this runtime's client as a
per-module override — `clients={{ workspaces: runtime.client }}` — and nest
`<WorkspacesProvider>` next to your other pair providers. The individual core
providers (`StapelConfigProvider` + `QueryClientProvider` + `I18nProvider`)
remain exported for bespoke composition.

## Layers

```
src/
  api/        typed client — thin adapter over @stapel/core `components`
  model/      query keys, runtime wiring, context/hooks
  flows/      toFlowError + zero-flow registry shim (machines + generated
              registry arrive with the backend's first @flow_step)
  headless/   renderless components (WorkspacesProvider, flow render-props)
  i18n/       translation keys + generated backend error map
  analytics/  generated typed-event registry (events.json)
demo/         first-class demos (compiled, product-linted, smoke-rendered)
```

## Generated surfaces (drift-gated)

| Surface | Path | Gate |
|---|---|---|
| Flow registry | none — zero-flow module (`src/flows/registry.ts` shim); `gen:flows` emits `src/flows/generated/` once the backend documents flows | `pnpm gen:flows:check` |
| Backend error map + en bundle | `src/i18n/generated/` | `pnpm gen:errors:check` |
| Typed-event registry | `src/analytics/generated/events.json` | `pnpm gen:events:check` |
| Demos → Ladle stories | `demo/generated/` | `pnpm gen:demos:check` |
| `manifest.json` + `llms.txt` | package root | `pnpm gen:manifest:check` |

These drift gates run at the **monorepo root** (`pnpm gen` / `pnpm gen:check`) —
the etalon's env-parametrized `scripts/gen-*.mjs` drivers are shared, not forked.
`stapel-new-react-lib` wired this pair into the root `gen`/`gen:check` aggregates
at scaffold time (one env-parametrized invocation per driver). The typed
`schema.ts` is core-owned (`pnpm gen:api`); design tokens are tokens-owned
(`pnpm gen:tokens`).

### Russian locale (opt-in subpath)

The `ru` bundle ships as a separate subpath so it never bloats the main entry
(size-limit gated — the locale stays out of hosts that don't register it):

```tsx
import { registerWorkspacesI18nRu } from "@stapel/workspaces-react/i18n/ru";

registerWorkspacesI18n(i18n);      // en floor + polish
registerWorkspacesI18nRu(i18n);    // ru locale (generated from the backend catalog)
await i18n.setLocale("ru");        // live switch; a missing key degrades to English
```

Backend error texts are generated from stapel-workspaces's
`translations/errors.ru.json` catalog (`pnpm gen:errors`, drift-gated); the
pair's UI keys carry hand-written ru copy. Register your own bundle AFTER the
pair's to override any key — registration order is override priority.

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
