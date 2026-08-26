/**
 * `@stapel/translate-react` — the headless React flow pair for stapel-translate
 * (frontend-standard §2). Business + state only, zero visual opinion; the
 * default AntD skin lives on the `./default` subpath.
 *
 * ── What this pair IS ──────────────────────────────────────────────────────
 *
 * Two halves of one idea — "copy comes from the server, not from a release":
 *
 *  1. THE RUNTIME i18n SOURCE. `createRemoteLocaleLoader` is the wire between
 *     stapel-translate's revisioned bundle API and `@stapel/core`'s
 *     `createI18n({ loadLocale })`. Every `t()` key the fleet uses is served,
 *     cached by revision, and falls back down a named ladder so a failed
 *     download never blanks a screen. `<LanguageSwitcher/>` is the control.
 *  2. CONTENT translation (`POST text/`, stapel-translate 0.7.0). A listing
 *     description has no key and never will, so `useTranslateText` /
 *     `<TranslatedText/>` ask the module's LLM seam directly — batched, so a
 *     screen's worth of copy is ONE provider call, and bounded, because every
 *     miss costs money.
 *
 * ```tsx
 * const runtime = createTranslateRuntime({ baseUrl: "/translate/", languages: ["en", "ru", "es"] });
 * const i18n = createI18n({ locale: "en", loadLocale: runtime.localeLoader });
 * registerTranslateI18n(i18n);
 * <TranslateProvider runtime={runtime}>{app}</TranslateProvider>
 * ```
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createTranslateApi } from "./api/translateApi.js";
export {
  LANGUAGES_REVISION_PATH,
  TEXT_PATH,
  UNSUPPORTED_LANGUAGE_CODE,
  languageDataPath,
} from "./api/translateApi.js";
export type {
  TranslateApi,
  TranslateCapabilities,
  TextTranslateInput,
} from "./api/translateApi.js";
export { isLanguageBundle } from "./api/types.js";
export type {
  Schemas,
  LanguageBundle,
  LanguageRevision,
  TextTranslationRequest,
  TextTranslationResult,
} from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { TRANSLATE_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  TranslateFlowId,
  TranslateFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, the locale loader, the text batcher) ──────────────
export { createTranslateRuntime } from "./model/runtime.js";
export type {
  TranslateRuntime,
  CreateTranslateRuntimeOptions,
  LanguageOption,
} from "./model/runtime.js";
export {
  TranslateRuntimeContext,
  useTranslateRuntime,
  useTranslateApi,
  useTranslateAnalytics,
} from "./model/context.js";
export { translateQueryKeys } from "./model/queryKeys.js";
export { createRemoteLocaleLoader } from "./model/localeLoader.js";
export type {
  RemoteLocaleLoader,
  RemoteLocaleStatus,
  RemoteLocaleSource,
  CreateRemoteLocaleLoaderOptions,
  CachedBundle,
} from "./model/localeLoader.js";
export { createLanguagePreferenceStore } from "./model/preference.js";
export type { LanguagePreferenceStore } from "./model/preference.js";
export {
  createTextBatcher,
  chunkTexts,
  TEXT_LIMITS,
  TEXT_TOO_LONG_CODE,
} from "./model/textBatch.js";
export type {
  TextBatcher,
  TextBatchInput,
  TextTranslation,
  TextLimits,
  CreateTextBatcherOptions,
} from "./model/textBatch.js";
export { foldTranslateRefusal } from "./model/refusals.js";
export type { TranslateRefusal } from "./model/refusals.js";

// ── headless (renderless components + hooks) ─────────────────────────────────
export { TranslateProvider } from "./headless/TranslateProvider.js";
export { useCurrentLocale } from "./headless/useCurrentLocale.js";
export { useLanguage } from "./headless/useLanguage.js";
export type { LanguageBag } from "./headless/useLanguage.js";
export { useRemoteLocale, useLocaleStatus } from "./headless/useRemoteLocale.js";
export { useTranslateText } from "./headless/useTranslateText.js";
export type {
  TranslateTextBag,
  TranslateTextStatus,
  UseTranslateTextOptions,
} from "./headless/useTranslateText.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  TRANSLATE_I18N_KEYS,
  translateI18nBundleEn,
  registerTranslateI18n,
} from "./i18n/keys.js";
export type { TranslateI18nKey } from "./i18n/keys.js";
export { DEFAULT_LANGUAGE_CODES, LANGUAGE_NAMES, languageKey } from "./i18n/languages.js";

// ── analytics ────────────────────────────────────────────────────────────────
export { TRANSLATE_EVENTS } from "./analytics/events.js";
export type { TranslateEventName } from "./analytics/events.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  TRANSLATE_ERRORS,
  TRANSLATE_ERROR_CODES,
  translateErrorBundleEn,
  explainTranslateError,
} from "./i18n/errorsMap.js";
export type {
  TranslateErrorCode,
  TranslateErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
