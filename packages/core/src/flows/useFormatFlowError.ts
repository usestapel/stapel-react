import { useI18n } from "../i18n.js";
import { describeFlowError, formatFlowError } from "./flowError.js";
import type { FlowError, FlowErrorDisplay } from "./flowError.js";

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

/**
 * `useFormatFlowError`, but returning the sentence AND the technical detail
 * beside it (`describeFlowError`) — for a flow-driven skin that has somewhere
 * to render muted secondary text, e.g. an `<Alert description>`.
 *
 * ```tsx
 * const describeError = useDescribeFlowError();
 * const shown = describeError(state.error);
 * <Alert message={shown.message} description={shown.detail} />
 * ```
 *
 * Re-render-safe on the same terms as {@link useFormatFlowError}.
 */
export function useDescribeFlowError(): (error: FlowError) => FlowErrorDisplay {
  const engine = useI18n();
  return (error) =>
    describeFlowError(error, engine.getBundle(), { locale: engine.locale });
}
