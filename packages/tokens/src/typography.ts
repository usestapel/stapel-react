/**
 * Typography scale. Values live in theme.json (`scales`) and are generated
 * into `src/generated/tokens.ts`; this module re-exports them and composes the
 * back-compat `typography` aggregate.
 */
import {
  fontFamily,
  fontSize,
  fontWeight,
} from "./generated/tokens.js";
import type { TypeStep, FontSizeName, FontWeightName } from "./generated/tokens.js";

export { fontFamily, fontSize, fontWeight };
export type { TypeStep, FontSizeName, FontWeightName };

export interface Typography {
  readonly fontFamily: typeof fontFamily;
  readonly fontSize: typeof fontSize;
  readonly fontWeight: typeof fontWeight;
}

export const typography: Typography = {
  fontFamily: fontFamily,
  fontSize: fontSize,
  fontWeight: fontWeight,
};
