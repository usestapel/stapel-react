# @stapel/gdpr-react

Headless React pair for **stapel-gdpr** (frontend-standard §2): the deletion
lifecycle, made visible to the person it is about. Account closure with its
cancellable grace, the entity erasures a host opens after its own delete, the
"waiting to be deleted" list with both of its clocks, the data export, and the
DSAR intake in its app and anonymous-form variants — plus the two staff screens
that make silence visible. Business + state only in the main entry, zero visual
opinion; opt-in `/default` and `/default/admin` subpaths ship the antd skins.
Built on `@stapel/core` (typed client + `StapelApiError` envelope, token
refresh, verification-403 interception, i18n engine, analytics seam, TanStack
Query).

See `MODULE.md` for the layer map, extension seams, and the open questions.

## The rule every hook here is built on

**A refusal is read by CODE, never by status.** stapel-gdpr answers three
different 404s, two different 409s and two different 410s — and in two of those
cases a 404 is not a failure at all:

| status | code | what it means |
|---|---|---|
| 404 | `gdpr.no_active_closure` | **your account is not being deleted** |
| 404 | `gdpr.export_not_found` | **you have never asked for an archive** |
| 404 | `gdpr.erasure_not_found` | no such erasure — a real miss |
| 409 | `gdpr.closure_already_pending` | you already asked; nothing to do |
| 409 | `gdpr.legal_hold` | we *may not* delete this yet |
| 410 | `gdpr.download_consumed` | the link was already used |
| 410 | `gdpr.download_expired` | the link ran out of time |

`useAccountClosure` and `useDataExport` fold the first two into `null` — a real
answer, not an absence — so the screen a person opens to ask *"is my account
being deleted?"* can never reply "something went wrong". The two 410s are
opposite advice at one status, which is why `isDownloadConsumed` and
`isDownloadExpired` exist. Every predicate lives in `model/refusals.ts`.

## Two clocks, and both are the server's

`due_at` is when **our** systems must be done with something. `fully_erased_by`
is that stretched to the last subprocessor's contractual window
(`max(due_at, max(obligation.due_at))`). A product that showed only the first
would be telling someone their recording is gone from the world on a date when
it is merely gone from us.

Nothing here derives, counts down or re-computes a deadline: `ack_due_at` is
three *business* days and `fully_erased_by` comes from a host-configured
processor table — neither is arithmetic a browser can do. The pair FORMATS the
instant the server sent (`formatDeletionDate`) and stops there.

## Use it

```tsx
import { useRequestErasure } from "@stapel/gdpr-react";
import { PrivacyPane } from "@stapel/gdpr-react/default";
import { PrivacyAdminPane } from "@stapel/gdpr-react/default/admin";

// The whole account screen, wired — what the nav manifest's
// `account.privacy` mounts.
<PrivacyPane labelFor={titleOf} />;

// The staff screen — `admin.privacy`.
<PrivacyAdminPane />;
```

The seam a product wires into its own delete button is `useRequestErasure`,
and the ORDER is not negotiable — it is called **after** the host's own delete
succeeds, because the clock it starts is a purge SLA for something already off
the screen, not a grace period:

```tsx
const erase = useRequestErasure();

await deleteRecording(id);                                  // your delete
erase.mutate({ subjectType: "recording", subjectKey: id }); // then the receipt trail
```

A 403 there (`error.403.gdpr.erasure_forbidden`) is usually the host's missing
`ERASURE_AUTHORIZER` — the module's default is staff-only — so
`isErasureForbidden` exists to say that rather than accusing someone of not
owning their own recording.

The public `/privacy` page mounts the anonymous form on its own:

```tsx
<GdprProvider runtime={runtime}>
  <DsarForm variant="anonymous" captchaToken={token} />
</GdprProvider>
```

`POST /dsar` is `AllowAny` — a form a regulator expects to exist cannot require
a login — so the two variants are genuinely different callers, not a style
choice: the app variant sends no email (the server reads it off the session and
ignores a supplied one), the anonymous variant requires one and carries the
host's captcha token. The captcha widget is the host's: this package ships none
and guesses at no provider.

## What this pair deliberately does not do

- **Start an erasure from an anonymous DSAR.** Turning an unverified email into
  a deletion is an oracle. Matching a request to an account is a staff act
  (`useUpdateDsar` with `userId`), and nothing here papers over that with a
  client-side lookup.
- **Produce a download token.** No read returns one; it is emailed on purpose,
  so taking a copy of somebody's entire personal data needs more than a live
  session in a borrowed browser. `<DataExportPanel token={…}/>` takes the token
  the host lifted from that link, and otherwise says where the link is.
- **Serve the service endpoint.** `POST /internal/export/{id}/part-ready` is
  `IsServiceRequest` — a data owner posts its finished section with a service
  credential no browser holds. `manifest.json` still lists the whole contract.

## Install

```
pnpm add @stapel/gdpr-react @stapel/core @tanstack/react-query react
```

## Wire the app once

One `<StapelProvider>` for the whole app (core's config + query + i18n in a
single component — slim wave §21/S4), one `<GdprProvider>` for this pair:

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import {
  createGdprRuntime,
  GdprProvider,
  registerGdprI18n,
} from "@stapel/gdpr-react";

const runtime = createGdprRuntime({ baseUrl: "/gdpr/api/v1/" });
const i18n = createI18n({ locale: "en" });
registerGdprI18n(i18n); // the pair's key bundle → core's engine

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.0.0">
      <GdprProvider runtime={runtime}>{children}</GdprProvider>
    </StapelProvider>
  );
}
```

Already wired a `<StapelProvider>` for another pair? Keep the ONE provider and
pass this runtime's client as a per-module override — `clients={{ gdpr:
runtime.client }}` — then nest `<GdprProvider>` beside your other pair
providers.

`createGdprRuntime` also forwards `fetch` / `credentials` / `defaultHeaders` to
the pair's raw-bytes surface (`api/download.ts`), which cannot ride the JSON
client: the export archive is a ZIP and core's client parses every success as
text. That surface folds a refusal through core's own `parseErrorEnvelope`, so
a 410 there is the same `StapelApiError` as everywhere else.

## Layers

```
src/
  api/        typed client over this pair's own generated `components`,
              plus the raw-bytes download and the two request unions
  model/      query keys, the five reads and the six writes, the refusal
              predicates, date formatting, runtime, context
  flows/      toFlowError + zero-flow registry shim (stapel-gdpr annotates
              no @flow_step; a 30-day grace is a server clock, not a machine)
  headless/   renderless components (GdprProvider)
  default/    the member antd skin (AccountClosurePanel, PendingDeletions,
              DataExportPanel, DsarForm, PrivacyPane) — opt-in subpath
  default/admin/  the staff skin (DsarQueue, OwnersHealth, PrivacyAdminPane)
  nav/        the scripted-fullstack nav entries (account.privacy, admin.privacy)
  i18n/       translation keys, en inline + opt-in ru subpath, generated error map
  analytics/  generated typed-event registry (events.json)
demo/         first-class demos (compiled, product-linted, smoke-rendered)
```

## Generated surfaces (drift-gated)

| Surface | Path | Gate |
|---|---|---|
| Typed API schema | `src/api/generated/schema.ts`, from stapel-gdpr's own `docs/schema.json` | `pnpm gen:api:check` |
| Flow registry | none — zero-flow module (`src/flows/registry.ts` shim) | `pnpm gen:flows:check` |
| Backend error map + en/ru bundles | `src/i18n/generated/` | `pnpm gen:errors:check` |
| Typed-event registry | `src/analytics/generated/events.json` | `pnpm gen:events:check` |
| Demos → Ladle stories | `demo/generated/` | `pnpm gen:demos:check` |
| `manifest.json` + `llms.txt` | package root | `pnpm gen:manifest:check` |
| `nav-manifest.json` | package root + the monorepo aggregate | `pnpm gen:nav:check` |

These drift gates run at the **monorepo root** (`pnpm gen` / `pnpm gen:check`) —
the env-parametrized `scripts/gen-*.mjs` drivers are shared, not forked.

## Guardrails

Linted by the shared `@stapel/eslint-plugin` flat config (no raw colours, no raw
token imports, no raw fetch, i18n-key existence, typed analytics, headless-only)
and the shared **stylelint** preset — `pnpm lint` per package plus `pnpm
lint:css` at the root. Demos are first-class code: compiled by
`tsconfig.demo.json`, linted with the product ruleset, and smoke-rendered by
`test/demos.test.tsx` — but never shipped (excluded from the `files` allowlist;
proven by `test/prodBundlePurity.test.ts`).

## License

MIT
