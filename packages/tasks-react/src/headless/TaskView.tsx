/**
 * `<TaskView>` — the render-prop twin of {@link useTask}.
 *
 * Renders nothing of its own; hands the card bag (fields, comments, checklist,
 * and the `canEdit` gate that carries its own reason) to `children`. The skin
 * twin is `TaskSheet` in `@stapel/tasks-react/default`.
 */
import type { ReactElement, ReactNode } from "react";
import { useTask } from "./useTask.js";
import type { TaskBag } from "./useTask.js";

export interface TaskViewProps {
  readonly taskId: string | undefined;
  readonly children: (bag: TaskBag) => ReactNode;
}

export function TaskView(props: TaskViewProps): ReactElement {
  const bag = useTask(props.taskId);
  return <>{props.children(bag)}</>;
}
