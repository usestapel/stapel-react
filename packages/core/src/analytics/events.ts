/**
 * Typed analytics EVENT TYPES (frontend-guardrails §3.1) — the type half of
 * `defineEvent`. The declaration runtime (`defineEvent`, the `prop` builders)
 * and the facade implementation live in `@stapel/analytics`; the TYPES stay
 * here because the {@link import("./types.js").Analytics} seam's typed
 * `track(event, props)` overload is expressed in terms of them, and the seam
 * is what every `@stapel/<module>-react` pair threads through context
 * (slim-wave §21/S1 — impl depends on core, never the reverse).
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

/** A prop schema: prop name → its {@link PropSpec}. */
export type PropsSchema = Record<string, PropSpec<unknown>>;

/** Resolve a prop schema to the plain props object an emit must pass. */
export type ResolveProps<P extends PropsSchema> = {
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
