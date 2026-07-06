/**
 * `defineDemo` — the design-system showcase registration format
 * (frontend-guardrails §4.2). A demo is a LITERAL object: a namespaced id, the
 * headless component it documents, human copy, the tokens/flow it exercises,
 * and a map of named VARIANTS (each a `() => ReactNode` render closure). It is
 * the single source three projections read WITHOUT running a viewer:
 *
 *   - `manifest.demos` + llms.txt canonical snippets (gen:manifest) — F8: a
 *     pair's examples are compiled, linted, rendered code, never rotting prose.
 *   - CSF stories (gen:demos) — the community viewer (Ladle) renders these; the
 *     format stays ours, the viewer is a commodity (§4.1).
 *   - the completeness gate (gen:demos) — every exported headless component of a
 *     pair must be `covered` by ≥1 demo, or CI is red (§4.2).
 *
 * The literal-only shape is what makes static extraction possible — the
 * `stapel/demo-literal-meta` lint keeps id/title/description literal and the
 * `component`/`covers` references statically readable, exactly as
 * `event-literal-meta` does for defineEvent (§3.1).
 *
 * DEVIATION FROM SPEC (documented, user-approved hybrid): the spec sketched
 * `variants: { default: { render: (D) => <D>{…}</D> } }` — a render that
 * receives the component so a self-rolled viewer could swap it. We render with
 * a COMMUNITY viewer and wrap providers at the tree level via `decorator`, so
 * `render` takes no argument and closes over the concrete, fully-typed
 * component — the demo body keeps its exact bag types instead of an untyped
 * injected `D`. `component` remains a first-class field (the completeness
 * gate + manifest read its identifier name).
 */
import type { ElementType, ReactNode } from "react";

/** A single showcase state of a demo: human copy + a render closure. */
export interface DemoVariant {
  /** One-line description of what this state shows (optional). */
  readonly description?: string;
  /**
   * Optional named mock/fixture key (e.g. a schema-driven msw scenario, core
   * task 10). Metadata only today — recorded in the manifest so a future viewer
   * or the aggregate site can select it; the render closure supplies its own
   * providers via the package's demo harness.
   */
  readonly mock?: string;
  /** Render this variant. Closes over the concrete component (see file docs). */
  readonly render: () => ReactNode;
}

/** The literal object passed to {@link defineDemo}. */
export interface DemoDef {
  /** `namespace.subject` id, unique within a package (e.g. "auth.passwordless-login"). */
  readonly id: string;
  /** Human title shown in the viewer tab list. */
  readonly title: string;
  /** One-line description of the component/flow this demo documents. */
  readonly description: string;
  /**
   * The headless component this demo documents. Its identifier name is what the
   * completeness gate matches against the pair's manifest exports.
   */
  readonly component: ElementType;
  /**
   * Extra public export names this demo also covers (beyond `component`'s name)
   * — string literals so the gate reads them statically. Use when one demo
   * exercises several exports (e.g. a provider + its flow component).
   */
  readonly covers?: readonly string[];
  /** Optional backend flow id (flows.json) this demo drives — descriptive. */
  readonly flow?: string;
  /** Optional token names this demo demonstrates (from @stapel/tokens). */
  readonly tokens?: readonly string[];
  /**
   * Wraps every variant with providers (mock runtime, i18n, analytics). Applied
   * by {@link renderDemoVariant}; the viewer/theme frame is separate (§4.1).
   */
  readonly decorator?: (children: ReactNode) => ReactNode;
  /** Named variants (states) of the demo. At least one (`default` by convention). */
  readonly variants: Readonly<Record<string, DemoVariant>>;
}

/**
 * Declare a design-system demo. Returns the literal object unchanged — the same
 * object the static extractor (gen:demos) projects into `demos.json`,
 * `manifest.demos`, and CSF stories, so the viewer, the catalog, and the gate
 * never diverge.
 */
export function defineDemo(input: DemoDef): DemoDef {
  return input;
}
