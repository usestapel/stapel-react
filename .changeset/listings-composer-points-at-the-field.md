---
"@stapel/listings-react": patch
---

The composer's `locationPicker` slot documentation now points at `@stapel/geo-react`'s `LocationField` rather than `LocationPickerField`, and says why the difference matters.

No code changed: the slot contract (`{ value: { lat, lon, address? }, onChange }`) already fits both, which is what a slot is for. But the two components are not interchangeable from the person's side. `LocationPickerField` is a button — "Choose on the map" — that prints its answer underneath itself, so a form somebody has just filled in goes on looking empty, and the question names the mechanism instead of the thing being asked. `LocationField` is a field: it states the question while empty and holds the chosen place inside itself once it is not, and one tap runs the ladder behind it — the permission pre-prompt before the browser's one-shot prompt, the server's IP guess when that is refused, then the map.

The adapter in the docblock is the copy-pasteable one for the new shape.
