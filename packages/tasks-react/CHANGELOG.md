# @stapel/tasks-react

## 0.1.1

### Patch Changes

- f952306: Visual pass VISUAL3: the three pieces of developer copy are gone, the boards
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

- 0e33d0b: The suite stops depending on how loaded the machine is. Three defects, none of
  them in the assertions:

  **`prodBundlePurity` ran `npm pack` inside the parallel turbo graph.** The
  tarball check shells out to `npm pack --dry-run` — 7.6s of real I/O on an idle
  machine, 49s when the fleet's suites run four wide, against a 30s budget. Every
  other pair moved this out of `test` and into a serialized `test:pack` script
  (CI runs it with `--workspace-concurrency=1`); this one was missed. It now
  follows the same split, and tolerates npm >= 11's object-shaped `--json` report
  the way the rest of the fleet already does.

  **`test/vitest.setup.ts` never unmounted anything.** vitest runs without
  injected globals, so testing-library's automatic cleanup never registers. Files
  that declared their own `afterEach` were covered; `demos.test.tsx` was not, so
  every demo it mounted stayed mounted for the rest of the run and React kept
  scheduling work into the environment teardown — `ReferenceError: window is not
defined`, reported as an unhandled error after a suite whose tests all passed.
  Unmounting in the shared setup covers every file and keeps each render's cost
  flat instead of growing with the trees before it. `demos` 1859ms → 560ms,
  `defaultSkin` 4051ms → 1288ms, `taskSheet` 5355ms → 2061ms.

  **"follows the document's theme rather than a light literal" counted
  microtasks.** The flip travels `MutationObserver` → `useSyncExternalStore` →
  render; the test awaited exactly one resolved promise inside `act` and then
  asserted, which bets on how many ticks that path takes. It waits for the
  outcome instead. `data-theme` is now cleared in `afterEach`, so a failure there
  can no longer leave every later case rendering dark.

  Also shims the pseudo-element form of `getComputedStyle`, which jsdom refuses
  and antd 6's scroll locker calls on every dialog mount — each refusal was
  emitted as a `jsdomError` carrying a full React stack, burying the sheet
  suite's real output.

## 0.1.0

### Minor Changes

- 308e3d6: First real release: the kanban board, headless and skinned.

  **api** — all 22 operations of stapel-tasks 0.3.1, typed off the module's own
  generated `docs/schema.json` (0.3.0 is the release that first emitted one; until
  then a pair had to hand-write its DTOs from `dto.py`). No trailing slashes,
  pinned path-for-path against the generated manifest. The **409 `MoveResponse`**
  is unwrapped back into a value in `api/extensions.ts`: a denied move is the
  board's workflow answering, not a fault, and core's envelope parser would have
  turned the server's `reason_key` into a generic `stapel.http.409`.

  **The board reads `GET boards/{id}/cards`**, not a drained feed — columns in
  order, cards grouped by column and position-sorted, with `truncated` when the
  server's cap cut the answer short. One request, one sort authority.

  **model** — `board.ts` compares fractional `position` as a scaled **BigInt**, so
  two midpoints that differ past IEEE-754's precision keep their order instead of
  swapping on every refetch; `move.ts` is a pure four-ending reducer
  (applied / deferred / denied / failed) and `useBoard` keeps or rolls back the
  optimistic placement per ending, through an overlay keyed to the query payload it
  was computed from.

  **default skin** (`@stapel/tasks-react/default`) — `BoardsPane`,
  `BoardCreateSheet` (presets discovered from `GET boards/presets`), `KanbanBoard`
  (dnd-kit with pointer/**touch**/**keyboard** sensors, one column plus a
  drop-target switcher strip below the tablet breakpoint, WIP counters, a
  truncation banner, a status region for every move outcome), `TaskSheet`
  (save-on-blur per field, three-state checklist, comments where Enter sends), and
  `ColumnManager` — which reorders and adds, renders the duplicate key as the named
  `409 error.409.tasks_column_exists` refusal, and explains that rename and delete
  are not in this API rather than drawing two controls that cannot work.

  **nav** — `tasks.boards` (`/tasks`) and `tasks.board` (`/tasks/:boardId`).
  **i18n** — 119 pair keys in en/ru/es, plus the backend catalogue in all three.
  **Breaking (pre-1.0 = minor):** the scaffold's `TasksPanel` export is gone,
  replaced by the five skin surfaces above.

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
