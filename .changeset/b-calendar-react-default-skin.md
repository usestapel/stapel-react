---
"@stapel/calendar-react": minor
---

The calendar becomes a feature, not a client: a default antd skin, six missing headless primitives, and the wire dedup the contract has always demanded.

**The dedup (correctness bug, independent of any skin).** `GET /calendar` returns a materialized occurrence twice by design — as a row in `events[]` and as an entry in `occurrences[]` — and stapel-calendar's MODULE.md says clients must dedup by `occurrences[].materialized_id == events[].id`. This pair did not: it handed both arrays through raw, so every consumer drew a repeating meeting twice at the same instant, and cancelled rows arrived as ordinary events with no arm. `dedupeCalendarRange` (`model/occurrences.ts`) now applies the rule once, in the pair, and `CalendarViewBag.state` carries `instances` (each drawable instant exactly once, with its series identity intact) plus a named `cancelled` arm. Six tests pin it against the generated schema types.

**Six primitives that were hooks and nothing else.** `EventList`, `EventDetail`, `EventEditor` (PATCH **and** cancel), `EventDelete`, `ParticipantsEditor` and `Availability` — availability, the agenda, detail, edit/cancel, delete and the invitee replace-set were reachable only by a host that wrote the whole screen itself.

**A default skin behind `./default`** (new export; `antd` + `@stapel/tokens-antd` peers): `Calendar` (month/week/day, geometry from element width — a narrow box gets the agenda, never a sideways-scrolling grid), `CalendarMonthGrid`, `CalendarAgenda`, `EventSheet`, `EventEditorSheet` (create and edit in one surface, with the cancel arm), `RecurrenceField` (presets read from a registry, `until` XOR `count`), `ParticipantsField` (shows the complete resulting set before a replace-set write), `RsvpControl` (ONE primary, the server-set `invited` never offered), `DeleteEventAction` (confirmation in a sheet, told apart from cancel), `AvailabilityPane`. Every dialog is `SkinDialog`/`SkinConfirm`; every load arm, empty state and error comes from `@stapel/tokens-antd/skin`; there is deliberately no local `SkinTheme` copy and no local `ErrorAlert`.

**`truncated` is on the screen.** `AvailabilityResponse.truncated` means a series expansion hit its cap and later times only LOOK free. It appeared nowhere outside the generated schema; it is now a visible warning above the slots, and an empty `slots[]` is named as "no windows are set" rather than "nothing free".

**The mandate refusal has words.** stapel-calendar moved the event endpoints onto `HasWorkspaceMandateIfScoped`, creating a refusal class with no typed footprint. `error.503.mandate_unavailable` was missing from the error bundle entirely (it rendered as a raw key); it is regenerated, and `isMandateUnavailable`/`isMandateDenied` keep "we could not ask" from rendering as "you may not".

**Also:** dates and times go through a formatter (`model/format.ts`) — no component interpolates a wire instant into JSX; client-side parity for the two documented 400s (`end >= start`, `slot_minutes >= 1`) as blocked-action reasons beside the control; `ru` and `es` bundles on `./i18n/ru` and `./i18n/es`; a nav manifest (`calendar.month`, `calendar.availability`); the contract pin moves from `>=0.3 <0.4` to `>=0.6 <0.7` against stapel-calendar 0.6.1, whose schema now declares the `start`/`end`/`slot_minutes` query parameters the client had been hand-writing.

Breaking (pre-1.0, therefore minor): `CalendarRangeData` gains `instances`/`cancelled` and its `events` no longer includes materialized-occurrence duplicates or tombstones.
