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
  and `no-raw-fetch` **off** in the codegen api layer (`**/api/**`, `*client.ts`);
- **overrides** the content rules off in tests and fixtures (they exercise the
  anti-patterns on purpose).

## Rules

| Rule | Catches |
|---|---|
| `stapel/no-raw-colors` | hex/rgb/hsl/named colours in style objects & CSS templates; Tailwind arbitrary colour values `bg-[#…]`; arbitrary values built by interpolation `bg-[${x}]` (JIT-invisible); bare raw-ramp refs `gray.500` |
| `stapel/no-raw-token-import` | importing `@stapel/tokens/raw` outside theme-config / showcase |
| `stapel/no-raw-fetch` | `fetch` / `globalThis.fetch` / `new XMLHttpRequest()` / `axios` / `ky` outside the codegen client |
| `stapel/i18n-key-exists` | `t("…")` keys absent from the generated registry (only within a managed namespace — app-local keys are left alone) |
| `stapel/no-hardcoded-text` | user-facing JSX text and `alt`/`title`/`placeholder`/`aria-*` string literals |
| `stapel/require-disable-description` | an `eslint-disable` without a `-- reason` (§2.4 escape-hatch policy) |
| `stapel/clickable-needs-event` | an interactive JSX element (`onClick`/`onSubmit`/…) with no analytics outcome — needs `tracked()`/`trackedSubmit()`, `data-analytics="flow"`, or `data-analytics="none"` + a reason (§3.2). Decorative `stopPropagation`/`preventDefault`-only handlers are exempt |
| `stapel/no-double-count` | `tracked()`/`trackedSubmit()` over a handler that also steps a flow machine (`run`/`step`/`submit*`, or `data-analytics="flow"` on the same element) — the funnel already auto-emits (hard ban, Q12а / §3.2) |
| `stapel/event-literal-meta` | `defineEvent()` with a non-literal argument (dynamic `name`/`description`, non-`prop.*` props) — breaks static extraction into `events.json` (§3.1) |
| `stapel/known-event` (warn) | `track()`/`tracked()` with an event name absent from the generated `events.json` — registry drift; run `pnpm gen:events` (§3) |

### Settings

Rules resolve their catalogs automatically; override for non-standard layouts:

```js
settings: {
  stapel: {
    tokensManifest: {...},      // or tokensManifestPath
    i18nKeys: ["auth.otp.…"],   // or i18nManifests: [manifest, …]
    httpModules: ["my-http"],   // extra banned HTTP clients
    rawModules: ["@x/raw"],     // extra raw-token entry points
    eventsManifests: [manifest],// or eventNames: ["pricing.plan.selected", …]
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
