/**
 * `@stapel/showcase` — the design-system demo format (frontend-guardrails §4).
 * Ships the `defineDemo` registration format + the render helper the generated
 * CSF stories and smoke tests use. It is the SOURCE format; the viewer (Ladle)
 * is a commodity that consumes generated CSF. Per-repo showcases and the future
 * aggregate site (design.stapel.dev) both read `manifest.demos`, which is a
 * static projection of these definitions.
 */
export { defineDemo } from "./defineDemo.js";
export type { DemoDef, DemoVariant, DemoViewport, DemoPlay, DemoPlayContext } from "./defineDemo.js";
export {
  renderDemoVariant,
  variantIds,
  playVariantIds,
  runDemoPlay,
  createPlayContext,
  DemoStage,
} from "./render.js";
export type { DemoStageProps, DemoPlayStatus } from "./render.js";
export { duplicateVariantGroups, assertVariantsRenderDistinctly } from "./distinct.js";
export type { MarkupRenderer, DuplicateVariantGroup } from "./distinct.js";
export { assertVariantsSettleDistinctly, settleVariants } from "./settle.js";
export type {
  SettleOptions,
  SettledVariant,
  MountedVariant,
  VariantMounter,
  VariantSettler,
  VariantArm,
} from "./settle.js";
