# stapel-react

React/TypeScript monorepo of the Stapel frontend pipeline. Every Stapel backend
library with endpoints gets a paired React library that implements its flows
**business-wise and state-wise, but headless** — no visual constraints, any
design layers on top. The machine input for each pair is the backend's
documentation artifacts: `openapi.json` (+ `x-stapel-flows`,
`x-stapel-verification`) and `flows.json`.

Normative standard: [`docs/frontend-standard.md`](../docs/frontend-standard.md)
in the main Stapel repository (mirrors `library-standard.md` on the backend
side).

## Layers

| Layer | Package(s) | Responsibility |
|---|---|---|
| L0 | `@stapel/core` | Runtime: typed fetch, `StapelError` envelope, auth tokens/refresh, verification-403 interception, query layer (TanStack Query) + persist adapters, i18n engine, config provider (base URLs) |
| L0 | `@stapel/tokens` | Design tokens: semantic colors (light/dark pairs), typography, spacing, radii, 3 breakpoints. CSS variables + TS types. NOT components |
| L1 | `@stapel/ui` (optional) | Headless primitives, styleable only via tokens; a reference, not an obligation |
| L2 | `@stapel/auth-react`, `@stapel/billing-react`, `@stapel/…-react` | Pair to a backend module: generated client, hooks, flow machines, headless components, translation keys |
| L3 | host applications | Visuals, composition, routing |

Dependency direction is strictly downward; L2 packages never import each other
(cross-module scenarios go through core events/contracts).

## Packages

| Package | Status |
|---|---|
| [`@stapel/tokens`](./packages/tokens) | bootstrapped |
| [`@stapel/core`](./packages/core) | bootstrapped |
| `@stapel/auth-react` | planned (first L2 pair, per standard §8) |

## Toolchain

pnpm workspaces + Turborepo + Changesets. Node ≥ 22. Packages are published to
npm individually under the `@stapel/*` scope, each standalone-buildable and
shipping `src/` in the tarball (frontend-standard §7).

```sh
corepack pnpm install
corepack pnpm run ci   # lint + test + build via turbo
```

## License

MIT © Stapel contributors
