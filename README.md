# stapel-react

[![CI](https://github.com/usestapel/stapel-react/actions/workflows/ci.yml/badge.svg)](https://github.com/usestapel/stapel-react/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40stapel%2Fcore.svg?label=%40stapel%2Fcore)](https://www.npmjs.com/package/@stapel/core)
[![npm](https://img.shields.io/npm/v/%40stapel%2Ftokens.svg?label=%40stapel%2Ftokens)](https://www.npmjs.com/package/@stapel/tokens)
[![npm](https://img.shields.io/npm/v/%40stapel%2Fauth-react.svg?label=%40stapel%2Fauth-react)](https://www.npmjs.com/package/@stapel/auth-react)

React/TypeScript monorepo of the Stapel frontend pipeline. Every Stapel backend
library with endpoints gets a paired React library that implements its flows
**business-wise and state-wise, but headless** — no visual constraints, any
design layers on top. The machine input for each pair is the backend module's
own committed contract artifacts (§17 per-module pipeline):
`docs/schema.json`, `docs/flows.json`, `docs/errors.json`, plus its locale
catalogs.

Normative standard: [`docs/reference/frontend-standard.md`](../docs/reference/frontend-standard.md)
in the main Stapel repository (mirrors `library-standard.md` on the backend
side).

## Layers

| Layer | Package(s) | Responsibility |
|---|---|---|
| L0 | `@stapel/core` | Runtime: typed fetch, `StapelError` envelope, auth token/refresh seams, verification-403 interception, query layer (TanStack Query) + per-user persistence, i18n engine, config provider, `<StapelProvider>` one-provider setup, module-pair factories, analytics type seam |
| L0 | `@stapel/tokens` | Design tokens: semantic colors (light/dark pairs), typography, spacing, radii, 3 breakpoints. CSS variables + TS types. NOT components |
| L0 | `@stapel/analytics` | Analytics facade implementation behind core's type seam: consent gate, PII guard, offline queue, provider fan-out, typed `defineEvent`/`tracked`. Mandatory in stapel-studio apps; optional for OSS consumers |
| L2 | `@stapel/<module>-react` (7 pairs) | Pair to a backend module: generated typed client, TanStack Query hooks, flow machines, headless components, i18n keys, self-describing `manifest.json`/`llms.txt` |
| L3 | host applications | Visuals, composition, routing |

Dependency direction is strictly downward; L2 packages never import each other
(cross-module scenarios go through core events/contracts).

## Packages

| Package | Pairs with |
|---|---|
| [`@stapel/tokens`](./packages/tokens) | — (design tokens) |
| [`@stapel/core`](./packages/core) | — (shared runtime) |
| [`@stapel/analytics`](./packages/analytics) | — (facade impl over core's seam) |
| [`@stapel/eslint-plugin`](./packages/eslint-plugin) | — (guardrails preset) |
| [`@stapel/auth-react`](./packages/auth-react) | stapel-auth (flagship: session, factors, step-up verification) |
| [`@stapel/profiles-react`](./packages/profiles-react) | stapel-profiles |
| [`@stapel/notifications-react`](./packages/notifications-react) | stapel-notifications |
| [`@stapel/billing-react`](./packages/billing-react) | stapel-billing |
| [`@stapel/workspaces-react`](./packages/workspaces-react) | stapel-workspaces |
| [`@stapel/calendar-react`](./packages/calendar-react) | stapel-calendar |
| [`@stapel/recordings-react`](./packages/recordings-react) | stapel-recordings |
| [`@stapel/showcase`](./packages/showcase) | — (demo harness: `defineDemo`) |

Each pair's version minor tracks its backend module's minor (scheme B); its
`manifest.json` pins the backend contract range and is drift-gated.

## Setup ceremony

Install → `create<Mod>Runtime` per pair → ONE `<StapelProvider>` + per-pair
`<ModProvider>`:

```tsx
import { StapelProvider } from "@stapel/core";
import { createProfilesRuntime, ProfilesProvider } from "@stapel/profiles-react";

const runtime = createProfilesRuntime({ baseUrl: "/profiles/api/" });

<StapelProvider client={runtime.client} cacheVersion="0.1.0">
  <ProfilesProvider runtime={runtime}>{app}</ProfilesProvider>
</StapelProvider>;
```

`<StapelProvider>` composes core's `StapelConfigProvider` +
`QueryClientProvider` + `I18nProvider`; the individual providers stay exported
for bespoke composition. See each pair's README for its Install + Wire
section (auth-react's shows the full flagship wiring: token refresh,
verification challenge, teardown).

## Toolchain

pnpm workspaces + Turborepo + Changesets. Node ≥ 22. Packages are published to
npm individually under the `@stapel/*` scope, each standalone-buildable and
shipping `src/` in the tarball (frontend-standard §7).

```sh
corepack pnpm install
corepack pnpm run ci   # gen drift gates + lint + test + build + size + pack tests
```

## Contract codegen (per-module, drift-gated)

Every generated surface is derived from the paired backend module's own
committed contract (`../stapel-<module>/docs/*`) by env-parametrized drivers in
`scripts/` — no monolith aggregate, no hand-written wire types:

```sh
pnpm gen          # regenerate everything (api, flows, errors, events, demos, manifest, tokens)
pnpm gen:check    # drift gates: regenerate + `git diff --exit-code` (red CI on drift)
```

| Driver | Emits |
|---|---|
| `gen-api.mjs` | `src/api/generated/schema.ts` per pair (openapi-typescript; types only, zero runtime bytes) |
| `gen-flows.mjs` | `src/flows/generated/` flow registry — only for modules that document flows (zero-flow pairs carry a tiny shim instead) |
| `gen-errors.mjs` | backend error map + en/ru bundles per pair |
| `gen-events.mjs` | `events.json` typed-event registry per pair |
| `gen-manifest.mjs` | self-describing `manifest.json` + `llms.txt` per pair |
| `gen-tokens.mjs` | `@stapel/tokens` generated ramps/variables |

CI pins sibling-backend checkouts to immutable refs (`contract-pins.json`) so
the gates are reproducible.

## License

MIT © Stapel contributors
