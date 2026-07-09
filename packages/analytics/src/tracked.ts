import type { Analytics, AnyEventDef, EventProps } from "@stapel/core";

/**
 * `tracked()` (frontend-guardrails §3.2): wrap a clickable's handler so the
 * click both EMITS its typed event and runs the original handler. The wrapper
 * name is the static marker the `stapel/clickable-needs-event` lint (G4) looks
 * for — `onClick={tracked(event, props, handler)}` satisfies outcome #1.
 *
 * Double-count exclusion (user decision, overriding open question §7): a click
 * that STEPS a flow machine is already instrumented — the machine emits
 * `flow.<id>.<step>` on every transition — so it must be marked
 * `data-analytics="flow"` and NOT wrapped here. Wrapping it would double-count.
 * G4 forbids that statically; the runtime backs it in dev: while the wrapped
 * handler runs, the facade watches for a `flow.*` emission on the SAME
 * instance and warns (a flow transition fires its `started` event
 * synchronously, before the handler's first await, so a sync scope catches
 * it). See {@link Analytics.__trackedScope}.
 */
export interface TrackedApi {
  /**
   * Emit `event` with `props`, then call `handler(...args)` and return its
   * result. `props` is typed by the event's schema — required props are
   * enforced, unknown props rejected.
   */
  tracked<E extends AnyEventDef, A extends unknown[], R>(
    event: E,
    props: EventProps<E>,
    handler?: (...args: A) => R
  ): (...args: A) => R | undefined;
  /**
   * Same as {@link tracked}, named for `onSubmit`. A distinct identity so the
   * lint recognises the form-submit outcome, and so intent reads clearly at
   * the call site.
   */
  trackedSubmit<E extends AnyEventDef, A extends unknown[], R>(
    event: E,
    props: EventProps<E>,
    handler?: (...args: A) => R
  ): (...args: A) => R | undefined;
}

function wrap(analytics: Analytics) {
  return function tracked<E extends AnyEventDef, A extends unknown[], R>(
    event: E,
    props: EventProps<E>,
    handler?: (...args: A) => R
  ): (...args: A) => R | undefined {
    return (...args: A): R | undefined => {
      analytics.track(event, props);
      // Dev-only: flag a flow.* emission that happens inside this handler as a
      // double count. No-op (undefined) in production.
      const close = analytics.__trackedScope?.(event.name);
      try {
        return handler ? handler(...args) : undefined;
      } finally {
        close?.();
      }
    };
  };
}

/**
 * Bind {@link TrackedApi} to a specific facade. Prefer {@link useTracked} in
 * components; use this directly outside React (tests, non-hook call sites).
 */
export function createTracked(analytics: Analytics): TrackedApi {
  const fn = wrap(analytics);
  return { tracked: fn, trackedSubmit: fn };
}
