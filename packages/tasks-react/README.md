# @stapel/tasks-react

React pair for **stapel-tasks**: boards, columns, cards, comments and checklists.
Headless business + state (frontend-standard §2), plus an opt-in AntD kanban
board behind the `/default` subpath — because a pair ships a FEATURE, not only a
bag of hooks (§54).

Built on `@stapel/core` (typed client + `StapelApiError` envelope, token refresh,
verification-403 interception, i18n engine, analytics seam, TanStack Query) and,
for the skin only, `@stapel/tokens-antd/skin` and `@dnd-kit`.

## Install

```
pnpm add @stapel/tasks-react @stapel/core @tanstack/react-query react
# for the shipped board:
pnpm add antd @stapel/tokens @stapel/tokens-antd
```

## Wire the app once

One `<StapelProvider>` for the whole app (core's config + query + i18n in a
single component — slim wave §21/S4), one `<TasksProvider>` for this pair:

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import {
  createTasksRuntime,
  TasksProvider,
  registerTasksI18n,
} from "@stapel/tasks-react";

const runtime = createTasksRuntime({
  baseUrl: "/tasks/api/v1/",
  // optional host seams — see "Seams" below
  userLabel: (id) => members.get(id)?.name ?? id.slice(0, 8),
});
const i18n = createI18n({ locale: "en" });
registerTasksI18n(i18n); // the pair's key bundle → core's engine

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.1.0">
      <TasksProvider runtime={runtime}>{children}</TasksProvider>
    </StapelProvider>
  );
}
```

Already wired a `<StapelProvider>` for another pair? Keep the ONE provider and
pass this runtime's client as a per-module override —
`clients={{ tasks: runtime.client }}` — then nest `<TasksProvider>` beside your
other pair providers.

Russian and Spanish are opt-in subpaths, so a host that ships one language never
carries the others:

```ts
import { registerTasksI18nRu } from "@stapel/tasks-react/i18n/ru";
registerTasksI18nRu(i18n);
```

## The shipped board

```tsx
import { BoardsPane, KanbanBoard } from "@stapel/tasks-react/default";

// /tasks
<BoardsPane onOpenBoard={(id) => navigate(`/tasks/${id}`)} />

// /tasks/:boardId — the route element passes the matched param
<KanbanBoard boardId={params.boardId} />
```

`BoardsPane` lists boards with a create sheet (presets discovered from
`GET boards/presets`) and an archive confirm that is a bottom sheet on a phone.
`KanbanBoard` draws the columns, drags with dnd-kit (pointer, **touch** and
**keyboard** sensors), moves optimistically and rolls back on a refusal, opens
`TaskSheet` for a card, and hosts `ColumnManager` for reordering. Below the
tablet breakpoint it renders ONE column with a switcher strip whose chips are
also drop targets — not five desktop columns squeezed into 390px.

Both surfaces are also nav entries (`tasks.boards`, `tasks.board`), so a
scaffolded container mounts them without wiring.

## Headless

```tsx
import { useBoard, BoardView } from "@stapel/tasks-react";

const bag = useBoard(boardId);          // board, columns, cards, filters, move…
<BoardView boardId={boardId}>{(bag) => /* your design system */}</BoardView>
```

`useBoards`, `useBoard`, `useTask`, `useCreateTask` and the render-prop twins
`<BoardView>` / `<TaskView>` render nothing at all. Loads arrive as `LoadState`
(loading / failed / ready are never collapsed) and blocked actions as
`ActionAvailability` (there is no way to spell "disabled, reason unknown").

## Seams

| seam | fills | unfilled |
|---|---|---|
| `userLabel(id)` | a name for an opaque user id | the id's first characters |
| `userPicker` | the host's member picker | assignees read-only, reason stated |
| `priorityScale` | a pinned ladder | the deployment's, else low→urgent |
| `renderFeatures` | `@stapel/attributes-react` editors | a named `SlotPlaceholder` |
| `onOpenBoard` | the container's router | the control states what is missing |

## Layers

```
src/
  api/        typed client over this pair's own generated `components`
  model/      query keys, runtime + seams, board assembly, the move machine
  flows/      toFlowError + the generated TASKS_FLOWS registry
  headless/   hooks + render-prop twins; <TasksProvider>
  i18n/       keys + en/ru/es bundles (backend error catalogue generated)
  default/    the AntD skin (opt-in subpath)
  nav/        the two nav entries
```

See `MODULE.md` for the move table, the seams in full, and what the backend does
not have yet.
