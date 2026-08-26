/**
 * `@stapel/tasks-react` — the headless React flow pair for stapel-tasks
 * (frontend-standard §2). Business + state only, zero visual opinion; the
 * shipped AntD board lives behind the `./default` subpath so a host that brings
 * its own design system never pulls antd or dnd-kit into its bundle.
 *
 * Layers: api → model → flows → headless → i18n. Generated surfaces (the
 * OpenAPI schema, the flow registry, the error map, the manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers from stapel-tasks's OWN contract
 * triad and stand under drift gates — nothing here is hand-typed from `dto.py`.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createTasksApi } from "./api/tasksApi.js";
export type {
  TasksApi,
  RequestExtras,
  BoardCardsFilters,
  TaskFeedParams,
} from "./api/tasksApi.js";
export { isMoveResponseBody, deniedMove } from "./api/extensions.js";
export {
  COLUMN_CATEGORIES,
  CHECKLIST_STATES,
  MOVE_RESULTS,
  isColumnCategory,
  isChecklistState,
  isMoveResult,
} from "./api/enums.js";
export type {
  ColumnCategory,
  ChecklistState,
  MoveResult,
} from "./api/enums.js";
export type {
  Schemas,
  ArchivedResponse,
  Board,
  BoardCards,
  BoardCreateBody,
  BoardCreateColumnSpec,
  BoardPreset,
  BoardUpdateBody,
  BoardVocabulary,
  ChecklistItem,
  ChecklistItemCreateBody,
  ChecklistItemStateBody,
  Column,
  ColumnCreateBody,
  ColumnReorderBody,
  Comment,
  CommentCreateBody,
  MoveResponse,
  PresetColumn,
  PriorityLevel,
  Task,
  TaskAssignBody,
  TaskCreateBody,
  TaskMoveBody,
  TaskPage,
  TaskUpdateBody,
  VocabularyTerm,
} from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { TASKS_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  TasksFlowId,
  TasksFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, board assembly, the move machine) ─────
export { createTasksRuntime, DEFAULT_PRIORITY_SCALE } from "./model/runtime.js";
export type {
  TasksRuntime,
  CreateTasksRuntimeOptions,
  PriorityStep,
  UserPickerSeam,
} from "./model/runtime.js";
export {
  TasksRuntimeContext,
  useTasksRuntime,
  useTasksApi,
  useTasksAnalytics,
} from "./model/context.js";
export { tasksQueryKeys, filtersKey } from "./model/queryKeys.js";
export {
  assembleBoard,
  orderedColumns,
  applyMove,
  filterByText,
  compareCards,
  scaledPosition,
  cardCount,
  columnOf,
  findCard,
  checklistProgress,
} from "./model/board.js";
export type { BoardMap } from "./model/board.js";
export {
  moveReducer,
  initialMoveState,
  keepsOptimisticPlacement,
  outcomeOf,
} from "./model/move.js";
export type { MoveState, MoveStep, MoveEvent, MoveOutcome } from "./model/move.js";
export { isOverdue, shortId, idInitials } from "./model/format.js";
export {
  useBoardsQuery,
  useVocabularyQuery,
  useBoardQuery,
  useBoardCardsQuery,
  useTaskQuery,
  useCommentsQuery,
  useChecklistQuery,
} from "./model/queries.js";

// ── analytics vocabulary (emitted through the host's Analytics seam) ─────────
export { TASKS_EVENTS } from "./analytics/events.js";
export type { TasksEventName } from "./analytics/events.js";

// ── headless (hooks + renderless components) ─────────────────────────────────
export { TasksProvider } from "./headless/TasksProvider.js";
export { useBoards } from "./headless/useBoards.js";
export type { BoardsBag } from "./headless/useBoards.js";
export { useBoard } from "./headless/useBoard.js";
export type { BoardBag, BoardFilters } from "./headless/useBoard.js";
export { useTask } from "./headless/useTask.js";
export type { TaskBag, EditableField } from "./headless/useTask.js";
export { useCreateTask } from "./headless/useCreateTask.js";
export type { CreateTaskBag } from "./headless/useCreateTask.js";
export { BoardView } from "./headless/BoardView.js";
export type { BoardViewProps } from "./headless/BoardView.js";
export { TaskView } from "./headless/TaskView.js";
export type { TaskViewProps } from "./headless/TaskView.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  TASKS_I18N_KEYS,
  tasksI18nBundleEn,
  registerTasksI18n,
} from "./i18n/keys.js";
export type { TasksI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  TASKS_ERRORS,
  TASKS_ERROR_CODES,
  tasksErrorBundleEn,
  explainTasksError,
} from "./i18n/errorsMap.js";
export type {
  TasksErrorCode,
  TasksErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";

// ── nav ──────────────────────────────────────────────────────────────────────
export { navEntries } from "./nav/manifest.js";
