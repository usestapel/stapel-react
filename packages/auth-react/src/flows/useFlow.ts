import { useSyncExternalStore } from "react";
import type { FlowMachine, FlowStateBase } from "./createFlowMachine.js";

/**
 * React binding for a {@link FlowMachine}: subscribes to transitions and
 * returns the current state. Because the machine stores immutable state
 * snapshots, `getState` is a stable reference read — no tearing under
 * concurrent React.
 */
export function useFlow<S extends FlowStateBase>(machine: FlowMachine<S>): S {
  return useSyncExternalStore(
    machine.subscribe,
    machine.getState,
    machine.getState
  );
}
