# @stapel/moderation-react

Headless React flow pair for stapel-moderation: typed API client, TanStack Query hooks, flow machines, headless components, and i18n keys. Zero visual opinion.

Headless React flow pair for **stapel-moderation** (frontend-standard §2). Business +
state only, zero visual opinion — any design layers on top. Built on
`@stapel/core` (typed client + `StapelApiError` envelope, token refresh,
verification-403 interception, i18n engine, analytics seam, TanStack Query).

Scaffolded by `stapel-new-react-lib`. See `MODULE.md` for the layer map, machine
table, extension seams, and persist policy.

## Install

```
pnpm add @stapel/moderation-react @stapel/core @tanstack/react-query react
```

## Wire the app once

One `<StapelProvider>` for the whole app (core's config + query + i18n in a
single component — slim wave §21/S4), one `<ModerationProvider>` for this pair:

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import {
  createModerationRuntime,
  ModerationProvider,
  registerModerationI18n,
} from "@stapel/moderation-react";

const runtime = createModerationRuntime({ baseUrl: "/moderation/api/v1/" });
const i18n = createI18n({ locale: "en" });
registerModerationI18n(i18n); // the pair's key bundle → core's engine

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.0.0">
      <ModerationProvider runtime={runtime}>{children}</ModerationProvider>
    </StapelProvider>
  );
}
```

Hooks and headless components work anywhere below `<ModerationProvider>`
(`useModerationApi`, the query/mutation hooks you add in `model/`, the
render-prop components — see `MODULE.md`). Already wired a `<StapelProvider>`
for another pair (or auth-react)? Keep the ONE provider: pass this runtime's
client as a per-module override — `clients={{ moderation: runtime.client }}` —
and nest `<ModerationProvider>` next to your other pair providers. The
individual core providers (`StapelConfigProvider` + `QueryClientProvider` +
`I18nProvider`) remain exported for bespoke composition.

## Layers

```
src/
  api/        typed client — thin adapter over this pair's own generated `components`
  model/      query keys, runtime wiring, context/hooks
  flows/      toFlowError + zero-flow registry shim (machines + generated
              registry arrive with the backend's first @flow_step)
  headless/   renderless components (ModerationProvider, flow render-props)
  i18n/       translation keys + generated backend error map
  analytics/  generated typed-event registry (events.json)
demo/         first-class demos (compiled, product-linted, smoke-rendered)
```

`./default` is the pair's **shipped** half: `<ModerationPanel/>`, themed through
`SkinTheme` from `@stapel/tokens-antd/skin` (one bridge for the whole fleet — a
pair never mounts its own `ConfigProvider` and never defaults a theme mode).
Importing it is the opt-in that pulls `antd`; a host with its own design system
keeps importing the root entry and draws its own screens.

```tsx
import { ModerationPanel } from "@stapel/moderation-react/default";
import { registerModerationI18nRu } from "@stapel/moderation-react/i18n/ru";
```

Locales ship as subpaths (`./i18n/ru`, `./i18n/es`) so a host carries only the
ones it registers; `test/i18nParity.test.ts` fails the build if a key exists in
en and not in ru/es. Product rules for this pair: `docs/guidelines.md`.

## Generated surfaces (drift-gated)

| Surface | Path | Gate |
|---|---|---|
| Typed API schema | `src/api/generated/schema.ts`, from stapel-moderation's own `docs/schema.json` | `pnpm gen:api:check` |
| Flow registry | none — zero-flow module (`src/flows/registry.ts` shim); `gen:flows` emits `src/flows/generated/` once the backend documents flows | `pnpm gen:flows:check` |
| Backend error map + en bundle | `src/i18n/generated/` | `pnpm gen:errors:check` |
| Typed-event registry | `src/analytics/generated/events.json` | `pnpm gen:events:check` |
| Demos → Ladle stories | `demo/generated/` | `pnpm gen:demos:check` |
| `manifest.json` + `llms.txt` | package root | `pnpm gen:manifest:check` |

These drift gates run at the **monorepo root** (`pnpm gen` / `pnpm gen:check`) —
the etalon's env-parametrized `scripts/gen-*.mjs` drivers are shared, not forked.
`stapel-new-react-lib` wired this pair into the root `gen`/`gen:check` aggregates
at scaffold time (one env-parametrized invocation per driver, including
`gen:api`). The typed `schema.ts` is package-LOCAL, generated from
stapel-moderation's own `docs/schema.json`; design tokens are tokens-owned
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
