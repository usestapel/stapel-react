import { StapelApiError, isStapelApiError } from "@stapel/core";
import type { StapelClient } from "@stapel/core";
import { isLanguageBundle } from "./types.js";
import type {
  LanguageBundle,
  LanguageRevision,
  TextTranslationRequest,
  TextTranslationResult,
} from "./types.js";

/**
 * The pair's typed operation surface, bound to the injected
 * {@link StapelClient} (the per-module override seam of frontend-standard
 * §7.2).
 *
 * ── Paths are mount-relative ───────────────────────────────────────────────
 *
 * The runtime's `baseUrl` carries the host's mount (`/translate/`); the
 * `api/v1/` prefix belongs to the module and is spelled here. Every form ends
 * in a slash — the canonical spelling this module's own `docs/schema.json`
 * publishes.
 *
 * ── Three operations, and the third one is optional ────────────────────────
 *
 * The two READ operations serve the fleet's runtime i18n: a revision number
 * and, keyed by it, a whole language bundle. Both are cacheable and both are
 * open to an anonymous reader.
 *
 * {@link TranslateApi.text} is CONTENT translation (stapel-translate 0.7.0,
 * `POST text/`). It is `undefined` when the host says the deployment does not
 * offer it — its guard is a per-deployment setting (`TEXT_PERMISSIONS`), its
 * misses spend real money, and a product that has not enabled it must not be
 * able to reach it by accident. The skin reads the same capability and renders
 * NO translate button rather than a dead one.
 *
 * The dashboard / figma / bulk_update routes are deliberately absent: they are
 * the translator console's surface, which the server renders itself today.
 */
export interface TranslateApi {
  readonly client: StapelClient;

  /**
   * `GET api/v1/languages/revision/` — the catalogue's current max revision.
   * One small anonymous call; it is what makes a warm start cheap, because a
   * bundle cached under the same revision is still exact.
   */
  languagesRevision(options?: {
    readonly signal?: AbortSignal;
  }): Promise<LanguageRevision>;

  /**
   * `GET api/v1/languages/{lang}/data/?revision=N` — the whole UI bundle for
   * one language as a flat `key → copy` dictionary.
   *
   * `revision` is the cache-buster, not a filter: the server answers the
   * CURRENT bundle and sets a month-long `Cache-Control`, so asking with a
   * stale number would be answered from a CDN edge with stale copy. The loader
   * always passes the revision it just read.
   *
   * A language the deployment does not configure answers 404 with a bare
   * `{"error": "Unsupported language: …"}` body — no Stapel envelope — which
   * core folds to the generic `stapel.http.404`. It is re-keyed here to the
   * module's own {@link UNSUPPORTED_LANGUAGE_CODE}, whose sentence names the
   * real condition in every locale the backend ships.
   */
  languageData(
    lang: string,
    revision: number,
    options?: { readonly signal?: AbortSignal }
  ): Promise<LanguageBundle>;

  /**
   * `POST api/v1/text/` — translate one text or a batch of short ones.
   * `undefined` when the deployment does not offer content translation.
   *
   * Present only through {@link TextTranslateInput}, which takes the two wire
   * shapes as two distinct arguments: a caller cannot build the `{}` body the
   * server refuses with `text_required`.
   */
  readonly text?: (
    input: TextTranslateInput,
    options?: { readonly signal?: AbortSignal }
  ) => Promise<TextTranslationResult>;
}

/**
 * The two shapes of `POST text/`, as one argument that can only be one of
 * them: exactly one of `text` / `texts` (the server refuses a body carrying
 * both or neither).
 */
export type TextTranslateInput = {
  readonly targetLang: string;
  readonly sourceLang?: string;
  /** Free-text domain hint ("a car listing title"). Part of the cache key. */
  readonly context?: string;
} & (
  | { readonly text: string; readonly texts?: undefined }
  | { readonly texts: readonly string[]; readonly text?: undefined }
);

/** Whether this deployment offers the capabilities behind the optional routes. */
export interface TranslateCapabilities {
  /**
   * Content translation (`POST text/`). Default `true`: the endpoint ships in
   * stapel-translate 0.7.0. A deployment that has configured no LLM provider,
   * or that does not want readers spending its budget, sets it to `false` —
   * `api.text` is then absent and the skin renders no control.
   */
  readonly contentTranslate?: boolean;
}

/** `GET api/v1/languages/revision/`, mount-relative. */
export const LANGUAGES_REVISION_PATH = "api/v1/languages/revision/";
/** `POST api/v1/text/`, mount-relative. */
export const TEXT_PATH = "api/v1/text/";

/** `GET api/v1/languages/{lang}/data/`, mount-relative. */
export function languageDataPath(lang: string): string {
  return `api/v1/languages/${encodeURIComponent(lang)}/data/`;
}

/**
 * The backend's own name for "this deployment does not carry that language"
 * (`stapel_translate.errors.ERR_400_UNSUPPORTED_LANGUAGE`), with texts in
 * en/ru/es in the generated error bundles. The registry names the CONDITION;
 * this read route answers it as a 404 and the thrown error keeps its true
 * status — only the i18n key is borrowed, because the sentence a person needs
 * to read is the same one.
 */
export const UNSUPPORTED_LANGUAGE_CODE =
  "error.400.translate.unsupported_language";

/** The key core assigns a 404 that carried no Stapel envelope. */
const BARE_404_CODE = "stapel.http.404";

/** The key core assigns a body that is not a bundle (see `isLanguageBundle`). */
const MALFORMED_BUNDLE_CODE = "translate.error.unknown";

const signalOf = (options?: {
  readonly signal?: AbortSignal;
}): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

/**
 * Re-key a bare 404 from the bundle route to {@link UNSUPPORTED_LANGUAGE_CODE}.
 * Anything else — a 404 that DID carry an envelope, a 500, a transport fault —
 * is rethrown untouched: a module that renames every failure to its own
 * favourite error is how an outage reads as a typo.
 */
function foldUnsupportedLanguage(error: unknown, lang: string): unknown {
  if (!isStapelApiError(error)) return error;
  if (error.status !== 404 || error.code !== BARE_404_CODE) return error;
  return new StapelApiError({
    code: UNSUPPORTED_LANGUAGE_CODE,
    message: error.message,
    params: { language: lang },
    status: error.status,
    body: error.body,
  });
}

function bodyOf(input: TextTranslateInput): TextTranslationRequest {
  return {
    ...(input.text !== undefined
      ? { text: input.text }
      : { texts: [...input.texts] }),
    target_lang: input.targetLang,
    ...(input.sourceLang !== undefined ? { source_lang: input.sourceLang } : {}),
    ...(input.context !== undefined ? { context: input.context } : {}),
  };
}

export function createTranslateApi(
  client: StapelClient,
  capabilities: TranslateCapabilities = {}
): TranslateApi {
  const contentTranslate = capabilities.contentTranslate ?? true;

  const base: TranslateApi = {
    client,
    languagesRevision: (options) =>
      client.get<LanguageRevision>(LANGUAGES_REVISION_PATH, {
        ...signalOf(options),
      }),
    languageData: async (lang, revision, options) => {
      let body: unknown;
      try {
        body = await client.get<unknown>(
          `${languageDataPath(lang)}?revision=${String(revision)}`,
          { ...signalOf(options) }
        );
      } catch (error) {
        throw foldUnsupportedLanguage(error, lang);
      }
      if (!isLanguageBundle(body)) {
        throw new StapelApiError({
          code: MALFORMED_BUNDLE_CODE,
          message: `The bundle for "${lang}" is not a flat key/copy dictionary.`,
          params: { language: lang },
          status: 200,
          body,
        });
      }
      return body;
    },
  };

  if (!contentTranslate) return base;

  return {
    ...base,
    text: (input, options) =>
      client.post<TextTranslationResult>(TEXT_PATH, bodyOf(input), {
        ...signalOf(options),
      }),
  };
}
