# @stapel/core

The Stapel frontend runtime (L0, frontend-standard §1). Everything the
`@stapel/<module>-react` pairs build on:

- **`createStapelClient`** — typed fetch wrapper: base URL, auth token getter
  + refresh seam, parses the Stapel error envelope
  `{localizable_error, error, params}` into `StapelApiError`
  (`code` = the `localizable_error` i18n key, `params` for interpolation).
- **Verification-403 interception** — when a 403 body carries a
  `verification` object (`challenge_id`/`scope`/`factors`), the configured
  `onVerificationChallenge(challenge)` is invoked; on
  `{ retry: true, token }` the original request is retried once with
  `X-Verification-Token`. This is the seam `@stapel/auth-react`'s factor
  machines plug into (the flagship cross-module flow, standard §2).
- **`StapelConfigProvider`** — provides the default client plus per-module
  client overrides (client injection, the fork-resolution seam of §7.2).
- **Query layer** — `createStapelQueryClient()`: TanStack Query v5 client
  with a persistence runtime: IndexedDB via `idb-keyval`, `localStorage`
  fallback, in-memory last resort; **per-user namespace** via
  `setPersistUser(userId)`; `purgePersistedCache()` for logout/GDPR;
  cache-version buster (set it to your package version).
- **i18n engine** — key→string dictionaries, `{param}` interpolation,
  `I18nProvider` / `useT` / `useI18n`, static bundles + async locale loader
  seam (point it at `translate.resolve` of stapel-translate), missing keys
  fall back to the key itself.
- **`useBreakpoint()`** — resolves the three `@stapel/tokens` breakpoints;
  SSR-safe (`undefined` until mounted).
- **Analytics facade** — see the dedicated section below
  (analytics-standard §2).

## Analytics facade

Per [analytics-standard](../../../docs/analytics-standard.md) §1–2 and
frontend-standard §4.7: packages and hosts talk to the facade only, never to
providers directly.

```ts
import {
  createAnalytics,
  consoleProvider,
  stapelCollectorProvider,
  trackFlowStep,
} from "@stapel/core";

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
trackFlowStep(analytics, "onboarding", "otp", "completed"); // flow.<id>.<step>
```

Semantics: consent gate (buffer while `pending`, flush on `granted`, drop +
no-op on `denied`; consent persists), offline queue on the shared persist
storage (IndexedDB → localStorage → memory; survives instance recreation),
batched fan-out to all registered providers with per-provider delivery
tracking, exponential-backoff retries (drop with a warning after
`maxAttempts`), flush on interval / `maxSize` / explicit `flush()` /
`pagehide` + `visibilitychange: hidden` (the Stapel collector uses
`navigator.sendBeacon` for that final batch). `register`/`unregister` change
the fan-out at runtime — extra providers (Mixpanel, GA4, PostHog…) are tiny
`@stapel/analytics-<provider>` packages or app-layer classes. Wire React via
`<StapelConfigProvider analytics={analytics}>` and `useAnalytics()`.

## Quick start

```tsx
import {
  createStapelClient,
  createStapelQueryClient,
  createI18n,
  StapelConfigProvider,
  I18nProvider,
} from "@stapel/core";
import { QueryClientProvider } from "@tanstack/react-query";

const client = createStapelClient({
  baseUrl: "https://api.example.com",
  getToken: () => auth.accessToken,
  onAuthRefresh: () => auth.refresh(),
  onVerificationChallenge: (challenge) => verificationUi.run(challenge),
});

const query = createStapelQueryClient({ cacheVersion: "0.1.0" });
const i18n = createI18n({
  locale: "en",
  loadLocale: (locale) => translateClient.resolve(locale), // stapel-translate
});

<StapelConfigProvider config={{ client }}>
  <QueryClientProvider client={query.queryClient}>
    <I18nProvider i18n={i18n}>{app}</I18nProvider>
  </QueryClientProvider>
</StapelConfigProvider>;

// on login:  await query.setPersistUser(user.id);
// on logout: await query.purgePersistedCache();
```

## Notes

- Peer deps: `react >= 19`, `@tanstack/react-query ^5`. Only runtime dep:
  `idb-keyval` (+ `@stapel/tokens`).
- Standalone-buildable; the npm tarball ships `src/` (frontend-standard §7).
- TODO(frontend-standard §4.5): precompile with React Compiler at publish so
  consumers outside the Stapel toolchain get baked-in memoization. The package
  is currently hooks-only (no JSX-heavy render paths), so the compiler yields
  nothing yet; wire it into the publish pipeline together with the first
  headless components.
