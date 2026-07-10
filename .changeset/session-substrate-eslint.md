---
"@stapel/eslint-plugin": minor
---

Two session-substrate guardrails (frontend-core-architecture-v2 §43), both in
the `recommended` preset:

- **`stapel/no-raw-storage`** (§43.4) — direct `localStorage` /
  `sessionStorage` / `indexedDB` access (bare, or via
  `window.`/`globalThis.`/`self.`) and `idb-keyval` imports are banned
  outside `@stapel/core`'s repository layer; persist through
  `createRepository()` (wipe-at-logout + encryption live there). Scope-aware:
  a local binding that merely shares the name is not flagged. Carve-outs:
  core's `storage.ts`/`repository.ts`/`query.ts`, tests. Extra banned
  backends via `options.modules` / `settings.stapel.storageModules`.
- **`stapel/no-adhoc-401`** (§43.2) — comparing a status to the literal `401`
  (`===`/`!==`/`case 401:`) or wiring an axios-style `*.interceptors` chain
  outside core's client/SessionManager; 401 handling is single-flight refresh
  → retry once → session lost, in ONE place. Carve-outs: core's
  `client.ts`/`session.ts`, tests.
