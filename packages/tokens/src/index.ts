/**
 * @stapel/tokens — three-tier design tokens (frontend-guardrails §1).
 * The source of truth is `theme.default.json`; everything under
 * `src/generated/` is emitted by `pnpm gen:tokens` and drift-gated. This
 * barrel re-exports the generated surface plus the hand-written breakpoint
 * helpers. Raw ramps (L1) are intentionally NOT here — reach them via the
 * `@stapel/tokens/raw` subpath (theme-config + showcase only).
 */

// ── L2 core / L3 component tokens + typed cssVar ─────────────────────────────
export { cssVar, colors, componentTokens } from "./generated/tokens.js";
export type {
  CoreTokenName,
  ComponentTokenName,
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
