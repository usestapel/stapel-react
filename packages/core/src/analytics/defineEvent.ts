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
 * Compile-time contract (via {@link EventProps} + the typed `track`/`tracked`
 * overloads): props declared by the schema are REQUIRED, unknown props are a
 * type error, and `oneOf` narrows to its literal union — a name can't be
 * mistyped and a prop can't be invented.
 */

export type PropType = "string" | "number" | "boolean";

/**
 * A single prop's contract: its runtime type, a human description (REQUIRED —
 * the docstring is not decoration, it is the registry/report copy for this
 * prop), and, for `oneOf`, the closed set of allowed string literals.
 */
export interface PropSpec<T> {
  readonly type: PropType;
  readonly description: string;
  readonly options?: readonly string[];
  /** Phantom carrier for the value type — never present at runtime. */
  readonly __value?: T;
}

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

/** A prop schema: prop name → its {@link PropSpec}. */
export type PropsSchema = Record<string, PropSpec<unknown>>;

/** Resolve a prop schema to the plain props object an emit must pass. */
type ResolveProps<P extends PropsSchema> = {
  [K in keyof P]: P[K] extends PropSpec<infer T> ? T : never;
};

export interface EventDefInput<Name extends string, P extends PropsSchema> {
  /** Event name — a `namespace.object.action` literal (never runtime-built). */
  readonly name: Name;
  /** What the event means, in one line. */
  readonly description: string;
  /** The prop schema; omit for a no-prop event. */
  readonly props?: P;
  /**
   * Optional link to a backend flow id (flows.json). Purely descriptive — it
   * ties an app event to a funnel in the report; validated by the report
   * generator, absent on most events by design.
   */
  readonly flow?: string;
}

/**
 * A defined event. `props` is retained at runtime (the extractor also reads it
 * statically); `__props` is a phantom carrier for the RESOLVED props type used
 * by {@link EventProps}.
 */
export interface EventDef<
  Name extends string,
  Props extends Record<string, unknown>,
> {
  readonly name: Name;
  readonly description: string;
  readonly props: PropsSchema;
  readonly flow?: string;
  /** Phantom carrier for the resolved props type — never present at runtime. */
  readonly __props?: Props;
}

/** Any event definition, regardless of its name or prop shape. */
export type AnyEventDef = EventDef<string, Record<string, unknown>>;

/** The exact props object an emit of `E` must pass (missing/excess = error). */
export type EventProps<E> =
  E extends EventDef<string, infer P> ? P : Record<string, unknown>;

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
