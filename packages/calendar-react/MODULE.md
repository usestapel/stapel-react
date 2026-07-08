# @stapel/calendar-react — module guide

Headless React flow pair for **stapel-calendar**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## Layers

- **api/** — `createCalendarApi(client)` with one typed method per endpoint
  (`availability`, `calendar`, `listEvents`, `createEvent`, `getEvent`,
  `deleteEvent`, `respond`). **§17-native contract:** stapel-calendar is not in
  the unified monolith schema — it emits its OWN `docs/schema.json`, so this
  pair generates a package-LOCAL `src/api/generated/schema.ts` (shared
  `gen-api.mjs` via `API_OUT`) and `api/types.ts` aliases *that*, not core's
  shared `components`. Un-generatable surface — the `.ics` download-URL builder
  `eventIcsUrl`, the `isSubmittableRsvp` guard — lives in `api/extensions.ts`.
- **model/** — `calendarQueryKeys` (single key factory, `["calendar"]`
  namespace), `createCalendarRuntime`, React context/hooks. Read hooks
  (`useCalendar`, `useEvents`, `useEvent`, `useAvailability`) and write hooks
  (`useCreateEvent`, `useDeleteEvent`, `useRespondToEvent`) — every write
  invalidates the module root (`calendarQueryKeys.all`) on success, since a
  create/cancel/RSVP can shift the range calendar, the event lists, and
  availability at once.
- **flows/** — `createFlowMachine`-based machines (primitive imported from
  `@stapel/core`), bound to the generated `CALENDAR_FLOWS` registry. stapel-calendar
  annotates no `@flow_step` yet, so the registry is empty (correctly); scaffold
  machines from flows.json once it does, and keep them under `gen:flows:check`.
- **headless/** — render-prop components; `<CalendarProvider>` wires the runtime
  into context; `<CalendarView>`, `<EventComposer>`, `<EventRsvp>` expose the
  read/create/RSVP surface as renderless bags. shadcn-copyable
  (frontend-standard §7).
- **i18n/** — `CALENDAR_I18N_KEYS` + en bundle; the generated backend error
  bundle is merged in so every `error.*` code has a fallback.
- **analytics/** — `generated/events.json`, the typed-event registry projected
  from `defineEvent` call sites + flow funnels (`pnpm gen:events`). Read by the
  analytics lint and embedded into `manifest.json`; nothing to hand-edit.
- **demo/** — first-class demos (`defineDemo`, `@stapel/showcase`): `_harness.tsx`
  wires a mock runtime + i18n + query client; each `<Name>.demo.tsx` is compiled,
  product-linted, smoke-rendered, and projected to a Ladle story (`pnpm gen:demos`).
  The completeness gate requires ≥1 demo per exported headless component:
  `Calendar.demo.tsx` covers `CalendarProvider`, and `CalendarView` /
  `EventComposer` / `EventRsvp` each have their own. Demos never ship.

## Extension seams (frontend-standard §7)

- Client is injected via `<CalendarProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client. stapel-calendar
  authenticates via the `stapel_jwt` cookie, so a cross-origin browser host
  builds its runtime with `credentials: "include"`.
- The headless layer is fully replaceable (copy-and-own).

## Machines

None yet — stapel-calendar annotates no `@flow_step`, so the pair ships no flow
machines and `CALENDAR_FLOWS` is empty. When the backend adds flow annotations,
scaffold `create<X>Flow(deps)` machines from `flows.json`, bind each `id` to the
`CALENDAR_FLOWS` registry, and keep them under `gen:flows:check`.

## Localization

en-only. stapel-calendar ships no `translations/errors.<lang>.json` catalogs yet,
so `gen:errors` emits no per-locale bundle. Add a `./i18n/<locale>` subpath
(following the notifications-react etalon) once the backend ships a catalog.
