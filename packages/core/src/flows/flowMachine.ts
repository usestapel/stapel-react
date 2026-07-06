import { trackFlowStep } from "../analytics/flow.js";
import type { Analytics } from "../analytics/types.js";

/**
 * The shared flow-machine primitive (frontend-standard §2, "flows/"). Lives in
 * `@stapel/core` so every `@stapel/<module>-react` pair imports ONE reviewed
 * implementation instead of copying it — a copied primitive would fork the
 * staleness/re-entrancy fixes into every pair (frontend-core-architecture §4b).
 *
 * A flow is a tiny state container whose state is a discriminated union keyed
 * by a `step` string. Three things earn this primitive its keep across every
 * journey:
 *
 *  1. **Typed transitions** — `to(next)` replaces state and notifies React via
 *     `useSyncExternalStore` (see `useFlow`).
 *  2. **Human-wait vs async steps** — a step with no pending work is just a
 *     resting state the machine waits in for user input (`to`). Async steps go
 *     through `run`, which parks the machine in a `pending` step, awaits the
 *     task, then transitions to a success/failure step. `run` never throws:
 *     rejections are folded into a state, so hosts render errors instead of
 *     catching them. `run` is also **staleness-guarded**: if a newer `to`
 *     happens while the task is in flight (double-submit, cancel, navigate,
 *     challenge expiry), the late result is dropped — it never clobbers the
 *     newer state nor runs its resolve/reject side effects.
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
   * pending step. Resolves once the terminal transition is applied — a task
   * rejection never rejects `run` (it is folded into the `reject` state); only
   * a throwing `resolve`/`reject` mapper (a programming error) propagates.
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

  // Monotonic transition counter — the staleness epoch. Every transition bumps
  // it; a `run` captures the epoch OF its own pending transition and only
  // applies its terminal transition if no newer transition happened while the
  // task was in flight.
  let generation = 0;

  // Apply a transition and return its epoch. The epoch is captured BEFORE
  // listeners are notified (R2): a subscriber that re-entrantly calls `to()`
  // from the notification advances the generation past the returned epoch, so
  // a `run` whose pending state was displaced synchronously is correctly seen
  // as stale. Capturing `generation` after `to(pending)` returned (the old
  // shape) read the LISTENER's epoch instead and let the late result clobber
  // the re-entrant transition.
  function transition(next: S): number {
    state = next;
    generation += 1;
    const epoch = generation;
    emit(next.step, "started");
    notify();
    return epoch;
  }

  function to(next: S): void {
    transition(next);
  }

  async function run<T>(
    pending: S,
    task: () => Promise<T>,
    handlers: {
      readonly resolve: (result: T) => S;
      readonly reject: (error: unknown) => S;
    }
  ): Promise<void> {
    // Epoch of THIS run's pending transition. If it advances before the task
    // settles (double-submit, cancel, navigate, expiry), the late result is
    // stale and must NOT clobber the newer state — nor run its resolve/reject
    // side effects. Analytics still fires so funnels stay honest.
    const epoch = transition(pending);
    // Fold the task's settlement into data BEFORE touching the machine, so a
    // throwing `resolve` mapper (a host programming error) is never mistaken
    // for a task failure. The old try/catch-around-everything shape both
    // double-emitted `completed`+`failed` AND applied a reject state built
    // from the mapper's own exception; now a mapper/listener throw propagates
    // loudly out of `run` instead of corrupting the machine.
    let settled:
      | { readonly ok: true; readonly result: T }
      | { readonly ok: false; readonly error: unknown };
    try {
      settled = { ok: true, result: await task() };
    } catch (error) {
      settled = { ok: false, error };
    }
    emit(pending.step, settled.ok ? "completed" : "failed");
    if (generation !== epoch) return; // stale — a newer transition won
    to(settled.ok ? handlers.resolve(settled.result) : handlers.reject(settled.error));
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
