/**
 * One card, headless — what the task sheet is a rendering of.
 *
 * ── Editing is per FIELD, saved on blur ───────────────────────────────────
 *
 * `PATCH tasks/{id}` takes only the fields it is given, so a sheet does not
 * need a form-wide "save": each field saves itself when it loses focus, and
 * `saving`/`savedField` say which one is in flight. That also means a failure
 * is attributable — "the due date did not save" rather than "something did not
 * save".
 *
 * ── An archived card is READ-ONLY, and says so ────────────────────────────
 *
 * The backend keeps archived rows readable (`is_archived`, soft delete) and
 * accepts no writes against them. {@link TaskBag.canEdit} is the one place
 * that decides it, as an `ActionAvailability` carrying the reason, so every
 * control in the sheet is disabled WITH the same sentence beside it rather
 * than nine controls each greying out for reasons of their own.
 */
import { useCallback, useState } from "react";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  requireLoaded,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import { TASKS_EVENTS } from "../analytics/events.js";
import type { ChecklistState } from "../api/enums.js";
import type {
  ChecklistItem,
  Comment,
  Task,
  TaskUpdateBody,
} from "../api/types.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import { useTasksAnalytics } from "../model/context.js";
import {
  useAddChecklistItem,
  useAddComment,
  useArchiveTask,
  useAssign,
  useChecklistQuery,
  useCommentsQuery,
  useSetChecklistState,
  useTaskQuery,
  useUpdateTask,
} from "../model/queries.js";

/** The fields the sheet can edit one at a time. */
export type EditableField = keyof TaskUpdateBody;

export interface TaskBag {
  readonly task: LoadState<Task>;
  /** Blocked while loading, when the load failed, and when the card is
   * archived — each with its own stated reason. */
  readonly canEdit: ActionAvailability;
  readonly update: (body: TaskUpdateBody) => Promise<void>;
  /** Which field is being saved right now, `null` between saves. */
  readonly savingField: EditableField | null;
  readonly updateError: unknown;
  readonly archive: () => Promise<void>;
  readonly archiving: boolean;
  readonly archiveError: unknown;
  readonly assign: (ids: readonly string[]) => Promise<void>;
  readonly assigning: boolean;
  readonly assignError: unknown;
  readonly comments: LoadState<readonly Comment[]>;
  readonly addComment: (body: string) => Promise<void>;
  readonly addingComment: boolean;
  readonly commentError: unknown;
  readonly checklist: LoadState<readonly ChecklistItem[]>;
  readonly addItem: (text: string) => Promise<void>;
  readonly addingItem: boolean;
  readonly setItemState: (
    itemId: string,
    state: ChecklistState
  ) => Promise<void>;
  readonly checklistError: unknown;
  readonly refetch: () => void;
}

export function useTask(taskId: string | undefined): TaskBag {
  const id = taskId ?? "";
  const [savingField, setSavingField] = useState<EditableField | null>(null);
  const analytics = useTasksAnalytics();

  const taskQuery = useTaskQuery(taskId);
  const commentsQuery = useCommentsQuery(taskId);
  const checklistQuery = useChecklistQuery(taskId);
  const boardId = taskQuery.data?.board_id;

  const updateMutation = useUpdateTask(id, boardId);
  const archiveMutation = useArchiveTask(id, boardId);
  const assignMutation = useAssign(id, boardId);
  const commentMutation = useAddComment(id);
  const addItemMutation = useAddChecklistItem(id);
  const itemStateMutation = useSetChecklistState(id);

  const task = loadStateFromQuery(taskQuery);

  const canEdit = requireLoaded(task, (row) =>
    row.is_archived === true
      ? actionBlocked(TASKS_I18N_KEYS.gateArchived)
      : actionAvailable()
  );

  const update = useCallback(
    async (body: TaskUpdateBody): Promise<void> => {
      const field = Object.keys(body)[0] as EditableField | undefined;
      setSavingField(field ?? null);
      try {
        await updateMutation.mutateAsync(body);
      } finally {
        setSavingField(null);
      }
    },
    [updateMutation]
  );

  const archive = useCallback(async (): Promise<void> => {
    await archiveMutation.mutateAsync(undefined);
  }, [archiveMutation]);

  const assign = useCallback(
    async (ids: readonly string[]): Promise<void> => {
      await assignMutation.mutateAsync(ids);
      analytics?.track(TASKS_EVENTS.taskAssigned, { count: ids.length });
    },
    [analytics, assignMutation]
  );

  const addComment = useCallback(
    async (body: string): Promise<void> => {
      await commentMutation.mutateAsync(body);
      analytics?.track(TASKS_EVENTS.commentAdded);
    },
    [analytics, commentMutation]
  );

  const addItem = useCallback(
    async (text: string): Promise<void> => {
      await addItemMutation.mutateAsync(text);
    },
    [addItemMutation]
  );

  const setItemState = useCallback(
    async (itemId: string, state: ChecklistState): Promise<void> => {
      await itemStateMutation.mutateAsync({ itemId, state });
      analytics?.track(TASKS_EVENTS.checklistStateChanged, { state });
    },
    [analytics, itemStateMutation]
  );

  const refetch = useCallback(() => {
    void taskQuery.refetch();
    void commentsQuery.refetch();
    void checklistQuery.refetch();
  }, [checklistQuery, commentsQuery, taskQuery]);

  return {
    task,
    canEdit,
    update,
    savingField,
    updateError: updateMutation.error,
    archive,
    archiving: archiveMutation.isPending,
    archiveError: archiveMutation.error,
    assign,
    assigning: assignMutation.isPending,
    assignError: assignMutation.error,
    comments: loadStateFromQuery(commentsQuery),
    addComment,
    addingComment: commentMutation.isPending,
    commentError: commentMutation.error,
    checklist: loadStateFromQuery(checklistQuery),
    addItem,
    addingItem: addItemMutation.isPending,
    setItemState,
    checklistError: itemStateMutation.error ?? addItemMutation.error,
    refetch,
  };
}
