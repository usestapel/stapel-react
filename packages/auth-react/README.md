# @stapel/auth-react

The **headless** React flow pair for [stapel-auth](../../../docs/reference/auth-sa.md)
(frontend-standard §2). Business + state only — **zero visual opinion**. Every
flow is a typed state machine; every headless component is a render prop. You
bring the markup and design; auth-react brings the auth journeys, the token
seam, and the flagship step-up verification flow.

Built entirely on [`@stapel/core`](../core): typed client + error envelope,
verification-403 interception, token refresh seam, TanStack Query layer, i18n
engine, and the analytics facade.

## Install

```
pnpm add @stapel/auth-react @stapel/core @tanstack/react-query react
```

The headless surface above (flows, `AuthProvider`, `createAuthRuntime`, the
render-prop components) has **zero UI dependency** — it works under any
renderer (MUI, Chakra, plain HTML/CSS) on React `>=19`. `antd` and
`@stapel/tokens-antd` are declared as **optional** peer dependencies
(`peerDependenciesMeta`); npm/pnpm/yarn won't require or warn about them
unless you actually import the default skin below.

### Optional: the default AntD skin

```
pnpm add antd @stapel/tokens-antd
```

```tsx
import { AuthPanel } from "@stapel/auth-react/default";
```

`@stapel/auth-react/default` is a separate subpath entry (§54 pilot skin) —
importing it is the opt-in that pulls `antd` + `@stapel/tokens-antd` into your
bundle. The main `@stapel/auth-react` entry never imports from `./default`,
so consumers who bring their own visuals (or another design system) never pay
for AntD.

## Wire the app once

`createAuthRuntime` is the single place the flagship seams are connected: it
builds a `StapelClient` whose token refresh comes from the session and whose
`onVerificationChallenge` is the verification controller. Hand that client to
ONE `<StapelProvider>` (core's config + query + i18n composed — slim wave
§21/S4) and nest `<AuthProvider>` inside it.

```tsx
import { createStapelQueryClient, createI18n, StapelProvider } from "@stapel/core";
import {
  createAuthRuntime,
  AuthProvider,
  VerificationChallenge,
  registerAuthI18n,
} from "@stapel/auth-react";

const query = createStapelQueryClient({ cacheVersion: "0.1.0" });
const runtime = createAuthRuntime({
  baseUrl: "/auth/api/v1",
  // cookieMode: true,          // httponly JWT cookies instead of bearer
  onTeardown: (reason) => {     // auth-sa.md §19.3
    void query.purgePersistedCache();
  },
  // Session-lost policy (frontend-core-architecture-v2 §43.1): the HOST
  // decides — login redirect or anonymous auto-login — and resolves the
  // choice from ITS discovery config (e.g. `capabilities()`), never
  // hardcoded in the framework.
  onSessionLost: (reason) => {
    location.assign(reason === "revoked" ? "/sign-in?session_revoked=1" : "/sign-in");
    // …or, when the guest axis is on: void api.anonymous(deviceId);
  },
});

const i18n = createI18n({ locale: "en" });
registerAuthI18n(i18n); // auth-react's key bundle → core's engine

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} queryRuntime={query} i18n={i18n} analytics={analytics}>
      <AuthProvider runtime={runtime}>
        {children}
        {/* Mount ONCE — renders your step-up modal on demand */}
        <VerificationChallenge>
          {({ state, chooseFactor, submitCode, cancel }) => (
            <YourModal open={state.step !== "idle"} onClose={cancel}>
              {/* render state.challenge.factors → chooseFactor(f) → submitCode({code}) */}
            </YourModal>
          )}
        </VerificationChallenge>
      </AuthProvider>
    </StapelProvider>
  );
}
```

### The session substrate underneath (frontend-core-architecture-v2 §43)

`createAuthRuntime` builds on `@stapel/core`'s `createSessionManager`: auth
owns the **tokens** and the refresh HTTP call; the core `SessionManager` owns
the **lifecycle** — three-state status (`authenticated | anonymous |
unauthenticated`, guest sessions map from `user.is_anonymous`), single-flight
refresh (N concurrent 401s → ONE refresh call), the
`session:refreshed`/`session:lost`/`session:logout` events, the logout-hook
registry, and the per-session encryption key `createRepository` uses. Reach
it via `runtime.session.getSessionManager()` — e.g. for another module to
`registerLogoutHook(fn)` without depending on auth-react. `logout()` runs
EVERY registered hook (auth-react's own state/storage cleanup is registered
the same way); the refresh call itself rides a dedicated client without the
`onAuthRefresh` seam, so a failing refresh can never re-enter itself.

### The bootstrap probe & `bootstrapProbe` (bearer-mode hosts)

Redirect-based logins — a `session_share` QR scan, a magic-link click, an SSO
or OAuth callback — mint fresh httponly JWT cookies via a plain HTTP
redirect, entirely outside this runtime. On a cold load with nothing
persisted locally, the ONLY way to discover that session is to actually
attempt the refresh call and see whether the browser's cookie jar carries a
live refresh cookie — that attempt is the **bootstrap probe**.

In `cookieMode: true` (the default) this always happens — there is no other
way to bootstrap a cookie-mode session at all. In `cookieMode: false`
(bearer/header mode — native/mobile apps, or a web host that opted out of
cookies), it used to never happen: no local bearer token meant an immediate,
silent "anonymous", even when a QR scan had just minted a perfectly valid
cookie session moments earlier. `bootstrapProbe` controls this for bearer
mode:

```tsx
const runtime = createAuthRuntime({
  baseUrl: "/auth/api/v1",
  cookieMode: false,
  bootstrapProbe: "auto", // default — see below
});
```

- **`"auto"`** (default): probes when `cookieMode` is `true`, OR — in bearer
  mode — when the non-httponly `stapel_auth_hint` cookie is present (a plain
  `document.cookie` check; `stapel-auth` sets this cookie alongside every
  httponly refresh cookie it mints, specifically so a bearer host can tell
  "a cookie session might exist" apart from "there was never one" without
  paying a network round trip on every cold load).
- **`"always"`**: probes bearer mode unconditionally, hint cookie or not —
  for backends that don't set it.
- **`"off"`**: never probes bearer mode (the historical behavior). Logs a
  one-time `console.warn` so this coverage gap can't silently recur — set
  this only if you're certain your host never touches a redirect-based
  login flow.

A successful probe adopts the discovered session through the same path a
normal token refresh uses — `isAuthenticated` flips true, tokens are in
memory (bearer mode still never persists them to storage; this is
discovery-and-adopt, not a new persistence path). A failed probe (no cookie,
expired, or a network error) settles quietly to anonymous — never a thrown
exception, never a false "session expired" banner on a visitor who was never
signed in.

The `queryRuntime` / `i18n` props are escape hatches: this host needs
`query.purgePersistedCache()` in `onTeardown` and registers the pair's i18n
bundle at module scope, so it creates both and hands them in. A host that
needs neither passes just `client` (+ optional `cacheVersion` / `locale`).
The individual providers (`StapelConfigProvider`, TanStack's
`QueryClientProvider`, `I18nProvider`) remain exported for bespoke
composition — `<StapelProvider>` is composition, not deprecation.

## Use a headless component

```tsx
import { PasswordlessLogin } from "@stapel/auth-react";
import { useT } from "@stapel/core";

function SignIn() {
  const t = useT();
  return (
    <PasswordlessLogin>
      {({ state, requestCode, submitCode, resend }) => {
        if (state.step === "codeSent" || state.step === "codeError")
          return (
            <CodeForm
              hint={t("auth.otp.sent_to", { target: state.target })}
              error={state.step === "codeError" ? t(state.error.code, state.error.params) : null}
              onSubmit={submitCode}
              onResend={() => resend()}
            />
          );
        if (state.step === "authenticated") return <Redirect to="/app" />;
        return <EmailForm onSubmit={(email) => requestCode("email", email)} />;
      }}
    </PasswordlessLogin>
  );
}
```

## Rendering a flow error

Every flow error state carries a `FlowError` (`{ code, params, status,
message, language }`) — `code` is a backend `localizable_error` key,
`params` feed `{param}` interpolation. **Don't** hand-roll
`bundle[code] ?? code`: use core's `useFormatFlowError()`, which chains
1) your i18n bundle's translation for `code` (interpolated), 2) the
backend's own `message` text (ONLY when its `language` matches the host's
current locale — never an off-locale string), 3) the raw `code` as the
last resort:

```tsx
import { useFormatFlowError } from "@stapel/core";

function OtpError({ error }: { error: FlowError }) {
  const formatError = useFormatFlowError();
  return <Alert type="error" message={formatError(error)} />;
}
```

The default skin (`@stapel/auth-react/default`) already renders every
inline error this way — nothing to wire yourself if you use `<AuthPanel/>`.

auth-react ships an English fallback bundle (`registerAuthI18n`) covering
both its UI keys and the auth-sa.md error codes, so `formatError`'s bundle
step always has an en floor to fall back on.

### Russian locale — one line to register (opt-in subpath)

auth-react ships a COMPLETE `ru` bundle (`authI18nBundleRu`/
`registerAuthI18nRu`) — every UI key hand-translated, every backend error
code generated from stapel-auth's own `translations/errors.ru.json` catalog
(`pnpm gen:errors`, drift-gated). It's a separate subpath so it never bloats
the main entry (size-limit gated — the locale stays out of hosts that don't
register it), but registering it is exactly ONE extra line:

```tsx
import { registerAuthI18nRu } from "@stapel/auth-react/i18n/ru";

registerAuthI18n(i18n);      // en floor + polish (always register this first)
registerAuthI18nRu(i18n);    // ← the one line: full ru locale, backend + UI copy
await i18n.setLocale("ru");  // live switch; a missing key degrades to English, never a raw key
```

Register your own bundle AFTER the pair's to override any key — registration
order is override priority (last registered wins per key).

## Shadcn mode (frontend-standard §7)

Every headless component is app-layer by definition — copy it into your repo
and own it while keeping `api/`/`model/`/`flows/` as a dependency. Visual
divergence never forks the package.

See **[MODULE.md](./MODULE.md)** for the full flow/hook catalogue, extension
points, and which journeys are full vs thin-WebAuthn.
