import { useMemo } from "react";
import { useAnalytics } from "@stapel/core";
import { createTracked } from "./tracked.js";
import type { TrackedApi } from "./tracked.js";

/**
 * The React entry point for {@link createTracked}: binds `tracked` /
 * `trackedSubmit` to the facade from `<StapelConfigProvider analytics={...}>`.
 *
 *   const { tracked } = useTracked();
 *   <Button onClick={tracked(planSelected, { plan }, startCheckout)}>
 *
 * (`tracked` is obtained from a hook rather than a module singleton on
 * purpose: a mutable module-global facade is not SSR-safe — it would bleed
 * between concurrent requests. The lint only cares about the `tracked(...)`
 * call form, which this preserves.)
 */
export function useTracked(): TrackedApi {
  const analytics = useAnalytics();
  return useMemo(() => createTracked(analytics), [analytics]);
}
