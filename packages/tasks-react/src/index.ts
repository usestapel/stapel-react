/**
 * `@stapel/tasks-react` — the headless React flow pair for stapel-tasks
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createTasksApi } from "./api/tasksApi.js";
export type { TasksApi } from "./api/tasksApi.js";
export type { Schemas } from "./api/types.js";

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

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createTasksRuntime } from "./model/runtime.js";
export type {
  TasksRuntime,
  CreateTasksRuntimeOptions,
} from "./model/runtime.js";
export {
  TasksRuntimeContext,
  useTasksRuntime,
  useTasksApi,
  useTasksAnalytics,
} from "./model/context.js";
export { tasksQueryKeys } from "./model/queryKeys.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { TasksProvider } from "./headless/TasksProvider.js";

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
