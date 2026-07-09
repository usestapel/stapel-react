# @stapel/analytics

The Stapel analytics facade **implementation** (analytics-standard §1–2):
consent gate, PII guard, offline queue with batched fan-out, provider adapters
(console + the Stapel collector), and the typed event layer
(`defineEvent` / `tracked` / `useTracked`).

## Why a separate package (and why the seam stays in core)

Mandatory analytics is a **stapel-studio policy, not a framework requirement**:
apps scaffolded by stapel-studio always wire `@stapel/analytics`, so funnels,
consent, and PII guarding exist from the first commit. OSS consumers of the
`@stapel/<module>-react` pairs are free to bring their own provider instead —
the pairs only depend on the `Analytics` **type seam** in `@stapel/core`
(threaded through context; the `stapel/no-direct-analytics-provider` eslint
rule keeps vendor SDKs out of app code either way).

Dependency direction is one-way: `@stapel/analytics` → `@stapel/core`. Core
keeps the types (`Analytics`, `AnalyticsProvider`, `EventDef`, …), the context
plumbing (`AnalyticsContext`, `useAnalytics`), and the flow-machine
auto-instrumentation hook (`trackFlowStep`); this package implements them.

Versioning: frontend-infra scheme (independent of the pair⇄backend minor
tracking) — starts at 0.1.0.

## Install

```
pnpm add @stapel/analytics @stapel/core react
```

## Use

```ts
import {
  createAnalytics,
  consoleProvider,
  stapelCollectorProvider,
} from "@stapel/analytics";

const analytics = createAnalytics({
  providers: {
    stapel: stapelCollectorProvider({ client, writeKey: "wk_…" }),
    console: consoleProvider(), // dev
  },
  registry: eventsJson.map((e) => e.name), // dev warning; hard gate = eslint
  piiGuard: "strip", // email/phone-like prop values → "[redacted]"
});

analytics.track("cart.checkout", { total: 42 });
analytics.identify(user.id, { plan: "pro" }); // id is SHA-256-hashed first
analytics.page("pricing");
await analytics.setConsent("granted"); // "pending" buffers, "denied" drops
```

Hand the instance to core's provider — `<StapelProvider analytics={analytics}>`
(or `<StapelConfigProvider analytics={analytics}>`) — and every pair's flow
machines auto-instrument their funnels (`flow.<id>.<step>` with `{phase}`).

### Typed events (frontend-guardrails §3)

```tsx
import { defineEvent, prop, useTracked } from "@stapel/analytics";

const planSelected = defineEvent({
  name: "pricing.plan.selected",
  description: "User picked a plan",
  props: { plan: prop.oneOf(["free", "pro", "team"], "Plan code") },
});

const { tracked } = useTracked();
<Button onClick={tracked(planSelected, { plan }, startCheckout)} />;
```

`defineEvent` declarations are statically projected into each package's
`events.json` (`pnpm gen:events`, drift-gated) — the registry, the report, and
the lint read the meta without running the app.

## Bring your own provider

Implement `AnalyticsProvider` (from `@stapel/core` or re-exported here) and
register it — provider SDK imports belong ONLY in a provider-adapter module
(`analytics/providers.*`), which is the single carve-out the
`no-direct-analytics-provider` rule allows.

MIT © Stapel contributors
