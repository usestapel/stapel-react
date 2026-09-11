# @stapel/profiles-react

Headless React flow pair for stapel-profiles: typed API client, TanStack Query hooks, flow machines, headless components, and i18n keys. Zero visual opinion.

Headless React flow pair for **stapel-profiles** (frontend-standard §2). Business +
state only, zero visual opinion — any design layers on top. Built on
`@stapel/core` (typed client + `StapelApiError` envelope, token refresh,
verification-403 interception, i18n engine, analytics seam, TanStack Query).

Scaffolded by `stapel-new-react-lib`. See `MODULE.md` for the layer map, machine
table, extension seams, and persist policy.

## Install

```
pnpm add @stapel/profiles-react @stapel/core @tanstack/react-query react
```

## Wire the app once

One `<StapelProvider>` for the whole app (core's config + query + i18n in a
single component — slim wave §21/S4), one `<ProfilesProvider>` for this pair:

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import {
  createProfilesRuntime,
  ProfilesProvider,
  registerProfilesI18n,
} from "@stapel/profiles-react";

const runtime = createProfilesRuntime({ baseUrl: "/profiles/api/v1/" });
const i18n = createI18n({ locale: "en" });
registerProfilesI18n(i18n); // the pair's key bundle → core's engine

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.1.0">
      <ProfilesProvider runtime={runtime}>{children}</ProfilesProvider>
    </StapelProvider>
  );
}
```

Hooks and headless components work anywhere below `<ProfilesProvider>`
(`useProfilesApi`, the query/mutation hooks, the render-prop components — see
`MODULE.md`). Already wired a `<StapelProvider>` for another pair (or
auth-react)? Keep the ONE provider: pass this runtime's client as a
per-module override — `clients={{ profiles: runtime.client }}` — and nest
`<ProfilesProvider>` next to your other pair providers. The individual core
providers (`StapelConfigProvider` + `QueryClientProvider` + `I18nProvider`)
remain exported for bespoke composition.

## A name is a slot before it is a name

A person's name arriving is the largest thing that changes size on a page built
around it: a line of loading text and a rendered heading are not the same box,
and swapping one for the other moves everything below. Measured on a live seller
page, a 24px loading line became an 86px `h4` and pushed the whole results grid
down — CLS 0.0281 at 1440.

`<ProfileNameHeading>` is the slot rather than the swap. Both states are the
same `<Typography.Title>` at the same level, so antd's margins and line box are
identical, and the class contract states the floor from that level's own tokens:

```tsx
import { ProfileNameHeading } from "@stapel/profiles-react/default";

const profile = useProfile(userId);

<ProfileNameHeading
  loading={profile.isPending}
  name={profile.data?.display_name}
/>;
```

While it waits the heading carries `aria-busy` and the pair's "loading the
profile" sentence as its accessible name; when it lands, the name — or, for the
empty-but-renderable profile stapel-profiles 0.15.0 provisions at registration,
the pair's word for a nameless one. `data-state` publishes which is on screen.

## The seller's phone number

A number is never on a listing, a search result or a profile body. The only
thing a public profile carries is one bit — is there a number worth asking for
— and the only way to a number is one POST that is journalled for its owner and
budgeted for the viewer.

```tsx
import { hasPhone } from "@stapel/profiles-react";
import { RevealPhoneButton } from "@stapel/profiles-react/default";

const seller = useProfile(sellerId);

// The button renders at all only because the profile said there is a number.
<RevealPhoneButton
  ownerKey={sellerId}
  listingId={listing.id}
  available={hasPhone(seller.data)}
  renderDoor={() => <AuthPanel mode="register" />}
/>;
```

On a 200 the button is replaced, in place, by the numbers as `tel:` links. The
answer is held on the mutation object and nowhere else — no query key, no
persistence, no storage, no URL — because every hand-over is a recorded event
and a cached copy is a hand-over nobody recorded. A viewer with no account
(signed out **or** a guest) gets 403 `contacts_registration_required`, which is
why `renderDoor` is full registration rather than a sign-in link; over the
hourly budget the sentence says how many minutes to wait.

The owner's side is one screen:

```tsx
import { ContactsManager } from "@stapel/profiles-react/default";

<ContactsManager />; // add, confirm by SMS, policy, on/off, hand-over counters
```

A number is masked to its last two digits until its owner asks to see it, an
unverified number says out loud that it reaches nobody, and the policy picker
is built from the vocabulary `GET /contacts` sent rather than from three
hardcoded strings. Composing your own screen instead: `useContacts()` and
`useRevealContacts()` carry the whole surface, headless.

## Layers

```
src/
  api/        typed client — thin adapter over @stapel/core `components`
  model/      query keys, runtime wiring, context/hooks
  flows/      toFlowError + zero-flow registry shim (machines + generated
              registry arrive with the backend's first @flow_step)
  headless/   renderless components (ProfilesProvider, flow render-props)
  i18n/       translation keys + generated backend error map
  analytics/  generated typed-event registry (events.json)
demo/         first-class demos (compiled, product-linted, smoke-rendered)
```

## Generated surfaces (drift-gated)

| Surface | Path | Gate |
|---|---|---|
| Flow registry | none — zero-flow module (`src/flows/registry.ts` shim); `gen:flows` emits `src/flows/generated/` once the backend documents flows | `pnpm gen:flows:check` |
| Backend error map + en bundle | `src/i18n/generated/` | `pnpm gen:errors:check` |
| Typed-event registry | `src/analytics/generated/events.json` | `pnpm gen:events:check` |
| Demos → Ladle stories | `demo/generated/` | `pnpm gen:demos:check` |
| `manifest.json` + `llms.txt` | package root | `pnpm gen:manifest:check` |

These drift gates run at the **monorepo root** (`pnpm gen` / `pnpm gen:check`) —
the etalon's env-parametrized `scripts/gen-*.mjs` drivers are shared, not forked.
`stapel-new-react-lib` wired this pair into the root `gen`/`gen:check` aggregates
at scaffold time (one env-parametrized invocation per driver). The typed
`schema.ts` is core-owned (`pnpm gen:api`); design tokens are tokens-owned
(`pnpm gen:tokens`).

### Russian locale (opt-in subpath)

The `ru` bundle ships as a separate subpath so it never bloats the main entry
(size-limit gated — the locale stays out of hosts that don't register it):

```tsx
import { registerProfilesI18nRu } from "@stapel/profiles-react/i18n/ru";

registerProfilesI18n(i18n);      // en floor + polish
registerProfilesI18nRu(i18n);    // ru locale (generated from the backend catalog)
await i18n.setLocale("ru");      // live switch; a missing key degrades to English
```

Backend error texts are generated from stapel-profiles's
`translations/errors.ru.json` catalog (`pnpm gen:errors`, drift-gated); the
pair's UI keys carry hand-written ru copy. Register your own bundle AFTER the
pair's to override any key — registration order is override priority.

### Spanish locale (opt-in subpath — backend errors today, UI copy later)

The `es` bundle ships as its own subpath on the same terms as `ru`, with one
difference stated up front: **it translates the 53 backend error codes, not
the pair's own UI copy.** `registerProfilesI18nEs` registers the en floor UNDER the
Spanish texts, so a Spanish-speaking user reads Spanish error messages and
English UI copy — never a raw key.

```tsx
import { registerProfilesI18nEs } from "@stapel/profiles-react/i18n/es";

registerProfilesI18n(i18n);      // en floor + polish
registerProfilesI18nEs(i18n);    // es locale (generated from the backend catalog)
await i18n.setLocale("es");    // live switch; untranslated UI keys read English
```

Error texts are generated from stapel-profiles's `translations/errors.es.json`
catalog (`pnpm gen:errors`, drift-gated) and are complete over the error
registry by construction. The coverage boundary is asserted in
`test/i18nEs.test.ts`; when hand-written Spanish UI copy lands, it lands
additively — this subpath and `profilesI18nBundleEs` keep their names.

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
