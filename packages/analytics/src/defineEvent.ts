/**
 * Typed analytics events (frontend-guardrails §3.1). An event is a LITERAL
 * object — a namespaced name, a prop schema in which every prop carries its
 * OWN docstring, and a description for the event itself — declared
 * feature-side next to the code that emits it. `events.json` is a STATIC
 * projection of these declarations (`gen:events`): the meta lives in exactly
 * one place, and the extractor / report / lint read it without running the
 * app. The literal-only shape is what makes that static extraction possible —
 * the `stapel/event-literal-meta` lint (G4) enforces it.
 *
 * The TYPES (`EventDef`, `PropSpec`, `EventProps`, …) live in `@stapel/core` —
 * the `Analytics` seam's typed `track(event, props)` overload is expressed in
 * terms of them (slim-wave §21/S1). This module owns the declaration RUNTIME.
 */

import type {
  EventDef,
  EventDefInput,
  PropSpec,
  PropsSchema,
  ResolveProps,
} from "@stapel/core";

/**
 * Prop-schema builders. Every builder REQUIRES a description (§3.1) — that is
 * the whole point of the typed layer over `track(name, props)`: the meta is
 * unskippable and travels with the definition.
 */
export const prop: {
  string(description: string): PropSpec<string>;
  number(description: string): PropSpec<number>;
  boolean(description: string): PropSpec<boolean>;
  oneOf<const T extends readonly string[]>(
    options: T,
    description: string
  ): PropSpec<T[number]>;
} = {
  string: (description) => ({ type: "string", description }),
  number: (description) => ({ type: "number", description }),
  boolean: (description) => ({ type: "boolean", description }),
  oneOf: (options, description) => ({ type: "string", description, options }),
};

/**
 * Declare a typed event. Returns a plain frozen-shape object (name/description/
 * props/flow) — the same object the static extractor projects into
 * `events.json`, so the runtime registry and the generated registry never
 * diverge.
 */
export function defineEvent<const Name extends string, P extends PropsSchema>(
  input: EventDefInput<Name, P>
): EventDef<Name, ResolveProps<P>> {
  return {
    name: input.name,
    description: input.description,
    props: input.props ?? {},
    ...(input.flow !== undefined ? { flow: input.flow } : {}),
  };
}
