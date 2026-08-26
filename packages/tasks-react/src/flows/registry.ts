/**
 * The pair's flow registry — a re-export of the GENERATED one.
 *
 * stapel-tasks 0.3.0 annotates three flows (`tasks.board_setup`,
 * `tasks.card_lifecycle`, `tasks.card_move`) with `@flow_step` on the endpoints
 * they run through, so `pnpm gen:flows` emits `./generated/flows.gen.ts` from
 * the backend's own `docs/flows.json`. Binding the public names here (rather
 * than exporting the generated module directly) keeps the pair's surface stable
 * across a regeneration and gives the drift gate one file to compare.
 */
export { TASKS_FLOWS, flowEndpoints } from "./generated/flows.gen.js";
export type {
  TasksFlowId,
  TasksFlowSpec,
  FlowEndpoint,
} from "./generated/flows.gen.js";
