/**
 * `@stapel/tasks-react/default` — the pair's default AntD skin (§54: a pair
 * ships a FEATURE, not only a bag). A separate entry point, so a host that
 * brings its own visuals never pulls `antd`, `@dnd-kit` or the token bridge
 * into its bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { BoardsPane, KanbanBoard } from "@stapel/tasks-react/default";
 * // under the pair's <TasksProvider> + core's <I18nProvider>:
 * <BoardsPane onOpenBoard={(id) => navigate(`/tasks/${id}`)} />
 * <KanbanBoard boardId={params.boardId} />
 * ```
 *
 * `TaskCard` and `FiltersBar` are deliberately NOT here: they are parts of
 * `KanbanBoard`, not surfaces a host mounts, and every name in this barrel owes
 * the demo gate a story with a phone variant.
 */
export { BoardsPane } from "./BoardsPane.js";
export type { BoardsPaneProps } from "./BoardsPane.js";
export { BoardCreateSheet } from "./BoardCreateSheet.js";
export type { BoardCreateSheetProps } from "./BoardCreateSheet.js";
export { KanbanBoard } from "./KanbanBoard.js";
export type { KanbanBoardProps } from "./KanbanBoard.js";
export { TaskSheet } from "./TaskSheet.js";
export type { TaskSheetProps } from "./TaskSheet.js";
export { ColumnManager } from "./ColumnManager.js";
export type { ColumnManagerProps } from "./ColumnManager.js";
export {
  COLUMN_WIDTH,
  BOARD_MIN_HEIGHT,
  SHEET_WIDTH,
  CREATE_SHEET_WIDTH,
} from "./types.js";
export type { ThemeModeProp } from "./types.js";
