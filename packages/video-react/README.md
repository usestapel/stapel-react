# @stapel/video-react

Headless React pair for **stapel-video**'s scope usage read (frontend-standard
§2): who, inside one partition, talked how much, per calendar month. Business +
state only in the main entry, zero visual opinion — an opt-in `/default` subpath
ships the antd skin. Built on `@stapel/core` (typed client + `StapelApiError`
envelope, token refresh, verification-403 interception, i18n engine, analytics
seam, TanStack Query).

See `MODULE.md` for the layer map, extension seams, and persist policy.

## The two facts that shape everything here

**The wire carries user IDs and never names.** `ParticipantSpan` keeps no FK to
a user by design, so erasure can pseudonymize the column. The display name is
the host's: pass `nameFor` and the table resolves it from the roster your admin
page already loaded. Absent, the id is printed — for a report about
individuals, a blank cell is worse than an ugly one.

**`error.404.video_scope_not_found` is uniform over three situations** — the
scope does not exist, it holds no calls, and the caller holds no
`USAGE_MANDATE` in it. A 403 would confirm to someone guessing tenant ids that
the one they guessed is real. So the pair renders it as an explained refusal
("call usage is not available for this workspace"), never as an empty table,
and never guesses which of the three it was.

## Use it

```tsx
import { useScopeUsage } from "@stapel/video-react";
import { ScopeUsagePane, ScopeUsageTable } from "@stapel/video-react/default";

// The whole screen, wired — what the nav manifest's `admin.usage` mounts.
<ScopeUsagePane scopeKey={workspaceId} tz="Europe/Berlin" nameFor={nameOf} />;

// Or drive it yourself.
const usage = useScopeUsage(workspaceId, { months: 12, month, tz });
<ScopeUsageTable
  rows={usage.rows}
  months={usage.monthLabels}
  month={usage.month}
  onMonthChange={setMonth}
  onRefresh={usage.refetch}
  nameFor={nameOf}
/>;
```

`useScopeUsage` runs TWO queries on purpose: the window read (`?months=N`)
feeds the month selector and stays cached while a person clicks through months,
and the month read (`?month=YYYY-MM`) feeds the rows. Month boundaries are cut
at LOCAL midnight in the requested zone — a DST month is genuinely 743 or 745
hours — so `tz` is part of every query key and nothing here re-derives a
boundary: `period_start`/`period_end` come off the wire.

The other seven paths in stapel-video's contract (rooms, the lobby verdicts,
the join grant, the participant list, the provider webhook) are a media-server
client's, not a data pair's. `manifest.json` still lists the whole contract.

## Install

```
pnpm add @stapel/video-react @stapel/core @tanstack/react-query react
```

## Wire the app once

One `<StapelProvider>` for the whole app (core's config + query + i18n in a
single component — slim wave §21/S4), one `<VideoProvider>` for this pair:

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import {
  createVideoRuntime,
  VideoProvider,
  registerVideoI18n,
} from "@stapel/video-react";

const runtime = createVideoRuntime({ baseUrl: "/video/api/v1/" });
const i18n = createI18n({ locale: "en" });
registerVideoI18n(i18n); // the pair's key bundle → core's engine

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.0.0">
      <VideoProvider runtime={runtime}>{children}</VideoProvider>
    </StapelProvider>
  );
}
```

Hooks and headless components work anywhere below `<VideoProvider>`
(`useVideoApi`, the query/mutation hooks you add in `model/`, the
render-prop components — see `MODULE.md`). Already wired a `<StapelProvider>`
for another pair (or auth-react)? Keep the ONE provider: pass this runtime's
client as a per-module override — `clients={{ video: runtime.client }}` —
and nest `<VideoProvider>` next to your other pair providers. The
individual core providers (`StapelConfigProvider` + `QueryClientProvider` +
`I18nProvider`) remain exported for bespoke composition.

## Layers

```
src/
  api/        typed client — thin adapter over this pair's own generated
              `components`, plus the ScopeUsageRequest union
  model/      query keys, the usage read + its arithmetic, runtime, context
  flows/      toFlowError + zero-flow registry shim (machines + generated
              registry arrive with the backend's first @flow_step)
  headless/   renderless components (VideoProvider)
  default/    the antd skin (ScopeUsagePane, ScopeUsageTable) — opt-in subpath
  nav/        the scripted-fullstack nav entry (admin.usage)
  i18n/       translation keys, en inline + opt-in ru subpath, generated error map
  analytics/  generated typed-event registry (events.json)
demo/         first-class demos (compiled, product-linted, smoke-rendered)
```

## Generated surfaces (drift-gated)

| Surface | Path | Gate |
|---|---|---|
| Typed API schema | `src/api/generated/schema.ts`, from stapel-video's own `docs/schema.json` | `pnpm gen:api:check` |
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
stapel-video's own `docs/schema.json`; design tokens are tokens-owned
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
