# @stapel/tasks-react — module guide

React pair for **stapel-tasks**: boards, columns, cards, comments and checklists,
headless, plus the AntD kanban board a host actually ships. The human companion
to the generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## Layers

- **api/** — `createTasksApi(client)` with all 22 operations of the contract.
  Types are aliases over the package-LOCAL generated
  `components["schemas"]` (`src/api/generated/schema.ts`, produced by
  `pnpm gen:api` from stapel-tasks's own `docs/schema.json`); nothing here is a
  hand-written body. `api/extensions.ts` holds the one thing codegen cannot
  express — unwrapping the **409 `MoveResponse`**, which is a refusal answered as
  a DTO rather than as the error envelope.
- **model/** — `tasksQueryKeys` (one factory, `["tasks"]` namespace),
  `createTasksRuntime` (plus the `userLabel` / `userPicker` / `priorityScale`
  host seams), `board.ts` (assembly, the BigInt position order, `applyMove`),
  `move.ts` (the move state machine as a pure reducer), `queries.ts` (one hook
  per read and per write), `format.ts` (overdue, opaque-id initials — dates go through core's `useFormat()`).
- **flows/** — `toFlowError` plus `TASKS_FLOWS`, re-exported from the GENERATED
  registry: stapel-tasks 0.3.0 annotates three flows (`tasks.board_setup`,
  `tasks.card_lifecycle`, `tasks.card_move`) and `pnpm gen:flows` emits them from
  the backend's own `docs/flows.json`.
- **headless/** — `useBoards`, `useBoard`, `useTask`, `useCreateTask` and their
  render-prop twins `<BoardView>` / `<TaskView>`; `<TasksProvider>` wires the
  runtime into context. shadcn-copyable (frontend-standard §7).
- **i18n/** — `TASKS_I18N_KEYS` + en/ru/es bundles; the generated backend error
  catalogue (en, ru, es — the backend ships `translations/errors.{ru,es}.json`)
  is merged in so every `error.*` code has a sentence in every locale.
- **default/** — the opt-in AntD skin (`@stapel/tasks-react/default`).
- **analytics/** — six event names emitted through the host's `Analytics` seam.

## The board read

The kanban screen makes ONE card request: `GET boards/{id}/cards`. It answers
board-shaped — columns in `order`, cards grouped by column key and sorted by
`position`, un-paginated, with `truncated` when the server's `BOARD_CARDS_MAX`
cap cut the answer short. The paginated `boards/{id}/tasks` is a `-created_at`
FEED and is kept on the api surface for hosts that want one, but the board does
not read it: draining N pages and re-sorting in the client is exactly what
backend 0.3.0 removed the need for.

## Moving a card

`POST tasks/{id}/move` has four endings and the pair keeps them four:

| ending | HTTP | what the board does |
|---|---|---|
| `applied` | 200 | keep the optimistic placement, refetch for the real `position` |
| `deferred` | 202 | keep it AND badge the card "pending approval" |
| `denied` | 409 | roll back; render `reason_key`'s own sentence |
| failed | — | roll back; render the transport failure |

The optimistic placement is an overlay keyed by the query payload it was computed
from, so a refetch expires it mechanically — there is no effect to run and
nothing to remember to clear. `model/move.ts` is a pure reducer; `test/moveFlow.test.tsx`
drives the whole table with and without React.

## Host seams

| seam | what fills it | unfilled |
|---|---|---|
| `userLabel(userId)` | a host's name for an opaque user id | the id's first two characters |
| `userPicker` | the host's member picker (workspaces, profiles…) | assignees are read-only, with the reason stated |
| `priorityScale` | a pinned ladder | the server's `PRIORITY_SCALE`, else low/normal/high/urgent |
| `renderFeatures` (TaskSheet) | `@stapel/attributes-react` editors | a named `SlotPlaceholder`, only when the board HAS `feature_defs` |
| `onOpenBoard` (BoardsPane) | the container's router | the Open control states that navigation is not wired |

## What the API does not have, and what the skin does about it

- **No column rename, no column delete.** `ColumnManager` reorders and adds, and
  puts one sentence where the two missing controls would have been.
- **No card search.** The text filter runs in the client over titles and is
  labelled "find in titles", not "search".
- **No user directory.** See the seams above.
- **`wip_limit` is stored, not enforced.** The skin renders `N/limit` and marks
  the header when it is exceeded; it never blocks a drop the server would accept.

## Verification

`pnpm turbo run lint test build size --filter=@stapel/tasks-react` — 95 tests,
0 lint findings. `node scripts/gen-demos.mjs --strict` covers all five skin
components with a phone variant each.
