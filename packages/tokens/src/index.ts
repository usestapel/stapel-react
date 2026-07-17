/**
 * @stapel/tokens — neutral colour-role design tokens (§68; frontend-guardrails
 * §1). The source of truth is `theme.default.json`; everything under
 * `src/generated/` is emitted by the package's own `stapel-tokens` bin
 * (`pnpm gen:tokens`) and drift-gated. This barrel re-exports the generated
 * surface plus the hand-written breakpoint helpers. Raw ramps (L1) are
 * intentionally NOT here — reach them via the `@stapel/tokens/raw` subpath
 * (theme-config + showcase only).
 */

// ── neutral colour roles (§68) + typed cssVar ────────────────────────────────
export { cssVar, colors } from "./generated/tokens.js";
export type {
  CoreTokenName,
  TokenName,
  StapelVar,
  ColorToken,
  ColorTokenName,
} from "./generated/tokens.js";

// ── typography ───────────────────────────────────────────────────────────────
export { typography, fontFamily, fontSize, fontWeight } from "./typography.js";
export type { Typography } from "./typography.js";
export type { TypeStep, FontSizeName, FontWeightName } from "./generated/tokens.js";

// ── spacing / radii / elevation ──────────────────────────────────────────────
export { spacing, radii, elevation } from "./generated/tokens.js";
export type {
  SpacingStep,
  RadiusName,
  ElevationName,
  ElevationToken,
} from "./generated/tokens.js";

// ── breakpoints (values generated; helpers hand-written) ─────────────────────
export {
  breakpoints,
  breakpointOrder,
  breakpointForWidth,
  mediaQuery,
} from "./breakpoints.js";
export type { Breakpoint } from "./breakpoints.js";

// ── design-system theme bridge roles (hand-written; frontend-guidelines §2.4)─
export { bridgeRadiusRole, bridgeFontSizeRole } from "./bridge.js";
