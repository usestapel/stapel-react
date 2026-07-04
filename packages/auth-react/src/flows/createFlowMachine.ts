import { trackFlowStep } from "@stapel/core";
import type { Analytics } from "@stapel/core";

/**
 * The shared flow-machine primitive — the FIRST INSTANCE of the pattern every
 * later `@stapel/<module>-react` pair copies (frontend-standard §2, "flows/").
 *
 * A flow is a tiny state container whose state is a discriminated union keyed
 * by a `step` string. Three things earn this primitive its keep across every
 * auth journey:
 *
 *  1. **Typed transitions** — `to(next)` replaces state and notifies React via
 *     `useSyncExternalStore` (see `useFlow`).
 *  2. **Human-wait vs async steps** — a step with no pending work is just a
 *     resting state the machine waits in for user input (`to`). Async steps go
 *     through `run`, which parks the machine in a `pending` step, awaits the
 *     task, then transitions to a success/failure step. `run` never throws:
 *     rejections are folded into a state, so hosts render errors instead of
 *     catching them.
 *  3. **Auto-instrumentation** — every transition emits
 *     `flow.<id>.<step>` (`started`), and every `run` emits `completed` /
 *     `failed` for its pending step (analytics-standard §1.2). Funnels exist
 *     without hand-written tracking.
 */
export interface FlowStateBase {
  readonly step: string;
}

export interface FlowMachine<S extends FlowStateBase> {
  /** Analytics flow id — the `<id>` in `flow.<id>.<step>`. */
  readonly id: string;
  getState(): S;
  subscribe(listener: () => void): () => void;
  /** Transition to a resting/human-wait state; emits `<step>` started. */
  to(next: S): void;
  /**
   * Run an async step. Parks in `pending` immediately, awaits `task`, then
   * transitions via `resolve`/`reject`. Emits `completed`/`failed` for the
   * pending step. Resolves once the terminal transition is applied — it does
   * not reject.
   */
  run<T>(
    pending: S,
    task: () => Promise<T>,
    handlers: {
      readonly resolve: (result: T) => S;
      readonly reject: (error: unknown) => S;
    }
  ): Promise<void>;
}

export interface FlowMachineOptions<S extends FlowStateBase> {
  /** Analytics flow id (e.g. `"auth.otp"`). */
  readonly id: string;
  readonly initial: S;
  /** Facade for auto-instrumentation. Omit to disable tracking. */
  readonly analytics?: Analytics | null;
}

export function createFlowMachine<S extends FlowStateBase>(
  options: FlowMachineOptions<S>
): FlowMachine<S> {
  const { id, analytics } = options;
  let state = options.initial;
  const listeners = new Set<() => void>();

  function emit(step: string, phase: "started" | "completed" | "failed"): void {
    if (analytics) trackFlowStep(analytics, id, step, phase);
  }

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function to(next: S): void {
    state = next;
    emit(next.step, "started");
    notify();
  }

  async function run<T>(
    pending: S,
    task: () => Promise<T>,
    handlers: {
      readonly resolve: (result: T) => S;
      readonly reject: (error: unknown) => S;
    }
  ): Promise<void> {
    to(pending);
    try {
      const result = await task();
      emit(pending.step, "completed");
      to(handlers.resolve(result));
    } catch (error) {
      emit(pending.step, "failed");
      to(handlers.reject(error));
    }
  }

  return {
    id,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    to,
    run,
  };
}
