---
"@stapel/tasks-react": patch
---

Visual pass VISUAL3: the three pieces of developer copy are gone, the boards
list fits a phone, and the sheet is named after the card it is showing.

**M-7 — copy written for the integrator, shown to the customer.** Three strings
told a person about this pair's API surface: "This app has not wired board
navigation, so this button has nowhere to go", "Renaming and deleting a column
are not part of this API yet, so this screen does not offer them", and "This app
has not wired a people picker." All three are now refusals in the product's own
voice ("Opening a board is not available here."), in `en`, `ru` and `es`.

**M-4 — 625 CSS pixels of horizontal overflow on the boards list.** The gated
"Open board" control lived in antd's `List.Item` `actions` slot, which renders a
content-sized `<ul>` that neither wraps nor shrinks — so the sentence beside a
blocked button set the width of the page. Each row is now an element-width
stack: meta on top, a wrapping control row under it, both bounded by the column.
Archiving is reversible and is no longer a red button of equal weight beside the
primary one.

**M-2 — machine values as user copy.** The `Shape` select offered an option
labelled `simple`: presets are an open merge registry on the backend and carry
nothing but a machine key, so the label is now built from the preset's own
columns, each through its translatable `name_key` — "To do, In progress, Done",
in the reader's language and correct for a host-registered preset the pair has
never heard of. The showcase's assignee chips read `11` and `66` because the
demo left `createTasksRuntime({ userLabel })` — the seam that exists for exactly
this — unfilled; it is wired now, so the catalogue photographs the product
rather than the id fallback.

**The sheet's header said `Title`** — the label of the field below it — over
every card in the fleet. It is the card's own name, falling back to "Card" while
the read is in flight. The board's custom fields moved above the workflow
controls: they are part of the card's content, and at the bottom of a scrolling
sheet nobody ever saw them.

**M-6 / N-4 — five variants and two stories that photographed nothing new.**
`kanban-board`, `boards`, `column-manager`, `board-create-sheet` and `task-sheet`
each declared a `phone` variant that rendered the identical tree as `default`
(the responsive switch is width-driven, and the shot runner already shoots every
story at 390 and 1280). They are dropped and the surviving variant carries
`viewport: "phone"`. `task-sheet`'s `features` variant passed `featureDefs` with
no renderer, which draws `SlotPlaceholder` — a DEV-only component that renders
nothing in the built showcase, so the variant documenting custom fields
photographed a card without any; it now fills the `renderFeatures` seam the way
a host does. `tasks.headless`, a `state.step` chip dump with raw column keys, is
deleted; `kanban-board` and `task-sheet` carry its coverage.

`test/demos.test.tsx` now runs `assertVariantsRenderDistinctly` against a jsdom
renderer (half this package's surfaces are portal-rendered dialogs, which
React's server renderer refuses), so a variant that stops being seeded turns red
where it is introduced.

**CI flake, not a defect:** this was the one package without the fleet's
`testTimeout: 30_000`, and testing-library's own 1s `waitFor` budget — which
`testTimeout` does not raise — expired inside the board's first antd render on a
loaded runner. Both are set now.
