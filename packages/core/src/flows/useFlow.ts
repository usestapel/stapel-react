import { useSyncExternalStore } from "react";
import type { FlowMachine, FlowStateBase } from "./flowMachine.js";

/**
 * React binding for a {@link FlowMachine}: subscribes to transitions and
 * returns the current state. Because the machine stores immutable state
 * snapshots, `getState` is a stable reference read — no tearing under
 * concurrent React.
 *
 * (Ships from `@stapel/core` today; it moves to the future `@stapel/react`
 * binding package when core is split framework-agnostic — see
 * frontend-core-architecture §3.1, task `core-react-split`.)
 */
export function useFlow<S extends FlowStateBase>(machine: FlowMachine<S>): S {
  return useSyncExternalStore(
    machine.subscribe,
    machine.getState,
    machine.getState
  );
}
