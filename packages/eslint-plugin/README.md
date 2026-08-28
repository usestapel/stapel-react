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
  in core's storage/repository internals, `no-adhoc-401` **off** in core's
  client/session, `no-flattened-load-state` **off** in the api/transport layer,
  and `no-raw-error-shape` **off** in the transport/error layer
  (`**/api/**`, `*client.ts`, `errors.ts`, plus Node-side `scripts/`/`bin/`,
  where `e.code` is an errno) (each rule's one legal home);
- **overrides** the content rules off in tests and fixtures (they exercise the
  anti-patterns on purpose);
- `no-cyrillic-source` / `no-mixed-script-word` (owner ruling 2026-08-09,
  English-only source fleet-wide) are **off only in tests** — their own test
  fixtures are strings that deliberately contain Cyrillic/homoglyph words.
  Everywhere else, including i18n catalog files, they stay on: Russian UI
  *copy* (the string values) is exempt by design (see the rules table below),
  but comments/identifiers/homoglyphs in those same files are not.

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



### Two presets

```js
...stapel.configs.recommended  // the guardrails at error, the doctrine tier at WARN
...stapel.configs.strict       // the same, doctrine tier at ERROR (+ Popconfirm)
```

A design ruling arrives before the code that satisfies it: on the day the
doctrine tier shipped, nineteen pairs were in violation of most of it. A rule
that turns a whole fleet red on arrival does not get adopted — it gets
blanket-disabled, and the disable outlives the migration. So `recommended`
ships those rules at **`warn`**, where `eslint .` stays green and
`pnpm turbo run lint` prints the migration worklist per package per rule;
`strict` is what a pair opts into once its migration has landed, after which a
regression fails its own lint.

`strict` is built by APPENDING to `recommended`, so the two can never disagree
about a carve-out (the failure mode that kept the 0.7.0 test-glob hole
invisible) — asserted structurally in `test/recommended-preset.test.js`.

**The switch** (the coordinator owns it): in `index.js`, flip `DOCTRINE_LEVEL`
from `"warn"` to `"error"` and delete `confirmComponents: []` from the
`no-bare-dialog` block. Both lines are marked `← WAVE-B SWITCH`.

### Why i18n parity is a lint rule and not a test helper

The obvious implementation is a vitest helper each pair imports. It is also the
one that has already failed: 8 of 19 pairs wrote an ad-hoc `test/i18n*.test.ts`
and 11 did not — and the 11 are exactly the pairs missing locale files (gdpr and
video have no `es.ts`; calendar, docs, recordings and shell have neither). A
gate that has to be adopted is a suggestion with a test runner attached.

ESLint is the only tier here with zero per-pair wiring: the root config spreads
`recommended` once, every package's `lint` is `eslint .`, and every pair has a
`src/i18n/keys.ts`. So the rule anchors on that file — the one guaranteed to
exist — and reads its siblings, which makes a MISSING locale file a finding
rather than a silence.

The cost, stated plainly: ESLint reports on the file it lints, so a key missing
from `ru.ts` is reported at its definition in `keys.ts` with the locale named in
the message, not at the line in `ru.ts` where it should go. That is the right
way round — the definition site is where someone adding a key already stands,
and it is the only site that exists when the locale file does not.


## Rules

| Rule | Catches |
|---|---|
| `stapel/no-raw-colors` | hex/rgb/hsl/named colours in style objects & CSS templates; Tailwind arbitrary colour values `bg-[#…]`; arbitrary values built by interpolation `bg-[${x}]` (JIT-invisible); bare raw-ramp refs `gray.500` |
| `stapel/valid-token-name` | `cssVar("…")` / `var(--stapel-…)` naming a colour-token role absent from the live `@stapel/tokens` catalog (§68) — a renamed/removed legacy role (`accent`, `background-*-subtle`, the old L3 component tier, …) or a plain typo. Suggests the nearest catalog role when one is close. Non-colour scale suffixes (`radius-*`, `space-*`, `font-*`, `breakpoint-*`, `elevation-*`) are a different vocabulary and never flagged. Extend the recognised call names via `options.functions` or `settings.stapel.cssVarFunctions` (default `["cssVar"]`) |
| `stapel/no-raw-token-import` | importing `@stapel/tokens/raw` outside theme-config / showcase |
| `stapel/no-raw-fetch` | `fetch` / `globalThis.fetch` / `new XMLHttpRequest()` / `axios` / `ky` outside the codegen client |
| `stapel/no-string-paths` | a hand-written API path — `client.get("/…")` on an http verb, or a bare literal/template that IS a catalogued operation path (`manifest.json §operations`) — outside the codegen api layer. Call the named operation instead. Off in `api/`, `*client.ts`, `generated/` |
| `stapel/query-keys-from-factory` | an inline `queryKey`/`mutationKey` array literal in `useQuery`/`useMutation`/`queryClient.*` — keys come only from the module's `<module>QueryKeys` factory (drift from invalidations otherwise). Off in the factory file (`**/queryKeys.*`) |
| `stapel/i18n-key-exists` | `t("…")` keys absent from the generated registry (only within a managed namespace — app-local keys are left alone). Also resolves the forms a real call site takes: every branch of a literal ternary; a plural family via `tPlural("…")` → `<key>.other` (`options.pluralFunctionNames`); and a template key `` t(`a.b.${x}`) `` by its static HEAD — no catalogued key under it is a renamed or deleted family. A key built from a variable cannot be resolved at all and is IGNORED by default, because reporting it would be a guess; `options.dynamicKeys: "report"` surfaces those under their own `dynamicKey` message instead. `options.requireRegistry: true` makes the rule fail when no catalogue is configured — without it a mis-wired project gets a silent no-op, which reads exactly like a passing gate |
| `stapel/no-hardcoded-text` | user-facing JSX text and `alt`/`title`/`placeholder`/`aria-*` string literals |
| `stapel/require-disable-description` | an `eslint-disable` without a `-- reason` (§2.4 escape-hatch policy) |
| `stapel/clickable-needs-event` | an interactive JSX element (`onClick`/`onSubmit`/…) with no analytics outcome — needs `tracked()`/`trackedSubmit()`, `data-analytics="flow"`, or `data-analytics="none"` + a reason (§3.2). Decorative `stopPropagation`/`preventDefault`-only handlers are exempt |
| `stapel/no-double-count` | `tracked()`/`trackedSubmit()` over a handler that also steps a flow machine (`run`/`step`/`submit*`, or `data-analytics="flow"` on the same element) — the funnel already auto-emits (hard ban, Q12a / §3.2) |
| `stapel/event-literal-meta` | `defineEvent()` with a non-literal argument (dynamic `name`/`description`, non-`prop.*` props) — breaks static extraction into `events.json` (§3.1) |
| `stapel/known-event` (warn) | `track()`/`tracked()` with an event name absent from the generated `events.json` — registry drift; run `pnpm gen:events` (§3) |
| `stapel/no-direct-analytics-provider` | importing an analytics vendor SDK (posthog-js, mixpanel, `@amplitude/*`, `@segment/*`, …) outside the core facade's provider adapters (`analytics/providers.*`) — bypasses consent/PII/queue (§3). Extend the vendor list via `options.providers` or `settings.stapel.providerModules` |
| `stapel/demo-literal-meta` | `defineDemo()` with non-literal meta (dynamic `id`/`title`/`description`/`covers`) — breaks static extraction into `demos.json`/`manifest.demos` (§4.2) |
| `stapel/no-raw-storage` | direct `localStorage`/`sessionStorage`/`indexedDB` (bare or via `window.`/`globalThis.`/`self.`) or importing `idb-keyval` outside `@stapel/core`'s repository layer — raw storage is neither wiped on logout nor encrypted; persist through `createRepository()` (frontend-core-architecture-v2 §43.4). Off in core's `storage.ts`/`repository.ts`/`query.ts` (the one legal home) and in tests. Extend the banned module list via `options.modules` or `settings.stapel.storageModules` |
| `stapel/no-adhoc-401` | comparing a status to the literal `401` (`===`/`!==`/`case 401:`) or wiring an axios-style `*.interceptors` chain — ad hoc 401 handling bypasses the single-flight refresh + logout-hook registry; 401s are handled ONCE, in core's `createStapelClient` (`onAuthRefresh` seam) + `SessionManager` (§43.2). Off in core's `client.ts`/`session.ts` and in tests |
| `stapel/no-raw-error-shape` | `as`-casting a caught value, casting anything to a hand-written error shape (`{ status?: number }`, `{ localizable_error?: string }`, …), or reading `.status`/`.code`/`.localizable_error` off an un-narrowed caught value. A thrown value comes in TWO dialects — `StapelApiError` (has `.status`) and the RAW envelope `{localizable_error, error, params}` the parsed response body IS (has none) — so `(e as { status?: number })?.status === 404` is a branch that can never be true on the second one, and the cast silences the only check that would have caught it. Narrow with `isStapelApiError` / `hasErrorCode` / a named `errorCodePredicate(…)` from `@stapel/core`, or fold once at the transport with `toStapelApiError(body, response.status)`. Off in the transport/error layer (`**/api/**`, `*client.*`, `errors.*`, `scripts/`, `bin/`) and in tests. Tune via `options.properties` / `options.errorClasses` |
| `stapel/no-flattened-load-state` | Defaulting a query's `data` to an EMPTY COLLECTION — `query.data ?? []`, `x.data?.rows ?? []`, `data || {}`. It collapses three different answers (still loading / loaded and genuinely empty / the request failed) into one value, after which every skin downstream can only ask `.length === 0`. On 2026-08-09 that line rendered a total 404 outage as "you have no workspaces", with a greyed-out upload button, for hours. Hand out `loadStateFromQuery(query)` from `@stapel/core` and render it with `matchList`, whose four arms are all required, so the empty branch is reachable only from a load that succeeded; for a genuinely non-discriminating consumer use `loadedRowsOrEmpty(state)`. `?? null` and `?? 0` are untouched — only manufactured empty collections lie. Off in the api/transport layer (`**/api/**`, `*client.*`, `generated/`, `scripts/`, `bin/`) and in tests. Tune via `options.dataProperties` |
| `stapel/no-reserved-backend-route` | an SPA route (`<Route path="…">`, a `createBrowserRouter`/`createHashRouter`/`createMemoryRouter` array literal, or any `{ path: "…", element/Component/children/index/errorElement/loader/action/lazy: … }` RouteObject) whose path falls INTO a reserved backend sub-path — `/<mod>/api/…`, `/<mod>/swagger…`, or the project-wide `/admin`, `/staticfiles`, `/media` (§57 nginx canon). A **bare module root** (`/calendar`) is legitimate and never flagged — roots belong to the frontend; only sub-paths collide. Data-driven: reads the flat `reservedPathPrefixes` array from `reserved-paths.json` (emitted by stapel-tools' project generator) at the workspace root, or `settings.stapel.reservedPathsFile`/`reservedPaths`. No catalog → no-op (never a crash) |
| `stapel/no-cyrillic-source` | Cyrillic in a comment, a JSDoc block, or an identifier (variable/function/class/type/property name) — fleet source is English-only (owner ruling 2026-08-09). Reports on the exact line the Cyrillic sits on (never collapsed onto a block comment's opening line), so `eslint-disable-next-line`/`eslint-disable` land where they can actually suppress it. Plain string literals are **deliberately never scanned** — that is the whole design: Russian UI copy in i18n catalogs, fixtures, and sample content stays untouched, so the rule needs no path allowlist |
| `stapel/no-mixed-script-word` | a single word inside a string or template literal that mixes Latin and Cyrillic letters — a homoglyph (`miттudei`, `Q12а`) that reads as one script and greps as neither. The literal-scanning counterpart to `no-cyrillic-source`: pure-Cyrillic text (real i18n copy) is untouched, only a word straddling both scripts fires. Scans the *parsed* string/template value (so a `\n` escape can't glue onto the following Cyrillic run) and skips regex literals outright (pattern syntax like `\b` or `[a-zА-Я]` is not prose); a 4-character floor keeps adjacent regex-range-boundary letters like `zА` silent |
| `stapel/antd-alert-title` | `message` on an `Alert` imported from **antd** — antd 6 deprecates the prop in favour of `title`. A prop a major version stops reading fails silently: the alert renders with no heading, on the one component whose whole job is to be read. **Autofixable** (`message` → `title`) and at `error` in `recommended`, because this is a vendor rename, not doctrine — there is nothing to sequence. A local or design-system `Alert` (no antd import) is never touched, and an element that already passes `title` is reported WITHOUT a fix (renaming would pass the same prop twice and let source order pick the heading) |

### Doctrine tier (0.11.0)

Ten rules that state, mechanically, the design rulings the fleet kept re-taking
by hand. They are **`warn` in `recommended` and `error` in `strict`** — see
"[Two presets](#two-presets)" below for why, and for the one-line switch that
flips them.

| Rule | Catches |
|---|---|
| `stapel/no-bare-dialog` | `Modal`/`Drawer`/`Popconfirm` imported from antd, in **every** file (`scope: "default-skin"` narrows it to `src/default/**`, the pre-0.12.0 behaviour). A phone gets a bottom sheet, not a centred modal, and not an anchored popover that renders half off-screen or on top of the row it is confirming. One implementation: `SkinDialog` / `SkinConfirm` from `@stapel/tokens-antd/skin`. A `Drawer` that is NAVIGATION is exempted by filename via `allowNavigationDrawer`; the confirm half is switched off with `confirmComponents: []` during a migration wave. `recommended` arms it fleet-wide at **warn** and keeps `src/default/**` at **error** — the skins are a wall, everything else is a worklist; `strict` makes the whole surface an error, which is what a product repo arms. Test/fixture paths are exempt in the rule itself, and `@stapel/tokens-antd/skin` — the substrate that BUILDS `SkinDialog` — is carved out by path in both presets |
| `stapel/no-tooltip-in-skin` | antd `Tooltip`/`Popover`, and a hover-only `title="…"` on a Button/Tag/anchor/…, inside `src/default/**`. Touch has no hover, and a **disabled** antd Button never fires the pointer events a tooltip listens for — so the one case where the text mattered most is the one case it is guaranteed never to render. Put the sentence beside the control (`GatedControl`); name an icon with `aria-label`. `title` where it is CONTENT (Card, SkinDialog, Collapse.Panel, Table columns, …) is never flagged; `titleComponents` tunes the list |
| `stapel/icon-button-needs-label` | a `Button`/`button`/`a` whose only content is an icon — `icon={…}` with no children, or children that are all icon-named elements (`*Outlined`, `*Icon`, `<svg>`) — and which carries no `aria-label`/`aria-labelledby`. The other half of the tooltip ruling: removing the hover text without adding a name leaves the control with no name at all. A spread (`{...props}`) or `aria-hidden` skips the element — "might carry the label" is not a finding. Not scoped to `src/default` |
| `stapel/no-hardcoded-theme-mode` | `const { mode = "light" } = props`, `props.mode ?? "dark"`, `toAntdThemeConfig("light")`, **and `resolveThemeMode()`** inside `src/default/**`. Three such lines meant the auth skin rendered light inputs and an invisible heading under `<html data-theme="dark">` (CF-1, reproduced with the attribute set before first render). The document owns the mode: `useThemeMode()` / `<SkinTheme>` from `@stapel/tokens-antd/skin`. The last of the four is the second half of the same defect and reported separately (`staleModeRead`): `resolveThemeMode()` SAMPLES the document once per render, so a host that flips `data-theme` at runtime (shell-react ships that control) leaves already-mounted skins on the old side — which is why the showcase's dark toggle is a paper feature. `useThemeMode()` is the same answer through `useSyncExternalStore` over a `MutationObserver`, i.e. a subscription. Tune with `staleModeFunctions` |
| `stapel/no-local-skin-theme` | a `src/default/theme.tsx` that builds its own antd `ConfigProvider`. Nine pairs ship a copy identical modulo names, so the CF-1 fix has to land nine times and will land in eight. One report per file. A **scoped** ConfigProvider inside a panel is not flagged — that would fire on the very thing `SkinTheme` is |
| `stapel/no-raw-dimensions` | a numeric literal for `padding`/`margin`/`gap`/`width`/`height`/`fontSize`/`borderRadius`… in a style object, or a px-valued JSX prop (`size`, `width`, `height`, `gap`), inside `src/default/**`. **Autofixable** when the number is an EXACT scale step — `padding: 16` → `spacing[4]`, `borderRadius: 8` → `radii.md`, `fontSize: 12` → `fontSize.xs.fontSize` — and the fix writes the import too (an autofix that leaves an undefined identifier turns a warning into a build error) — `from "@stapel/tokens-antd"` inside `src/default/**`, which re-exports the whole scale so a pair's only design-system dependency stays the antd bridge it already declares, and `from "@stapel/tokens"` everywhere else. A binding the file already imports from either module is never imported twice. A number on no step is reported WITHOUT a fix: 15 is not "nearly 16", it was picked by eye. `0` is a reset and never flagged; `lineHeight` is excluded (a bare number there is a unitless multiplier, not px); a non-style object (`{ width: 96 }` on a media descriptor, `<Col span={12}>`) is out of scope. Scale numbers come from `@stapel/tokens/theme.default.json`, so the rule cannot drift from the values it rewrites to |
| `stapel/i18n-locale-parity` | a key in a pair's English bundle with no translation in `ru.ts`/`es.ts`; a **missing locale file**; a key a locale defines that `en` does not (a rename left behind); and a locale value byte-identical to a long English one (an untranslated copy that every key-set-only parity check calls green). Anchored on `src/i18n/keys.ts` and reads the siblings as text — see [why this is a lint rule](#why-i18n-parity-is-a-lint-rule-and-not-a-test-helper). Spreads (the generated backend error bundles) are ignored on both sides. Tune `locales`, `untranslatedFloor`, `reportExtra` |
| `stapel/no-adhoc-socket` | `new WebSocket(…)` / `new EventSource(…)` outside the `@stapel/realtime` package (resolved by package NAME from the nearest package.json) and outside test files. A socket is four lines and a year of policy: backoff with jitter, a terminating retry budget, terminal vs retryable close codes, a `hello{last_seq}` resume cursor, seq dedup, a `ping`→`pong` answer, and a 4401 routed once through `SessionManager`'s single-flight refresh. The TS twin of core's RT001-RT003. A pair mid-cutover goes in `allowPackages` with its ticket named |
| `stapel/no-silent-slot` | `{props.searchSlot}` / `{props.renderX?.(…)}` in a JSX **child** position inside `src/default/**` with no `??` fallback. An unfilled slot renders a hole, and a hole looks like a finished page — the one defect nobody reports. Write the decision: `?? <SlotPlaceholder name="…"/>`, or `?? null` to say empty is correct. An attribute-position slot is the consumer's business and is not covered |
| `stapel/no-boolean-disabled` (heuristic) | `disabled={<expr>}` on a Button inside `src/default/**` where the expression carries no reason. A grey button with no reason cannot be told apart from a missing permission, a hit limit, or a still-loading page. Disable through `ActionAvailability` and render the reason beside the control with `GatedControl`. **Name-based, and honest about it**: expressions mentioning a gate (`gate`, `available`, `blocked`, `canX`) are accepted, as are transient states (`busy`, `submitting`, `loading`) and a forwarded `props.disabled`; `data-disabled-reason="…"` is the declared escape hatch. `disabled={left > 0}` and `disabled={!name.trim()}` are the false positives it produces on purpose — answer them with the escape hatch or the gate. See the rule header for the full limits |


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
    scales: {...},              // or themeFile — dimension scales for no-raw-dimensions
    cssVarFunctions: ["cssVar"], // extra token-accessor calls valid-token-name inspects
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
