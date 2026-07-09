# @stapel/auth-react

The **headless** React flow pair for [stapel-auth](../../../docs/auth-sa.md)
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
  baseUrl: "/auth/api",
  // cookieMode: true,          // httponly JWT cookies instead of bearer
  onTeardown: (reason) => {     // auth-sa.md §19.3
    void query.purgePersistedCache();
    location.assign(reason === "revoked" ? "/sign-in?session_revoked=1" : "/sign-in");
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

Error codes on every flow error state are backend `localizable_error` keys —
resolve them with core's `useT()`. auth-react ships an English fallback bundle
(`registerAuthI18n`) covering both its UI keys and the auth-sa.md error codes.

### Russian locale (opt-in subpath)

The `ru` bundle ships as a separate subpath so it never bloats the main entry
(size-limit gated — the locale stays out of hosts that don't register it):

```tsx
import { registerAuthI18nRu } from "@stapel/auth-react/i18n/ru";

registerAuthI18n(i18n);      // en floor + polish
registerAuthI18nRu(i18n);    // ru locale (generated from the backend catalog)
await i18n.setLocale("ru");  // live switch; a missing key degrades to English
```

Backend error texts are generated from stapel-auth's
`translations/errors.ru.json` catalog (`pnpm gen:errors`, drift-gated); the
pair's UI keys carry hand-written ru copy. Register your own bundle AFTER the
pair's to override any key — registration order is override priority.

## Shadcn mode (frontend-standard §7)

Every headless component is app-layer by definition — copy it into your repo
and own it while keeping `api/`/`model/`/`flows/` as a dependency. Visual
divergence never forks the package.

See **[MODULE.md](./MODULE.md)** for the full flow/hook catalogue, extension
points, and which journeys are full vs thin-WebAuthn.
