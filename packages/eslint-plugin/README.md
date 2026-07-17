# @stapel/eslint-plugin

The enforcement tier of the Stapel frontend guardrails (frontend-guardrails §2):
static lint rules that close the bypass paths a design system leaves open. Every
rule is **data-driven** — it reads the same generated manifests the codegen
writes (`@stapel/tokens/manifest.json`, pair i18n key registries), so lint and
code never drift. Error messages **teach**: what's wrong, what to do instead, and
where the catalog lives.

## Install

```sh
pnpm add -D @stapel/eslint-plugin
```

## Flat config

```js
// eslint.config.mjs
import tseslint from "typescript-eslint";
import stapel from "@stapel/eslint-plugin";

export default [
  ...tseslint.configs.strict,
  ...stapel.configs.recommended, // spread LAST — its file overrides must win
];
```

The `recommended` preset:

- turns the rules on for `**/*.{ts,tsx,js,jsx,mjs,…}` (JSX-only rules on `*.{tsx,jsx}`);
- **overrides** `no-raw-token-import` **off** in theme-config / showcase / demo / scripts,
  `no-raw-fetch` and `no-string-paths` **off** in the codegen api layer
  (`**/api/**`, `*client.ts`, `generated/`), `query-keys-from-factory`
  **off** in the key-factory file (`**/queryKeys.*`), `no-raw-storage` **off**
  in core's storage/repository internals, and `no-adhoc-401` **off** in core's
  client/session (each rule's one legal home);
- **overrides** the content rules off in tests and fixtures (they exercise the
  anti-patterns on purpose).

### `reserved-paths.json`

`stapel/no-reserved-backend-route` reads a project-root `reserved-paths.json`
(no fixed location config beyond `settings.stapel.reservedPathsFile` — see
below), the same flat projection stapel-tools' project generator emits:

```json
{
  "reservedPathPrefixes": [
    "/admin",
    "/staticfiles",
    "/media",
    "/calendar/api",
    "/calendar/swagger"
  ]
}
```

`reservedPathPrefixes` is a flat array of path prefixes the backend owns. A
route is flagged when it **equals** a prefix or continues **past a segment
boundary** beneath one (`/calendar/api/x` matches `/calendar/api`;
`/calendar-archive` does not). **Never** put a bare module root
(`/calendar`) in this list — the generator only emits sub-path reservations,
because a bare root belongs to the frontend SPA by convention. If the file is
missing, the rule is a no-op — it never fails the lint run.



## Rules

| Rule | Catches |
|---|---|
| `stapel/no-raw-colors` | hex/rgb/hsl/named colours in style objects & CSS templates; Tailwind arbitrary colour values `bg-[#…]`; arbitrary values built by interpolation `bg-[${x}]` (JIT-invisible); bare raw-ramp refs `gray.500` |
| `stapel/no-raw-token-import` | importing `@stapel/tokens/raw` outside theme-config / showcase |
| `stapel/no-raw-fetch` | `fetch` / `globalThis.fetch` / `new XMLHttpRequest()` / `axios` / `ky` outside the codegen client |
| `stapel/no-string-paths` | a hand-written API path — `client.get("/…")` on an http verb, or a bare literal/template that IS a catalogued operation path (`manifest.json §operations`) — outside the codegen api layer. Call the named operation instead. Off in `api/`, `*client.ts`, `generated/` |
| `stapel/query-keys-from-factory` | an inline `queryKey`/`mutationKey` array literal in `useQuery`/`useMutation`/`queryClient.*` — keys come only from the module's `<module>QueryKeys` factory (drift from invalidations otherwise). Off in the factory file (`**/queryKeys.*`) |
| `stapel/i18n-key-exists` | `t("…")` keys absent from the generated registry (only within a managed namespace — app-local keys are left alone) |
| `stapel/no-hardcoded-text` | user-facing JSX text and `alt`/`title`/`placeholder`/`aria-*` string literals |
| `stapel/require-disable-description` | an `eslint-disable` without a `-- reason` (§2.4 escape-hatch policy) |
| `stapel/clickable-needs-event` | an interactive JSX element (`onClick`/`onSubmit`/…) with no analytics outcome — needs `tracked()`/`trackedSubmit()`, `data-analytics="flow"`, or `data-analytics="none"` + a reason (§3.2). Decorative `stopPropagation`/`preventDefault`-only handlers are exempt |
| `stapel/no-double-count` | `tracked()`/`trackedSubmit()` over a handler that also steps a flow machine (`run`/`step`/`submit*`, or `data-analytics="flow"` on the same element) — the funnel already auto-emits (hard ban, Q12а / §3.2) |
| `stapel/event-literal-meta` | `defineEvent()` with a non-literal argument (dynamic `name`/`description`, non-`prop.*` props) — breaks static extraction into `events.json` (§3.1) |
| `stapel/known-event` (warn) | `track()`/`tracked()` with an event name absent from the generated `events.json` — registry drift; run `pnpm gen:events` (§3) |
| `stapel/no-direct-analytics-provider` | importing an analytics vendor SDK (posthog-js, mixpanel, `@amplitude/*`, `@segment/*`, …) outside the core facade's provider adapters (`analytics/providers.*`) — bypasses consent/PII/queue (§3). Extend the vendor list via `options.providers` or `settings.stapel.providerModules` |
| `stapel/demo-literal-meta` | `defineDemo()` with non-literal meta (dynamic `id`/`title`/`description`/`covers`) — breaks static extraction into `demos.json`/`manifest.demos` (§4.2) |
| `stapel/no-raw-storage` | direct `localStorage`/`sessionStorage`/`indexedDB` (bare or via `window.`/`globalThis.`/`self.`) or importing `idb-keyval` outside `@stapel/core`'s repository layer — raw storage is neither wiped on logout nor encrypted; persist through `createRepository()` (frontend-core-architecture-v2 §43.4). Off in core's `storage.ts`/`repository.ts`/`query.ts` (the one legal home) and in tests. Extend the banned module list via `options.modules` or `settings.stapel.storageModules` |
| `stapel/no-adhoc-401` | comparing a status to the literal `401` (`===`/`!==`/`case 401:`) or wiring an axios-style `*.interceptors` chain — ad hoc 401 handling bypasses the single-flight refresh + logout-hook registry; 401s are handled ONCE, in core's `createStapelClient` (`onAuthRefresh` seam) + `SessionManager` (§43.2). Off in core's `client.ts`/`session.ts` and in tests |
| `stapel/no-reserved-backend-route` | an SPA route (`<Route path="…">`, a `createBrowserRouter`/`createHashRouter`/`createMemoryRouter` array literal, or any `{ path: "…", element/Component/children/index/errorElement/loader/action/lazy: … }` RouteObject) whose path falls INTO a reserved backend sub-path — `/<mod>/api/…`, `/<mod>/swagger…`, or the project-wide `/admin`, `/staticfiles`, `/media` (§57 nginx canon). A **bare module root** (`/calendar`) is legitimate and never flagged — roots belong to the frontend; only sub-paths collide. Data-driven: reads the flat `reservedPathPrefixes` array from `reserved-paths.json` (emitted by stapel-tools' project generator) at the workspace root, or `settings.stapel.reservedPathsFile`/`reservedPaths`. No catalog → no-op (never a crash) |

### Settings

Rules resolve their catalogs automatically; override for non-standard layouts:

```js
settings: {
  stapel: {
    tokensManifest: {...},      // or tokensManifestPath
    i18nKeys: ["auth.otp.…"],   // or i18nManifests: [manifest, …]
    httpModules: ["my-http"],   // extra banned HTTP clients
    rawModules: ["@x/raw"],     // extra raw-token entry points
    storageModules: ["level"],  // extra banned storage-backend packages
    eventsManifests: [manifest],// or eventNames: ["pricing.plan.selected", …]
    operationsManifests: [manifest], // or operationPaths: ["/auth/api/v1/me/", …]
    reservedPathsFile: "./reserved-paths.json", // or reservedPaths: ["/admin", …]
    httpVerbs: ["get","post"],   // client methods no-string-paths inspects
    queryHooks: ["useQuery"],    // extra react-query hooks to inspect for keys
    trackedWrappers: ["tracked"],
    clickHandlers: ["onClick"], // extra interactive handler props
  },
}
```

## Stylelint preset

A self-contained stylelint plugin (no third-party strict-value dependency): colour
properties may only be `var(--stapel-*)`, and no hex/rgb/hsl literal is allowed in
any declaration.

```js
// stylelint.config.js
import stapelPreset from "@stapel/eslint-plugin/stylelint/preset";
export default { ...stapelPreset };
```
