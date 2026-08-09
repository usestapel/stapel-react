import { toFlowError } from "./flowError.js";
import { useFormatFlowError } from "./useFormatFlowError.js";

/**
 * ANY thrown value → the sentence a human should read. The one-call form of
 * `formatFlowError(toFlowError(e), bundle, {locale})`.
 *
 * This rung was missing, and its absence is why "one error dialect" (§131)
 * held everywhere a FLOW ran and nowhere else. `useFormatFlowError` takes a
 * `FlowError`, which is what a flow machine's error state already holds — so
 * `AuthPanel` uses it and reads correctly. A default skin driven by a plain
 * query or mutation holds `error: unknown` instead, and folding that into a
 * `FlowError` first meant importing a second symbol and knowing the dialect
 * existed. Roughly twenty skin sites across the fleet took the shorter path
 * and rendered `error.message` — which for a response with no envelope is
 * `parseErrorEnvelope`'s internal `"Request failed with status 500"`, in
 * English, straight to the user (owner report 2026-08-09).
 *
 * ```tsx
 * const errorText = useErrorText();
 * {mutation.isError && <Alert type="error" message={errorText(mutation.error)} />}
 * ```
 *
 * `undefined` in, `undefined` out — so a skin can hand it `mutation.error`
 * (which react-query types as `Error` but leaves `null` until something
 * fails) without a ternary at the call site.
 *
 * `fallbackCode` is the code used for a value that is not a `StapelApiError`
 * at all (a bug in a component, a rejected promise from something else). It
 * defaults to `stapel.error.unknown`, which core's own i18n floor translates;
 * a pair with its own module-scoped unknown-error copy passes that instead.
 *
 * Re-render-safe on the same terms as `useFormatFlowError`: it reads the
 * current bundle/locale fresh on every render rather than subscribing, so
 * call it from a component that already re-renders on locale change (any
 * component that also calls `useT()`).
 */
export function useErrorText(
  fallbackCode = "stapel.error.unknown"
): (error: unknown) => string | undefined {
  const formatFlowError = useFormatFlowError();
  return (error) => {
    if (error === undefined || error === null) return undefined;
    return formatFlowError(toFlowError(error, fallbackCode));
  };
}
