---
"@stapel/geo-react": minor
---

TileMap: a drag never outlives its button, and the wheel belongs to the page.

- Only a held main button pans. A drag whose release never reached the map (the OS context menu swallowing the mouseup of a right or ctrl click, focus leaving the window mid-drag, a lost pointer capture) is ended by the next buttonless mouse/pen move, by `contextmenu`, by `lostpointercapture` and by window `blur` — before, the map kept following a cursor that was only hovering.
- The wheel zooms only with Ctrl/⌘ held (a trackpad pinch is ctrl+wheel); wheel travel is accumulated so one pinch does not jump a level per event. A plain wheel scrolls the page and shows `labels.wheelHint` over the map for a moment. New optional label `wheelHint` and i18n key `geo.picker.wheel_hint` (en/ru/es); `PickerBody` supplies it with "Ctrl" or "⌘".
