# @stapel/calendar-react

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
