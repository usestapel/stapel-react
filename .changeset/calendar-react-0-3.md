---
"@stapel/calendar-react": minor
---

Track stapel-calendar 0.3.x (scheme B — the pair's minor follows the backend
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
