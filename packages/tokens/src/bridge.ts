/**
 * Design-system bridge roles (§68; frontend-guidelines §2.4). The §68
 * neutral colour-role dictionary IS the bridge vocabulary now — a role name
 * like `"brand"` or `"surface-raised"` is both the CSS var suffix
 * (`--stapel-brand`) and the exact name `@stapel/tokens-antd` /
 * `@stapel/tokens-mui` read off `colors`, so there is no separate role→role
 * indirection table to keep in sync (the old `bridgeColorRoles` map is gone —
 * §68 Ф1: "алиас-слой совместимости не делать"). Each bridge package's own
 * `role()` helper does `colors[roleName][mode]` directly; only the
 * radius/font-size PICKS below still need a single shared decision so the
 * two bridges cannot silently diverge on which scale step they surface.
 * Hand-written (like `breakpoints.ts`) — not part of the generated surface.
 */
import type { FontSizeName, RadiusName } from "./generated/tokens.js";

/** The single radius/font-size/font-family roles a theme bridge maps (§2.4). */
export const bridgeRadiusRole: RadiusName = "md";
export const bridgeFontSizeRole: FontSizeName = "md";
