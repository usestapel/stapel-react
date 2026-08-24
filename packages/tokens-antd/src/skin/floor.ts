/**
 * How the substrate gets its own copy.
 *
 * The substrate's sentences (retry, dismiss, confirm, cancel, the empty-state
 * default, the loading label) live in `@stapel/core`'s UI floor, which
 * `createI18n` seeds into every locale — so inside any `<I18nProvider>` they
 * come out translated and host-overridable through the ordinary `t`. Outside
 * one (a bare test, a story rendered without the harness), the same floor is
 * read directly, in English: a real sentence either way, never a raw key and
 * never a throw from a component whose only job is to say "Cancel".
 *
 * The same holds for folding a thrown value into a sentence: the engine's
 * bundle when there is one, core's English floor when there is not.
 */
import {
  coreErrorBundle,
  coreUiBundle,
  describeFlowError,
  interpolate,
  toFlowError,
  useOptionalI18n,
} from "@stapel/core";
import type { FlowErrorDisplay, I18nDictionary } from "@stapel/core";

export interface SubstrateI18n {
  /** Translate a floor key (with `{param}` interpolation). */
  readonly t: (key: string, params?: Record<string, unknown>) => string;
  /** Any thrown value → the human sentence and the technical detail. */
  readonly describe: (error: unknown) => FlowErrorDisplay;
}

let englishFloor: I18nDictionary | undefined;

function english(): I18nDictionary {
  englishFloor ??= { ...coreErrorBundle("en"), ...coreUiBundle("en") };
  return englishFloor;
}

/** See the module doc. Subscribed to the engine when there is one. */
export function useSubstrateI18n(): SubstrateI18n {
  const engine = useOptionalI18n();
  if (engine !== null) {
    return {
      t: engine.t,
      describe: (error) =>
        describeFlowError(toFlowError(error), engine.getBundle(), { locale: engine.locale }),
    };
  }
  const bundle = english();
  return {
    t: (key, params) => {
      const template = bundle[key];
      return template === undefined ? key : interpolate(template, params);
    },
    describe: (error) => describeFlowError(toFlowError(error), bundle, { locale: "en" }),
  };
}
