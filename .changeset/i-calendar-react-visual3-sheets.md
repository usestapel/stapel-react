---
"@stapel/calendar-react": minor
---

The dark sheets go dark, the week grid stops lying about fitting on a phone,
and `u-1` becomes a person.

**Every dialog now carries its own theme.** `EventSheet`, `EventEditorSheet`
and `DeleteEventAction`'s confirmation render into a portal, so they inherit a
`ConfigProvider` only from the tree they are DECLARED in — beside the trigger,
not inside the screen's painted panel. Nothing wrapped them, so antd served its
compiled-in LIGHT theme and every one of the fourteen dark sheet shots was a
white panel over a black page (visual pass CF-1 / N-1). Each now declares
`<SkinTheme surface="bare">` around itself and takes a `mode` prop that
`<Calendar>` forwards. The same defect was hiding in the parts: `ParticipantsField`,
`RsvpControl`, `RecurrenceField`, `CalendarAgenda` and `CalendarMonthGrid`
mounted standalone rendered antd's light palette on the showcase's dark page —
the invitee editor was literally black text on black — and they self-theme now
too. Nested `SkinTheme`s cost nothing (the substrate reuses an identical applied
theme and emits no second provider), so self-theming is free and inheriting was
a bug waiting for the next host.

**`CalendarMonthGrid` collapses to the agenda in a narrow box.** The rule lived
only in `<Calendar>`, so the grid mounted directly — a host's dashboard widget,
a 380px side panel, this package's own `grid-only` story — drew seven columns
into 390px and clipped every entry to `2:0…`. The component measures its own
element and renders `<CalendarAgenda>` below `GRID_MIN_WIDTH`; the threshold is
unchanged, it is now the grid's own.

**People have names.** stapel-calendar stores participation as opaque ids and
ships no name endpoint, and a pair talks to one module — so the pair grows the
seam instead of the lookup: `<CalendarPeopleProvider resolveUserName={…}>`, read
by `useUserName()` wherever a person is printed. The detail sheet's organizer and
both invitee lists now show the host's name plus an initials avatar, falling back
to the id when the host knows nothing. Removing an invitee is no longer a red
link: the replace-set is not sent until "Save invitees", and red is for what
cannot be undone.

**An expanded occurrence inherits its series' title.** `dedupeCalendarRange`
gave a virtual instant `title: ""`, and the series master never reaches
`events[]` (the backend filters `rrule=""`), so a repeating stand-up drew as
"Untitled event" beside its own concrete twin. The title now comes from the
series' materialized sibling.

**Copy and layout.** The detail sheet printed the start time twice in one line
("Starts: Jul 13, 2:00 PM · 2:00 PM – 3:00 PM") — one `When` row now.
`calendar.view.repeats` says "Part of a series" instead of the bare word
"Repeats"; the availability warning stops shouting ("only LOOK free" → a
sentence, in all three locales); a slot's button says "Book this slot" instead
of repeating the section heading above it. The screen header is two clusters
instead of three, and when a month range falls back to the agenda the control
strip says so, because the range switch reading "Month" over a day-grouped list
is the control lying about what is on screen. The editor states an owner-only
refusal at the TOP of the form: as a sentence under a submit button three
scrolls down a sheet it was below the fold, which is why `edit` and `not-owner`
photographed identically.

**The date fields are wrapped, not replaced.** `datetime-local` stays — it is
the accessible, zero-dependency, locale-correct picker, and on a phone it opens
the native wheel — but each field now echoes its value through the pair's own
`formatDateTime`, so the sheet no longer shows `13.07.2026, 13:00` two taps from
`Jul 13, 2026, 2:00 PM`.

**Four legacy stories deleted** (`calendar.provider`, `calendar.view`,
`calendar.composer`, `calendar.rsvp`) with the harness apparatus that drew them.
They photographed a card printing a component name over a `state.step` token —
the headless twin, not the product — and the skin demos supersede them
one-for-one (`covers` keeps the headless completeness gate green: 8 demos, 10
headless covered, 10/10 skin covered under `DEMOS_SKIN_GATE=strict`).
