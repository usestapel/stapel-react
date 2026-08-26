import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { tasksErrorBundleEn } from "./generated/errors.gen.js";

/**
 * tasks-react's own translation KEYS (frontend-standard §4.2): neither the
 * headless layer nor the skin renders a literal string — hosts resolve these
 * through core's i18n engine (`useT`). Backend error codes flow through the
 * SAME contour: a `StapelApiError.code` is already a key, so the bundle below
 * spreads the generated English catalogue first and every `error.*` a host can
 * receive has a sentence.
 *
 * ── Two families of key that are not this pair's copy ──────────────────────
 *
 * `tasks.column.*` are the `name_key`s the backend's "simple" preset stamps on
 * the columns it creates, and `tasks.category.*` are the five fixed column
 * categories. A column carries its own `name` too; the skin prefers `name_key`
 * when the board set one, so a translated deployment shows the reader's own
 * language rather than the English the board was created with.
 */
export const TASKS_I18N_KEYS = {
  unknownError: "tasks.error.unknown",

  // nav
  navBoards: "tasks.nav.boards",
  navBoard: "tasks.nav.board",

  // boards list
  boardsTitle: "tasks.boards.title",
  boardsEmpty: "tasks.boards.empty",
  boardsEmptyHint: "tasks.boards.emptyHint",
  boardsCreate: "tasks.boards.create",
  boardsOpen: "tasks.boards.open",
  boardsArchive: "tasks.boards.archive",
  boardsArchiveQuestion: "tasks.boards.archiveQuestion",
  boardsArchiveBody: "tasks.boards.archiveBody",
  boardsColumnCount: "tasks.boards.columnCount",
  boardsCreated: "tasks.boards.created",
  boardsLoading: "tasks.boards.loading",
  boardsFailed: "tasks.boards.failed",

  // board creation
  createTitle: "tasks.board.create.title",
  createName: "tasks.board.create.name",
  createNamePlaceholder: "tasks.board.create.namePlaceholder",
  createPreset: "tasks.board.create.preset",
  createPresetCustom: "tasks.board.create.presetCustom",
  createColumns: "tasks.board.create.columns",
  createAddColumn: "tasks.board.create.addColumn",
  createColumnKey: "tasks.board.create.columnKey",
  createColumnName: "tasks.board.create.columnName",
  createCategory: "tasks.board.create.category",
  createWipLimit: "tasks.board.create.wipLimit",
  createSubmit: "tasks.board.create.submit",
  createRemoveColumn: "tasks.board.create.removeColumn",

  // the preset's own column name keys
  columnTodo: "tasks.column.todo",
  columnInProgress: "tasks.column.in_progress",
  columnDone: "tasks.column.done",

  // the fixed column categories
  categoryBacklog: "tasks.category.backlog",
  categoryActive: "tasks.category.active",
  categoryReview: "tasks.category.review",
  categoryWaiting: "tasks.category.waiting",
  categoryDone: "tasks.category.done",

  // the board screen
  boardTruncated: "tasks.board.truncated",
  boardEmptyColumn: "tasks.board.emptyColumn",
  boardEmpty: "tasks.board.empty",
  boardNoBoard: "tasks.board.noBoard",
  boardNoBoardHint: "tasks.board.noBoardHint",
  boardAddCard: "tasks.board.addCard",
  boardAddCardPlaceholder: "tasks.board.addCardPlaceholder",
  boardAddCardSubmit: "tasks.board.addCardSubmit",
  boardWip: "tasks.board.wip",
  boardWipExceeded: "tasks.board.wipExceeded",
  boardColumnSwitcher: "tasks.board.phone.columnSwitcher",
  boardManageColumns: "tasks.board.manageColumns",

  // filters
  filtersTitle: "tasks.board.filters.title",
  filtersAssignee: "tasks.board.filters.assignee",
  filtersCategory: "tasks.board.filters.category",
  filtersText: "tasks.board.filters.text",
  filtersClear: "tasks.board.filters.clear",
  filtersAny: "tasks.board.filters.any",

  // cards
  cardDragHandle: "tasks.card.dragHandle",
  cardDue: "tasks.card.due",
  cardOverdue: "tasks.card.overdue",
  cardChecklist: "tasks.card.checklist",
  cardBlocked: "tasks.card.blocked",
  cardOpen: "tasks.card.open",

  // moves
  moveApplied: "tasks.move.applied",
  moveDeferred: "tasks.move.deferred",
  moveDenied: "tasks.move.denied",
  moveFailed: "tasks.move.failed",
  movePendingBadge: "tasks.move.pendingBadge",

  // the task sheet
  taskTitle: "tasks.task.title",
  taskDescription: "tasks.task.description",
  taskDescriptionPlaceholder: "tasks.task.descriptionPlaceholder",
  taskColumn: "tasks.task.column",
  taskPriority: "tasks.task.priority",
  taskPriorityNone: "tasks.task.priorityNone",
  taskDue: "tasks.task.due",
  taskAssignees: "tasks.task.assignees",
  taskAssigneesReadOnly: "tasks.task.assigneesReadOnly",
  taskAssigneesEmpty: "tasks.task.assigneesEmpty",
  taskFeatures: "tasks.task.features",
  taskChecklist: "tasks.task.checklist",
  taskComments: "tasks.task.comments",
  taskCreated: "tasks.task.created",
  taskCompleted: "tasks.task.completed",
  taskArchived: "tasks.task.archived",
  taskArchive: "tasks.task.archive",
  taskArchiveQuestion: "tasks.task.archiveQuestion",
  taskSave: "tasks.task.save",
  taskSaving: "tasks.task.saving",
  taskLoading: "tasks.task.loading",

  // priorities (the fallback scale — see model/runtime.ts)
  priorityLow: "tasks.priority.low",
  priorityNormal: "tasks.priority.normal",
  priorityHigh: "tasks.priority.high",
  priorityUrgent: "tasks.priority.urgent",

  // checklist
  checklistAdd: "tasks.checklist.add",
  checklistPlaceholder: "tasks.checklist.placeholder",
  checklistEmpty: "tasks.checklist.empty",
  checklistMarkDone: "tasks.checklist.markDone",
  checklistMarkPending: "tasks.checklist.markPending",
  checklistMarkFailed: "tasks.checklist.markFailed",
  checklistStateFailed: "tasks.checklist.stateFailed",
  checklistMore: "tasks.checklist.more",

  // comments
  commentPlaceholder: "tasks.comment.placeholder",
  commentSend: "tasks.comment.send",
  commentEmpty: "tasks.comment.empty",
  commentHint: "tasks.comment.hint",

  // column management
  columnsTitle: "tasks.columns.title",
  columnsReorderHint: "tasks.columns.reorderHint",
  columnsNoRename: "tasks.columns.noRename",
  columnsDragHandle: "tasks.columns.dragHandle",
  columnsSaveOrder: "tasks.columns.saveOrder",
  columnsExistsHint: "tasks.columns.existsHint",

  // refusals a control states beside itself
  gateTitleRequired: "tasks.gate.titleRequired",
  gateColumnsRequired: "tasks.gate.columnsRequired",
  gateNameRequired: "tasks.gate.nameRequired",
  gateArchived: "tasks.gate.archived",
  gateNoPicker: "tasks.gate.noPicker",
  gateCommentEmpty: "tasks.gate.commentEmpty",
  gateNoColumn: "tasks.gate.noColumn",
  gateNoColumnChange: "tasks.gate.noColumnChange",
  gateNoNavigation: "tasks.gate.noNavigation",

  // deployment-level refusal
  scopeUnresolved: "tasks.scope.unresolved",

  dialogDismiss: "tasks.dialog.dismiss",
} as const;

export type TasksI18nKey =
  (typeof TASKS_I18N_KEYS)[keyof typeof TASKS_I18N_KEYS];

/**
 * English fallback bundle for tasks-react UI keys + backend error codes.
 * The generated `tasksErrorBundleEn` (from stapel-tasks's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key.
 */
export const tasksI18nBundleEn: I18nDictionary = {
  ...tasksErrorBundleEn,

  "tasks.error.unknown": "Something went wrong. Please try again.",

  "tasks.nav.boards": "Boards",
  "tasks.nav.board": "Board",

  "tasks.boards.title": "Boards",
  "tasks.boards.empty": "No boards yet",
  "tasks.boards.emptyHint": "A board holds the columns your cards move through.",
  "tasks.boards.create": "New board",
  "tasks.boards.open": "Open board",
  "tasks.boards.archive": "Archive",
  "tasks.boards.archiveQuestion": "Archive this board?",
  "tasks.boards.archiveBody":
    "The board and its cards are kept, but the board leaves this list.",
  "tasks.boards.columnCount": "{count} columns",
  "tasks.boards.created": "Created {date}",
  "tasks.boards.loading": "Loading boards…",
  "tasks.boards.failed": "The boards could not be loaded.",

  "tasks.board.create.title": "New board",
  "tasks.board.create.name": "Name",
  "tasks.board.create.namePlaceholder": "Release 2.0",
  "tasks.board.create.preset": "Shape",
  "tasks.board.create.presetCustom": "Custom columns",
  "tasks.board.create.columns": "Columns",
  "tasks.board.create.addColumn": "Add column",
  "tasks.board.create.columnKey": "Key",
  "tasks.board.create.columnName": "Column name",
  "tasks.board.create.category": "Category",
  "tasks.board.create.wipLimit": "WIP limit",
  "tasks.board.create.submit": "Create board",
  "tasks.board.create.removeColumn": "Remove column {name}",

  "tasks.column.todo": "To do",
  "tasks.column.in_progress": "In progress",
  "tasks.column.done": "Done",

  "tasks.category.backlog": "Backlog",
  "tasks.category.active": "Active",
  "tasks.category.review": "Review",
  "tasks.category.waiting": "Waiting",
  "tasks.category.done": "Done",

  "tasks.board.truncated":
    "Showing the newest {count} cards. Filter to see the rest.",
  "tasks.board.emptyColumn": "Nothing here",
  "tasks.board.empty": "This board has no columns yet.",
  "tasks.board.noBoard": "No board selected",
  "tasks.board.noBoardHint": "Open a board from the boards list.",
  "tasks.board.addCard": "Add card",
  "tasks.board.addCardPlaceholder": "Card title",
  "tasks.board.addCardSubmit": "Add",
  "tasks.board.wip": "{count}/{limit}",
  "tasks.board.wipExceeded": "Over the WIP limit of {limit}",
  "tasks.board.phone.columnSwitcher": "Column",
  "tasks.board.manageColumns": "Manage columns",

  "tasks.board.filters.title": "Filters",
  "tasks.board.filters.assignee": "Assignee",
  "tasks.board.filters.category": "Category",
  "tasks.board.filters.text": "Find in titles",
  "tasks.board.filters.clear": "Clear filters",
  "tasks.board.filters.any": "Any",

  "tasks.card.dragHandle": "Drag {title}",
  "tasks.card.due": "Due {date}",
  "tasks.card.overdue": "Overdue since {date}",
  "tasks.card.checklist": "{done} of {total} steps",
  "tasks.card.blocked": "Blocked by {count} cards",
  "tasks.card.open": "Open {title}",

  "tasks.move.applied": "Moved to {column}.",
  "tasks.move.deferred": "Moved, and waiting for approval.",
  "tasks.move.denied": "This board does not allow that move.",
  "tasks.move.failed": "The move could not be saved. The card is back where it was.",
  "tasks.move.pendingBadge": "Pending approval",

  "tasks.task.title": "Title",
  "tasks.task.description": "Description",
  "tasks.task.descriptionPlaceholder": "What has to happen?",
  "tasks.task.column": "Column",
  "tasks.task.priority": "Priority",
  "tasks.task.priorityNone": "None",
  "tasks.task.due": "Due date",
  "tasks.task.assignees": "Assignees",
  "tasks.task.assigneesReadOnly":
    "This app has not wired a people picker, so assignees can be read but not changed here.",
  "tasks.task.assigneesEmpty": "Nobody yet",
  "tasks.task.features": "Custom fields",
  "tasks.task.checklist": "Checklist",
  "tasks.task.comments": "Comments",
  "tasks.task.created": "Created {date}",
  "tasks.task.completed": "Completed {date}",
  "tasks.task.archived": "This card is archived and can only be read.",
  "tasks.task.archive": "Archive card",
  "tasks.task.archiveQuestion": "Archive this card?",
  "tasks.task.save": "Save",
  "tasks.task.saving": "Saving…",
  "tasks.task.loading": "Loading card…",

  "tasks.priority.low": "Low",
  "tasks.priority.normal": "Normal",
  "tasks.priority.high": "High",
  "tasks.priority.urgent": "Urgent",

  "tasks.checklist.add": "Add step",
  "tasks.checklist.placeholder": "Next step",
  "tasks.checklist.empty": "No steps yet",
  "tasks.checklist.markDone": "Mark {text} done",
  "tasks.checklist.markPending": "Mark {text} not done",
  "tasks.checklist.markFailed": "Mark {text} failed",
  "tasks.checklist.stateFailed": "Failed",
  "tasks.checklist.more": "More actions for {text}",

  "tasks.comment.placeholder": "Write a comment",
  "tasks.comment.send": "Send",
  "tasks.comment.empty": "No comments yet",
  "tasks.comment.hint": "Enter sends, Shift+Enter starts a new line.",

  "tasks.columns.title": "Columns",
  "tasks.columns.reorderHint": "Drag a column to change where it sits on the board.",
  "tasks.columns.noRename":
    "Renaming and deleting a column are not part of this API yet, so this screen does not offer them.",
  "tasks.columns.dragHandle": "Reorder {name}",
  "tasks.columns.saveOrder": "Save order",
  "tasks.columns.existsHint": "Pick a key this board does not already use.",

  "tasks.gate.titleRequired": "Give the card a title first.",
  "tasks.gate.columnsRequired": "A board needs at least one column.",
  "tasks.gate.nameRequired": "Give the board a name first.",
  "tasks.gate.archived": "This card is archived.",
  "tasks.gate.noPicker": "This app has not wired a people picker.",
  "tasks.gate.commentEmpty": "Write something first.",
  "tasks.gate.noColumn": "This board has no columns to add a card to.",
  "tasks.gate.noColumnChange":
    "Open this card from its board to move it to another column.",
  "tasks.gate.noNavigation":
    "This app has not wired board navigation, so this button has nowhere to go.",

  "tasks.scope.unresolved":
    "This deployment could not work out which workspace the board belongs to. Pick a workspace and try again.",

  "tasks.dialog.dismiss": "Close",
};

/**
 * Register tasks-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerTasksI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, tasksI18nBundleEn);
}
