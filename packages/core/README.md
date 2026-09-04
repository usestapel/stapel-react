# @stapel/core

[![llms.txt](https://img.shields.io/badge/llms.txt-blue)](https://github.com/usestapel/stapel-react/blob/main/packages/core/llms.txt)

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
- **`useBreakpoint()`** — resolves the three `@stapel/tokens` breakpoints,
  synchronously on the first client render (`useSyncExternalStore`); `undefined`
  only on the server.
- **UI floor** — `STAPEL_UI_KEYS` (`stapel.ui.*`: retry, dismiss, confirm,
  cancel, loading, empty-state title, unfilled slot) seeded in en/ru/es like the
  error floor, so the shared skin substrate (`@stapel/tokens-antd/skin`) is
  translated with zero host wiring; override any key by registering it later.
- **`useRecents(scope, { max })`** — the codes a person picked last, most
  recent first, deduped, capped, surviving a reload. Headless: the same product
  rule serves an attributes reference editor, a vocabulary term control and a
  search facet, so it cannot live in any one of them or in the antd bridge.
  Persisted through the `PersistStorage` ladder above; reads nothing during
  render (SSR-safe) and never throws when storage is unavailable.
- **`SlotPlaceholder`** — an unfilled render slot is a visible, named box in
  development and nothing in production (see below).
- **Analytics seam** — the `Analytics` type + context plumbing; the facade
  implementation lives in `@stapel/analytics` (see below).
- **Host seams** (`LinkComponent`, `SignInCta`) — the two things a skin needs
  from its container and a library must not choose for it (see below).
- **Elevation seam** (`ElevationSource`, `ElevationProvider`, `useElevation`)
  — the third answer a gated control can give an anonymous visitor: mint an
  identity for THIS action instead of refusing (see below).

## Slots: an unfilled slot is never silent

A pair's screen takes render slots from its container (`renderCategoryPicker`,
a header extra). When the host forgets one, `null` is the defect: the screen
mounts without the control and nobody learns until a person cannot submit.
Render the placeholder instead:

```tsx
import { SlotPlaceholder } from "@stapel/core";

{props.renderCategoryPicker !== undefined
  ? props.renderCategoryPicker(slot)
  : <SlotPlaceholder name="renderCategoryPicker" />}
```

In a development build it is a dashed, muted box naming the slot (stamped
`data-stapel-slot`); in production it renders nothing. It paints with
`@stapel/tokens` custom properties only, so it works under any design system —
which is why it lives here and not in the antd skin. `visibility="visible"`
pins it on for a production-built showcase; `isDevBuild()` is the switch.

## Elevation: the wall comes down for some acts, not all of them

A marketplace visitor who has not registered can read the catalogue and, until
this seam, could do nothing with it. Saving a listing and writing to a seller
are the acts the product exists for; refusing them until a stranger fills in a
form is friction with nothing on the other side of it. Leaving a review and
publishing a listing are the opposite case — a review from an account nobody
can trace is worthless as social proof, and a seller who cannot be reached
again is not a seller.

So the interesting part is not "mint an account", it is WHICH ACTS may. That
arrives as data:

```tsx
// The host names the acts. @stapel/auth-react implements the minting.
<ElevationProvider source={authRuntime.elevation}>

// A gated control asks for ONE named action.
const elevation = useElevation(LISTINGS_ELEVATION_ACTIONS.favorite);
const gate = matchMandate(mandate, {
  anonymous: () =>
    elevation.covers ? actionAvailable() : actionBlocked(SIGN_IN_KEY),
  ...
});
const save = () => elevation.run(() => mutation.mutate(input));
```

Three properties the shape enforces rather than documents:

- **Never on render.** `run` takes the work to do afterwards, so elevation is
  reachable only from something a person did. A hook that minted on mount
  would create a row for every crawler.
- **Once per visitor.** The source collapses concurrent and repeat calls onto
  a single mint; a double-tap is one account.
- **Per action, not per session.** The mandate axis is untouched by a mint, so
  a minted guest stays `"anonymous"` and every act the host did not name keeps
  its wall — for the same person, in the same session.

`source={null}` is a first-class wiring and the default everywhere else: every
`covers` is `false` and every gated control refuses exactly as it did before.

## Host seams: the router and the sign-in door

A pair renders screens; the CONTAINER owns navigation and owns the session.
Both used to be papered over with a plain `<a href>`, and both produced the
same class of defect on the storefront's first real mount: a full page reload
inside a SPA, and a blocked control whose stated reason had no next action.

```tsx
// One adapter, written once by the container, taken by every pair.
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <Link to={href} {...rest}>{children}</Link>
);

<CategoryTreePane linkComponent={RouterLink} />
<ListingCard listing={row} href={`/l/${row.id}`} linkComponent={RouterLink} />
<StartChatButton sellerId={sellerId} signIn={{ href: `/login?next=${here}` }} />
```

`LinkComponent` takes a plain `href` — a pair never builds a router
descriptor, because it does not know which router it is inside. A skin that
takes one renders every navigation through it and falls back to an anchor when
it is absent, so "works with no wiring" stays the default.

`SignInCta` is `{ href }` **or** `{ onSignIn }`, never both: a control that
navigates *and* calls back is the same two-navigations-for-one-click defect in
a different hat. It is rendered BESIDE `actionBlocked`'s reason, never instead
of it — hiding a control from a visitor teaches nobody the feature exists.

Both are types only: no runtime, no router, no antd. The link's LABEL is not
here either — each pair ships that in its own bundle, because core floors `en`
and `ru` while those pairs also ship `es`.

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

## Slugify

`slugify(text, { maxLength? })` turns a listing/catalogue title into a
URL-safe slug: per-word transliteration of Cyrillic (Russian, plus the
Ukrainian/Belarusian/Kazakh letters `ё`/`є`/`і`/`ї`/`ґ`/`ў`/`ә`/`ғ`/`қ`/`ң`/`ө`/`ұ`/`ү`/`һ`),
lowercase, digits kept, everything else dropped, words joined with `-`, no
leading, trailing or doubled hyphens.

```tsx
import { slugify } from "@stapel/core";

slugify("Toyota Camry 2.5 AT, 2019"); // "toyota-camry-2-5-at-2019"
slugify("Стол с электроподъёмом, светлый"); // "stol-s-elektropodyomom-svetlyy"
slugify("iPhone 15 Pro Max 256 ГБ"); // "iphone-15-pro-max-256-gb"
```

Its Cyrillic table is chosen for a slug a person can read aloud (`ё` → "yo",
`й`/`ы` → "y", `щ` → "shch", `ї` → "yi", `є` → "ye"), not for the fuzzy prefix
match in [`search-react`'s `translit.ts`](../search-react/src/state/translit.ts) —
same alphabet, a different job, so the tables differ on purpose. This table
is a shared contract with consumers (e.g. a storefront's own
`slug.test.ts`, copied into this package's test suite) — a letter's mapping
does not change without updating both.

`maxLength` (default 60) cuts on a word boundary: a whole trailing word is
dropped rather than chopped mid-token, unless the very first word alone
already overruns the budget, in which case it is hard-cut.

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

From the governing doc (frontend-core-architecture-v2 §43.5):

> Frontend encryption does NOT protect against XSS with code execution —
> it protects against a shared computer, residual data, and casual access —
> and must not be sold as more than that.

## Notes

- Peer deps: `react >= 19`, `@tanstack/react-query ^5`. Only runtime dep:
  `idb-keyval` (+ `@stapel/tokens`).
- Standalone-buildable; the npm tarball ships `src/` (frontend-standard §7).
- TODO(frontend-standard §4.5): precompile with React Compiler at publish so
  consumers outside the Stapel toolchain get baked-in memoization. The package
  is currently hooks-only (no JSX-heavy render paths), so the compiler yields
  nothing yet; wire it into the publish pipeline together with the first
  headless components.
