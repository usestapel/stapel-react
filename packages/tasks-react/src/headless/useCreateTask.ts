/**
 * The inline card composer at the foot of a column.
 *
 * `submit` is an {@link ActionAvailability}: an empty title and a board with no
 * columns are two different reasons the button cannot do anything, and a grey
 * rectangle that means either of them is the defect
 * `stapel/no-boolean-disabled` exists to catch.
 */
import { useCallback, useState } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { TASKS_EVENTS } from "../analytics/events.js";
import type { Task } from "../api/types.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import { useTasksAnalytics } from "../model/context.js";
import { useCreateTaskMutation } from "../model/queries.js";

export interface CreateTaskBag {
  readonly title: string;
  readonly setTitle: (next: string) => void;
  readonly column: string | undefined;
  readonly setColumn: (next: string | undefined) => void;
  readonly submit: ActionAvailability;
  readonly run: () => Promise<Task | null>;
  readonly creating: boolean;
  readonly error: unknown;
  readonly reset: () => void;
}

export function useCreateTask(
  boardId: string | undefined,
  initialColumn?: string
): CreateTaskBag {
  const [title, setTitle] = useState("");
  const [column, setColumn] = useState<string | undefined>(initialColumn);
  const analytics = useTasksAnalytics();
  const mutation = useCreateTaskMutation(boardId ?? "");

  const submit = firstBlock(
    boardId === undefined || boardId === ""
      ? actionBlocked(TASKS_I18N_KEYS.boardNoBoard)
      : actionAvailable(),
    column === undefined || column === ""
      ? actionBlocked(TASKS_I18N_KEYS.gateNoColumn)
      : actionAvailable(),
    title.trim() === ""
      ? actionBlocked(TASKS_I18N_KEYS.gateTitleRequired)
      : actionAvailable()
  );

  const reset = useCallback(() => {
    setTitle("");
  }, []);

  const run = useCallback(async (): Promise<Task | null> => {
    if (!submit.available) return null;
    const created = await mutation.mutateAsync({
      title: title.trim(),
      ...(column !== undefined ? { column } : {}),
    });
    analytics?.track(TASKS_EVENTS.taskCreated);
    setTitle("");
    return created;
  }, [analytics, column, mutation, submit.available, title]);

  return {
    title,
    setTitle,
    column,
    setColumn,
    submit,
    run,
    creating: mutation.isPending,
    error: mutation.error,
    reset,
  };
}
