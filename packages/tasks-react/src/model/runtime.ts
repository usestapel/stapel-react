import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import type { ReactNode } from "react";
import { createTasksApi } from "../api/tasksApi.js";
import type { TasksApi } from "../api/tasksApi.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";

/**
 * One step of the priority scale a client offers.
 *
 * `Task.priority` is an unconstrained integer in the table — the backend has no
 * opinion about what 3 means. `GET boards/presets` serves the deployment's
 * configured scale, and {@link DEFAULT_PRIORITY_SCALE} is what the pair falls
 * back to when a host configured none (an empty `PRIORITY_SCALE` is legal).
 */
export interface PriorityStep {
  readonly value: number;
  readonly labelKey: string;
}

export const DEFAULT_PRIORITY_SCALE: readonly PriorityStep[] = [
  { value: 1, labelKey: TASKS_I18N_KEYS.priorityLow },
  { value: 2, labelKey: TASKS_I18N_KEYS.priorityNormal },
  { value: 3, labelKey: TASKS_I18N_KEYS.priorityHigh },
  { value: 4, labelKey: TASKS_I18N_KEYS.priorityUrgent },
];

/**
 * The host's people picker.
 *
 * Assignees are opaque user ids and stapel-tasks resolves none of them — there
 * is no user search in this module, by design. A tenant app knows its members
 * (`@stapel/workspaces-react`), a marketplace knows its profiles, and neither
 * belongs inside a board. So the picker is a SEAM: unfilled, the task sheet
 * shows the assignees it has as read-only chips and says why it cannot offer to
 * change them, instead of drawing a control that could never work.
 */
export interface UserPickerSeam {
  /**
   * Render a control that edits the assignee set. `onChange` replaces the set
   * (the endpoint is a full replace, not a delta).
   */
  render(props: {
    readonly value: readonly string[];
    readonly onChange: (next: readonly string[]) => void;
    readonly disabled: boolean;
  }): ReactNode;
}

export interface CreateTasksRuntimeOptions extends CreateModuleRuntimeOptions {
  /** Resolve an opaque user id to something a person recognises. Unset: the
   * skin renders the id's first segment (`model/format.ts`). */
  readonly userLabel?: (userId: string) => ReactNode;
  /** The host's member picker — see {@link UserPickerSeam}. */
  readonly userPicker?: UserPickerSeam;
  /** Override the priority scale without a round trip (tests, a host that
   * pins its own ladder). The served scale still wins when it is non-empty. */
  readonly priorityScale?: readonly PriorityStep[];
}

/**
 * The wired tasks runtime — core's `ModuleRuntime` bound to this pair's API
 * (slim wave §21/S2), plus the three host seams above. The returned `client` is
 * what the host injects into core's `StapelConfigProvider`; auth token/refresh
 * and the verification-403 seam are supplied by the host's auth runtime on the
 * shared client, and this pair does not re-implement them.
 */
export interface TasksRuntime extends ModuleRuntime<TasksApi> {
  readonly userLabel: ((userId: string) => ReactNode) | null;
  readonly userPicker: UserPickerSeam | null;
  readonly priorityScale: readonly PriorityStep[];
}

export function createTasksRuntime(
  options: CreateTasksRuntimeOptions
): TasksRuntime {
  const base = createModuleRuntime(createTasksApi, options);
  return {
    ...base,
    userLabel: options.userLabel ?? null,
    userPicker: options.userPicker ?? null,
    priorityScale: options.priorityScale ?? DEFAULT_PRIORITY_SCALE,
  };
}
