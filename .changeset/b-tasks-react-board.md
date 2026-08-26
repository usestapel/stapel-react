---
"@stapel/tasks-react": minor
---

First real release: the kanban board, headless and skinned.

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
