/**
 * The pair's analytics vocabulary.
 *
 * Six events, all of them DECISIONS: creating a board, creating a card, moving
 * one (with the outcome, because a board whose moves are mostly `denied` has a
 * workflow problem nobody would otherwise see), assigning, commenting, and
 * ticking a checklist step. Opening a sheet and typing in a filter are not
 * here — they happen constantly and report nothing about what anyone decided.
 *
 * The names are constants rather than `defineEvent` declarations because a pair
 * carries no `@stapel/analytics` runtime by architecture (slim wave §21/S1): it
 * emits through the `Analytics` SEAM the host injects. A host that wants the
 * typed registry entry re-declares these names with `defineEvent` on its side.
 */
export const TASKS_EVENTS = {
  /** A board was created. Prop: `preset`. */
  boardCreated: "tasks.board.created",
  /** A card was created. */
  taskCreated: "tasks.task.created",
  /** A move settled. Prop: `outcome` (applied/deferred/denied/failed). */
  taskMoved: "tasks.task.moved",
  /** The assignee set was replaced. Prop: `count`. */
  taskAssigned: "tasks.task.assigned",
  /** A comment was posted. */
  commentAdded: "tasks.comment.added",
  /** A checklist step changed state. Prop: `state`. */
  checklistStateChanged: "tasks.checklist.stateChanged",
} as const;

export type TasksEventName = (typeof TASKS_EVENTS)[keyof typeof TASKS_EVENTS];
