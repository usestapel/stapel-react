---
"@stapel/calendar-react": minor
---

New pair: **`@stapel/calendar-react`** — the headless React pair for
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
