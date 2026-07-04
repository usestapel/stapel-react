import { createContext, useContext } from "react";
import type { Context } from "react";
import type { Analytics } from "./types.js";

/**
 * Provided by `<StapelConfigProvider analytics={...}>` (or directly via
 * `AnalyticsContext.Provider`).
 */
export const AnalyticsContext: Context<Analytics | null> =
  createContext<Analytics | null>(null);

export function useAnalytics(): Analytics {
  const analytics = useContext(AnalyticsContext);
  if (analytics === null) {
    throw new Error(
      "useAnalytics requires an analytics instance — pass it to <StapelConfigProvider analytics={...}>"
    );
  }
  return analytics;
}
