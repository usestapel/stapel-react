/**
 * `@stapel/showcase` — the design-system demo format (frontend-guardrails §4).
 * Ships the `defineDemo` registration format + the render helper the generated
 * CSF stories and smoke tests use. It is the SOURCE format; the viewer (Ladle)
 * is a commodity that consumes generated CSF. Per-repo showcases and the future
 * aggregate site (design.stapel.dev) both read `manifest.demos`, which is a
 * static projection of these definitions.
 */
export { defineDemo } from "./defineDemo.js";
export type { DemoDef, DemoVariant } from "./defineDemo.js";
export { renderDemoVariant, variantIds } from "./render.js";
