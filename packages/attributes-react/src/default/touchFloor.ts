/**
 * The touch floor, decided from the COLUMN's width rather than the viewport's.
 *
 * `SkinTheme` already raises antd's `controlHeight` to 44px on a phone — but
 * that rule is a viewport media query, and a composer is not a viewport. The
 * listings composer draws `<FeatureFields/>` in a form column a few hundred
 * pixels wide on a 1440px desktop: antd is on its 32px desktop control height
 * there, and the visual pass measured the segmented feature chips at ~27px —
 * a finger-sized control that is not finger-sized, on the exact surface a
 * seller fills in on a phone-shaped panel.
 *
 * So the answer comes from `useElementWidth` (the fleet's one measurement) at
 * the same `tablet` threshold everything else calls "narrow", and travels down
 * as context: `<FeatureFields/>` measures its own column once, and the editors
 * inside it — which are resolved through the registry and cannot see their
 * host — read the answer instead of each measuring themselves.
 *
 * Default `false`, deliberately. An editor rendered on its own by a host has
 * no measured column, and an unmeasured box is not a narrow one (the same
 * rule `useElementWidth` states for `below`); on a phone VIEWPORT such an
 * editor still gets the 44px floor from `SkinTheme`, which is the case that
 * matters most.
 */
import { createContext, useContext } from "react";
import type { Provider } from "react";
import { breakpoints } from "@stapel/tokens";

/**
 * Below this width the column is narrow enough that its controls are touched,
 * not clicked. The `tablet` breakpoint — the same number `SkinDialog` splits
 * a sheet from a modal on, so "narrow" means one thing across the skin.
 */
export const TOUCH_FLOOR_BELOW: number = breakpoints.tablet;

const TouchFloorContext = createContext<boolean>(false);

/** Publishes the measured answer to every editor in the column. */
export const TouchFloorProvider: Provider<boolean> = TouchFloorContext.Provider;

/** Is this editor drawing inside a column narrow enough to need the 44px
 * touch floor? `false` when nothing measured — see the module note. */
export function useTouchFloor(): boolean {
  return useContext(TouchFloorContext);
}
