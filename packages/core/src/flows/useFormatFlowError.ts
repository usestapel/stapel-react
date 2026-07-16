import { useI18n } from "../i18n.js";
import { formatFlowError } from "./flowError.js";
import type { FlowError } from "./flowError.js";

/**
 * The reactive, wired form of `formatFlowError`: reads the CURRENT locale's
 * bundle + locale tag from the nearest `<I18nProvider>` so a pair's default
 * skin can render a flow error with the full fallback chain (bundle template
 * → locale-matched backend message → raw code) in one call, instead of every
 * pair re-deriving `bundle`/`opts.locale` by hand.
 *
 * ```tsx
 * const formatError = useFormatFlowError();
 * <Alert message={formatError(state.error)} />
 * ```
 *
 * Re-render-safe: does NOT itself subscribe to engine version changes (it
 * reads `engine.locale`/`engine.getBundle()` fresh on every render) — call it
 * from a component that already re-renders on locale/bundle changes (e.g. one
 * that also calls `useT()`), same as every other i18n-driven default skin.
 */
export function useFormatFlowError(): (error: FlowError) => string {
  const engine = useI18n();
  return (error) =>
    formatFlowError(error, engine.getBundle(), { locale: engine.locale });
}
