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
