---
"@stapel/docs-react": patch
---

Raise the `@stapel/core` peer floor to 0.13.0 — the 0.3.0 headless bags hand
out `LoadState` and are rendered through `matchList`/`matchLoad`, all of which
ship in core 0.13.0. A host on core 0.12 satisfied the declared peer range and
then failed at runtime on the missing imports; the floor now states what the
code already requires.
