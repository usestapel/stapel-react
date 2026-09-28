---
"@stapel/geo-react": patch
---

TileMap: the wheel over the map zooms it again with no modifier, as before 0.7.0 — the Ctrl/⌘ requirement, the hint overlay, `labels.wheelHint` and the `geo.picker.wheel_hint` key are removed. Wheel travel stays accumulated (one level per ~100 px), so a trackpad's stream of small deltas does not jump a level per event. The 0.7.0 drag fix stays: a drag never outlives its button.
