import type { StapelClient } from "@stapel/core";

/**
 * The pair's typed operation surface. Today a thin holder over the injected
 * {@link StapelClient}; the named, typed operations (`tasks.<op>()`) will
 * be GENERATED from schema.json operationIds by gen-api v2 (task
 * `core-typed-ops`). Until then add hand-authored operations here and put
 * anything that can never be derived from the schema in `api/extensions.ts`,
 * each flagged with WHY the codegen does not cover it.
 */
export interface TasksApi {
  readonly client: StapelClient;
}

export function createTasksApi(client: StapelClient): TasksApi {
  return { client };
}
