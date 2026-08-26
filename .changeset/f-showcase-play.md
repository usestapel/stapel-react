---
"@stapel/showcase": minor
---

**`play`** — a variant may declare an async step that runs after it mounts (open the sheet, click the tab, type a query), so the state a static render cannot reach gets photographed. `DemoStage` renders the variant and runs the step, stamping `data-stapel-play="pending|done|failed"` (with `data-stapel-play-error`) for the shot runner; `runDemoPlay` runs it in a vitest smoke test; `createPlayContext` gives the step `canvas`, `waitFor`, `find` (with `{ portal: true }` for a dialog) and `click`. `assertVariantsRenderDistinctly` / `duplicateVariantGroups` skip played variants — their first frame is legitimately a sibling's — and the error message names `play` as one of the three ways out. `playVariantIds` lists them. gen-demos records `play: true` in `demos.json` and the story's `parameters.stapel`, and mounts such a story on `DemoStage`.
