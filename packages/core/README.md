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
- **Analytics seam** — the `Analytics` type + context plumbing; the facade
  implementation lives in `@stapel/analytics` (see below).

## Analytics seam

Per [analytics-standard](../../../docs/done/analytics-standard-v1.md) §1–2 and
frontend-standard §4.7: packages and hosts talk to the facade only, never to
providers directly. Core owns the **type seam + context plumbing** — the
`Analytics` / `AnalyticsProvider` / `EventDef` types, `AnalyticsContext` +
`useAnalytics`, and the flow-machine auto-instrumentation hook
(`trackFlowStep`). The facade **implementation** (consent gate, PII guard,
offline queue, provider fan-out, `defineEvent`/`tracked`/`useTracked`) lives
in [`@stapel/analytics`](../analytics) (slim-wave §21/S1).

Mandatory analytics is a stapel-studio policy: scaffolded apps always wire
`@stapel/analytics`. OSS consumers may implement the core `Analytics` type
with any provider instead — the pairs only ever see the seam.

```tsx
import { createAnalytics } from "@stapel/analytics"; // or your own impl of the core type

const analytics = createAnalytics({ /* providers, registry, piiGuard */ });

<StapelConfigProvider config={{ client }} analytics={analytics}>…</StapelConfigProvider>;
// below it: useAnalytics(), and every pair's flow machines emit
// flow.<id>.<step> {phase} via trackFlowStep — funnels for free.
```

## Quick start

One `<StapelProvider>` composes the three core providers
(`StapelConfigProvider` + TanStack's `QueryClientProvider` + `I18nProvider`)
— slim wave §21/S4. The individual providers stay exported; this is
composition, not deprecation.

```tsx
import { createStapelClient, StapelProvider } from "@stapel/core";

const client = createStapelClient({
  baseUrl: "https://api.example.com",
  getToken: () => auth.accessToken,
  onAuthRefresh: () => auth.refresh(),
  onVerificationChallenge: (challenge) => verificationUi.run(challenge),
});

<StapelProvider client={client} cacheVersion="0.1.0" locale="en">
  {app}
</StapelProvider>;
```

Props: `baseUrl` **or** `client` (+ optional per-module `clients` overrides),
`locale`, `cacheVersion`, `analytics`, and the escape hatches `queryClient`
(BYO TanStack client, still wrapped with Stapel persistence), `queryRuntime`
(full `createStapelQueryClient` runtime — when the host needs
`setPersistUser`/`purgePersistedCache` outside the tree) and `i18n` (BYO
engine — when you register pair bundles / locale loaders at module scope):

```tsx
const query = createStapelQueryClient({ cacheVersion: "0.1.0" });
const i18n = createI18n({
  locale: "en",
  loadLocale: (locale) => translateClient.resolve(locale), // stapel-translate
});

<StapelProvider client={client} queryRuntime={query} i18n={i18n}>
  {app}
</StapelProvider>;

// on login:  await query.setPersistUser(user.id);
// on logout: await query.purgePersistedCache();
```

## Session substrate & user-data hygiene (frontend-core-architecture-v2 §43)

Authentication state and user data on the client are the two places where a
bug is both critical and invisible — so they live at the FRAMEWORK level, not
per-library.

### `createSessionManager` (§43.1)

The one owner of session lifecycle. Status is three-state —
`authenticated | anonymous | unauthenticated` — and refresh is
**single-flight**: N requests that concurrently hit a 401 share ONE
`doRefresh()` call and all resolve together. Typed events:
`session:refreshed` / `session:lost` / `session:logout`.

```ts
const sessionManager = createSessionManager({
  doRefresh: async () => {/* module-owned: call the refresh endpoint */},
  onSessionLost: (reason) => {
    // HOST policy, resolved from your discovery config — not hardcoded here:
    // redirect to the login form, OR anonymous auto-login when the guest
    // axis is enabled.
  },
});
```

The module that authenticates (`@stapel/auth-react`) owns its tokens and the
refresh mechanics; the SessionManager owns everything generic around them.
`@stapel/auth-react` wires all of this for you (`createAuthRuntime` →
`session.getSessionManager()`).

### 401 handling lives in the client, not in services (§43.2)

`createStapelClient`'s 401 path: `onAuthRefresh` (wire it to
`SessionManager.refresh()`) → retry the request exactly once → still 401 →
the session is lost. No library writes its own 401 branch — enforced by
`stapel/no-adhoc-401` (`@stapel/eslint-plugin`).

### Logout-hook registry (§43.3)

`sessionManager.registerLogoutHook(fn)` — run on BOTH explicit `logout()` and
involuntary session loss. Hard rule: put something in a store, you must
register how it comes out. `createRepository(…, { scope: "user" })` and
`createModuleRuntime` register theirs automatically.

### `createRepository` — the one sanctioned client-side store (§43.4)

```ts
const drafts = createRepository("drafts", {
  storage: "indexeddb",   // or "local"; graceful fallback ladder
  scope: "user",          // wiped on logout/loss — NO opt-out; encrypted by default
});
const theme = createRepository("theme", { storage: "local", scope: "app" }); // survives logout
```

Direct `localStorage` / `indexedDB` access is a lint error
(`stapel/no-raw-storage`) — that is what makes wipe-at-logout mechanical: the
teardown happens at the repository layer; a library can forget, the framework
cannot. Contract-tested: after `logout()`, user-scoped data is physically
absent from both stores and the encryption key is dropped.

### Encryption at rest — honest boundaries (§43.5)

User-scoped repositories are encrypted by default: WebCrypto AES-GCM with a
per-session key held in memory only (never persisted). Logout = drop the key,
so even if the wipe didn't finish (tab crash), the leftovers are unreadable.

**The honest boundary (state it, do not oversell it):** frontend encryption
does NOT protect against XSS with code execution — a script running in your
origin can call `repo.get()` like any other code. This is protection against
a shared computer, residual data on disk, and casual access — not more.

Verbatim from the governing doc (frontend-core-architecture-v2 §43.5):

> от XSS с исполняемым кодом фронт-шифрование НЕ защищает (это защита от
> общего компьютера, остаточных данных и казуального доступа) — не продавать
> как большее.

## Notes

- Peer deps: `react >= 19`, `@tanstack/react-query ^5`. Only runtime dep:
  `idb-keyval` (+ `@stapel/tokens`).
- Standalone-buildable; the npm tarball ships `src/` (frontend-standard §7).
- TODO(frontend-standard §4.5): precompile with React Compiler at publish so
  consumers outside the Stapel toolchain get baked-in memoization. The package
  is currently hooks-only (no JSX-heavy render paths), so the compiler yields
  nothing yet; wire it into the publish pipeline together with the first
  headless components.
