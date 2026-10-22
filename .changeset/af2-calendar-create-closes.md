---
"@stapel/calendar-react": patch
---

`<EventEditorSheet>` reports a write once its answer lands: `onSaved` used to read the mutation result inside the click handler, where it was still `null`, so it never fired and the "New event" sheet stayed open over "Event created.". A created event now closes the sheet and resets the composer.
