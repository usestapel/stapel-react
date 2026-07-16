---
"@stapel/auth-react": patch
---

Document the already-optional `antd` / `@stapel/tokens-antd` peer dependencies
in the README: the headless core (flows, `AuthProvider`, `createAuthRuntime`)
has zero UI dependency and works under any renderer on React `>=19` (MUI,
Chakra, plain HTML); only `@stapel/auth-react/default` (the §54 AntD skin)
needs `antd`/`@stapel/tokens-antd`, and `npm install` won't require or warn
about them otherwise.

Verified by fact-check (frontend-core-architecture-v2 §54 audit): `antd` and
`@stapel/tokens-antd` imports are confined to `src/default/*`; the main entry
never imports from `./default`. No React-19-only APIs (`use()`,
`useOptimistic`, `useFormStatus`, `useActionState`) are used anywhere in the
package — the `react: ">=19"` floor is a deliberate policy choice, not an API
constraint, so it is left unchanged. Confirmed with a `pnpm pack`'d tarball
smoke test: a minimal Vite + React 19 app with `@stapel/core` +
`@stapel/auth-react` installed and NO `antd` in `node_modules` builds and
initializes `createAuthRuntime()` cleanly.
