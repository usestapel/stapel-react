/**
 * Design-system bridge roles (frontend-guidelines §2.4). This is the ONE
 * mapping table from `@stapel/tokens` L2 core tokens to design-system theme
 * slots — `@stapel/tokens-antd` and `@stapel/tokens-mui` both read it and only
 * translate the neutral ROLE names below into their own theme's field
 * names/shape (`colorPrimary` vs `palette.primary.main`, ...). The L2 → role
 * decision lives here exactly once so the two bridges cannot silently diverge.
 * Hand-written (like `breakpoints.ts`) — not part of the generated surface.
 */
import type { CoreTokenName, FontSizeName, RadiusName } from "./generated/tokens.js";

/** Neutral colour-role names a design-system theme bridge resolves. */
export type BridgeColorRole =
  | "brand"
  | "brandHover"
  | "success"
  | "warning"
  | "danger"
  | "dangerSubtle"
  | "info"
  | "textPrimary"
  | "textSecondary"
  | "textOnBrand"
  | "bgContainer"
  | "bgLayout"
  | "bgSecondary"
  | "border"
  | "borderSecondary"
  | "link";

/**
 * role → L2 core token name. Each value is a {@link CoreTokenName}, i.e. a
 * `{light, dark}` pair already lives on `colors[value]` (`./generated/tokens.js`)
 * — a bridge resolves the mode by reading `colors[bridgeColorRoles[role]][mode]`.
 */
export const bridgeColorRoles: Readonly<Record<BridgeColorRole, CoreTokenName>> = {
  brand: "accent",
  brandHover: "accent-hover",
  success: "text-positive",
  warning: "text-warning",
  danger: "text-negative",
  dangerSubtle: "background-negative-subtle",
  info: "text-info",
  textPrimary: "text-primary",
  textSecondary: "text-secondary",
  textOnBrand: "text-on-accent",
  bgContainer: "upperground-primary",
  bgLayout: "background-primary",
  bgSecondary: "background-secondary",
  border: "border-primary",
  borderSecondary: "border-secondary",
  link: "text-brand",
};

/** The single radius/font-size/font-family roles a theme bridge maps (§2.4). */
export const bridgeRadiusRole: RadiusName = "md";
export const bridgeFontSizeRole: FontSizeName = "md";
