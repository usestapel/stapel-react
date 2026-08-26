import { createModuleRuntime } from "@stapel/core";
import type {
  CreateModuleRuntimeOptions,
  I18nDictionary,
  ModuleRuntime,
  Repository,
} from "@stapel/core";
import { createTranslateApi } from "../api/translateApi.js";
import type { TranslateApi, TranslateCapabilities } from "../api/translateApi.js";
import { DEFAULT_LANGUAGE_CODES, languageKey } from "../i18n/languages.js";
import { createRemoteLocaleLoader } from "./localeLoader.js";
import type { CachedBundle, RemoteLocaleLoader } from "./localeLoader.js";
import { createLanguagePreferenceStore } from "./preference.js";
import type { LanguagePreferenceStore } from "./preference.js";
import { TEXT_LIMITS, createTextBatcher } from "./textBatch.js";
import type { TextBatcher, TextLimits } from "./textBatch.js";

/**
 * One selectable language: the code the API takes and the i18n key its name is
 * rendered through (`language.<code>` — an endonym, see `i18n/languages.ts`).
 */
export interface LanguageOption {
  readonly code: string;
  readonly labelKey: string;
}

/**
 * The wired translate runtime — core's `ModuleRuntime` plus the four things
 * this module is: the list of languages the deployment serves, the loader that
 * feeds core's i18n engine from the server, the text batcher, and where a
 * person's choice is remembered.
 *
 * The languages come from the HOST because no anonymous endpoint lists them
 * (BACKEND-GAP TR-6): the scaffold knows `STAPEL_TRANSLATE["LANGUAGES"]` and
 * passes it here. Omitted, the module's own twenty defaults are used.
 */
export interface TranslateRuntime extends ModuleRuntime<TranslateApi> {
  readonly languages: readonly LanguageOption[];
  readonly defaultLanguage: string;
  readonly capabilities: { readonly contentTranslate: boolean };
  readonly limits: TextLimits;
  /** Pass to `createI18n({ loadLocale })` — the seam this pair exists for. */
  readonly localeLoader: RemoteLocaleLoader;
  /** `null` when the deployment does not offer content translation. */
  readonly textBatcher: TextBatcher | null;
  readonly preferences: LanguagePreferenceStore;
}

export interface CreateTranslateRuntimeOptions extends CreateModuleRuntimeOptions {
  /**
   * The languages this deployment serves — codes, or `{code, labelKey}` pairs
   * for a host with its own names. Default: the module's twenty.
   */
  readonly languages?: readonly (string | LanguageOption)[];
  /** The code a first-time visitor starts in. Default `"en"`. */
  readonly defaultLanguage?: string;
  readonly capabilities?: TranslateCapabilities;
  /** The `POST text/` ceilings, when the deployment tuned them. */
  readonly limits?: TextLimits;
  /** In-package bundles the loader falls back to when the server is unreachable. */
  readonly fallbackBundles?: Readonly<Record<string, I18nDictionary>>;
  /** Where downloaded bundles live between visits; `null` disables persistence. */
  readonly bundleCache?: Repository<CachedBundle> | null;
  /** A host that keeps the choice server-side passes its own store. */
  readonly preferenceStore?: LanguagePreferenceStore;
  /** Test seam: when the batcher flushes (default `queueMicrotask`). */
  readonly batchSchedule?: (flush: () => void) => void;
}

function toOption(entry: string | LanguageOption): LanguageOption {
  return typeof entry === "string"
    ? { code: entry, labelKey: languageKey(entry) }
    : entry;
}

export function createTranslateRuntime(
  options: CreateTranslateRuntimeOptions
): TranslateRuntime {
  const contentTranslate = options.capabilities?.contentTranslate ?? true;
  const limits = options.limits ?? TEXT_LIMITS;
  const base = createModuleRuntime<TranslateApi>(
    (client) => createTranslateApi(client, { contentTranslate }),
    options
  );
  const languages = (options.languages ?? DEFAULT_LANGUAGE_CODES).map(toOption);

  return {
    ...base,
    languages,
    defaultLanguage: options.defaultLanguage ?? "en",
    capabilities: { contentTranslate },
    limits,
    localeLoader: createRemoteLocaleLoader(base.api, {
      ...(options.fallbackBundles !== undefined
        ? { fallbackBundles: options.fallbackBundles }
        : {}),
      ...(options.bundleCache !== undefined ? { cache: options.bundleCache } : {}),
    }),
    textBatcher: createTextBatcher(base.api, {
      limits,
      ...(options.batchSchedule !== undefined
        ? { schedule: options.batchSchedule }
        : {}),
    }),
    preferences: options.preferenceStore ?? createLanguagePreferenceStore(),
  };
}
