# @stapel/calendar-react

## 0.4.1

### Patch Changes

- ae57230: v1 canon sweep §60 (api-versioning.md §2, §6): regenerated schema.ts /
  flows / manifest / llms.txt against the backends' `/…/api/v1/` contracts;
  gen scripts and manifest tag prefixes repointed to `/api/v1/`; documented
  `baseUrl` examples and the auth QR same-origin guard now use
  `/<mod>/api/v1/`. Public TS types unchanged — only the fetch base / path
  literals carry the new version segment. Mount your runtimes at
  `/<mod>/api/v1/`.

## 0.4.0

### Minor Changes

- ca3ba45: Track stapel-calendar 0.3.x (scheme B — the pair's minor follows the backend
  minor). Regenerated from the `v0.3.1` contract and surfaced the two new event
  mutations:

  - **`useUpdateEvent`** (`PATCH /events/{id}`) — partial, owner-only update. Only
    the fields present in `patch` change; editing any recurrence field of a series
    master re-specifies the whole RRULE (send the complete recurrence spec, as for
    create). Backed by `CalendarApi.updateEvent` + the `EventUpdateRequest` type.
  - **`useReplaceParticipants`** (`PUT /events/{id}/participants`) — replace-set
    semantics: `participantIds` is the complete desired invitee list (the owner is
    always kept). Backed by `CalendarApi.replaceParticipants` +
    `ParticipantsReplaceRequest`.

  Both invalidate the module root on success, like the existing write hooks. The
  new `VISIBILITY` capability axis (participants|scope) is a backend deploy-time
  config that changes what the read endpoints return, not which endpoints exist —
  it needs no client surface and is reflected only via `backend.contract`
  (`>=0.3 <0.4`) in the manifest. Manifest now describes 10 operations.

### Patch Changes

- 9a4a3da: New pair: **`@stapel/calendar-react`** — the headless React pair for
  stapel-calendar (client priority: meettoday migrates onto stapel-calendar). The
  first pair generated §17-native, directly from the backend module's OWN
  per-module contract (`stapel-calendar/docs/{schema,flows,errors}.json`) rather
  than the unified monolith schema.

  - **API layer** — typed operations over the injected `StapelClient`
    (`availability`, `calendar`, `listEvents`, `createEvent`, `getEvent`,
    `deleteEvent`, `respond`), an `.ics` download-URL builder (`eventIcsUrl`), and
    the `isSubmittableRsvp` type-guard. Wire types are aliased from a
    package-LOCAL generated schema (`src/api/generated/schema.ts`, produced by the
    shared `gen-api.mjs` via the new `API_OUT` knob pointed at
    stapel-calendar's `docs/schema.json`) — stapel-calendar is not in the monolith,
    so this pair cannot draw from core's shared `components`. Documented
    corrections narrow the bare-`string` `rsvp` / `status` / `recurrence_type`
    fields and add the under-described range/slot query params.
  - **model** — namespaced `calendarQueryKeys`, read hooks (`useCalendar`,
    `useEvents`, `useEvent`, `useAvailability`) and write hooks (`useCreateEvent`,
    `useDeleteEvent`, `useRespondToEvent`) that invalidate the module root on
    success.
  - **headless** — `CalendarProvider`, `CalendarView`, `EventComposer`,
    `EventRsvp` (render-prop bags, zero visual opinion), each with a `*.demo.tsx`
    (completeness gate) and msw-backed hook tests.
  - **i18n** — `CALENDAR_I18N_KEYS` + en bundle merged over the generated backend
    error map (48 keys) so every `error.*` code has an en fallback. en-only:
    stapel-calendar ships no locale catalogs yet, so no `./i18n/<locale>` subpath.
  - **flows** — none (stapel-calendar annotates no `@flow_step`); the generated
    registry is correctly empty and drift-gated.
  - Self-describing `manifest.json` / `llms.txt` (8 operations, 48 errors),
    drift-gated by the shared root `gen:*` drivers. Version `0.2.0` tracks
    stapel-calendar's 0.2.x minor; `backend.contract` is `>=0.2 <0.3`.

- 4e6f442: Internal plumbing swap (slim wave §21/S2) — the pair's stamped
  `model/runtime.ts` / `model/context.tsx` / `headless/<Mod>Provider.tsx`
  boilerplate (byte-identical across the six standard pairs) now binds
  `@stapel/core`'s `createModuleRuntime` / `createModuleContext` factories
  instead of carrying its own copy. Public API preserved exactly: same exported
  names and signatures (`create<Mod>Runtime`, `<Mod>Runtime`,
  `Create<Mod>RuntimeOptions`, `<Mod>RuntimeContext`, `use<Mod>Runtime`,
  `use<Mod>Api`, `use<Mod>Analytics`, `<Mod>Provider>`), same guard-hook error
  messages. No behavior change.
- c3482e7: README wave (slim wave §21/S4): every pair now documents its setup — a new
  Install + "Wire the app once" section built on core's `<StapelProvider>`
  (previously only auth-react's README showed any wiring, as a 5-level provider
  nest). auth-react's wiring example moves to the one-provider shape with the
  `queryRuntime`/`i18n` escape hatches spelled out.
- d3232a9: Zero-flow scaffolding removed (slim wave §21/S3). These six backends annotate
  no `@flow_step`, so `gen:flows` now skips emission for them and the pair's
  `src/flows/generated/` files are gone. The public flow surface is preserved
  exactly by a tiny hand-written shim (`src/flows/registry.ts`): `<MOD>_FLOWS`
  (still `{}`), `<Mod>FlowId`/`<Mod>FlowSpec` (still `never`), `FlowEndpoint`,
  and `flowEndpoints` keep their names, types, and behavior. `toFlowError` and
  the core flow-machine re-exports are untouched. No public-surface delta; the
  generated registry returns automatically once the backend documents its first
  flow.

## 0.2.0

### Minor Changes

- New pair: **`@stapel/calendar-react`** — the headless React pair for
  stapel-calendar (client priority: meettoday migrates onto stapel-calendar).
  The first pair generated §17-native, directly from the backend module's OWN
  per-module contract (`stapel-calendar/docs/{schema,flows,errors}.json`) rather
  than the unified monolith schema.

  - **API layer** — typed operations over the injected `StapelClient`
    (`availability`, `calendar`, `listEvents`, `createEvent`, `getEvent`,
    `deleteEvent`, `respond`), an `.ics` download-URL builder (`eventIcsUrl`),
    and the `isSubmittableRsvp` type-guard. Wire types alias a package-LOCAL
    generated schema (`src/api/generated/schema.ts` — the shared `gen-api.mjs`
    driver via the new `API_OUT` knob, sourced from stapel-calendar's
    `docs/schema.json`), because stapel-calendar is not in the monolith and so
    cannot draw from core's shared `components`.
  - **model** — namespaced `calendarQueryKeys`, read hooks (`useCalendar`,
    `useEvents`, `useEvent`, `useAvailability`) and write hooks
    (`useCreateEvent`, `useDeleteEvent`, `useRespondToEvent`) that invalidate
    the module root on success.
  - **headless** — `CalendarProvider`, `CalendarView`, `EventComposer`,
    `EventRsvp` (render-prop bags, zero visual opinion), each with a
    `*.demo.tsx` and msw-backed hook tests.
  - **i18n** — `CALENDAR_I18N_KEYS` + en bundle merged over the generated
    backend error map (48 keys). en-only: stapel-calendar ships no locale
    catalogs yet.
  - **flows** — none (no `@flow_step` on the backend); the generated registry is
    correctly empty and drift-gated.
  - Self-describing `manifest.json` / `llms.txt` (8 operations, 48 errors).
    Version `0.2.0` tracks stapel-calendar's 0.2.x minor; `backend.contract` is
    `>=0.2 <0.3`.
