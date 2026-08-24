import { StapelApiError, isStapelApiError } from "@stapel/core";
import type { StapelClient } from "@stapel/core";
import type { Currency } from "./types.js";

/**
 * The pair's typed operation surface, bound to the injected
 * {@link StapelClient} (the per-module override seam of frontend-standard
 * §7.2). Two operations, both `AllowAny` — this module is a public catalogue.
 *
 * ── Paths are mount-relative ───────────────────────────────────────────────
 *
 * The runtime's `baseUrl` carries the host's mount (`/currencies/`); the
 * `api/v1/` prefix belongs to the module and is spelled here. Both forms end
 * in a slash: the backend mounts an `OptionalSlashRouter`, and the slashed
 * spelling is the canonical one its own `docs/schema.json` publishes.
 */
export interface CurrenciesApi {
  readonly client: StapelClient;

  /**
   * `GET api/v1/` — the whole active catalogue, a BARE ARRAY (no pagination
   * envelope), ordered by code. This is the pair's only real read: every rate
   * the Money layer needs arrives in one request, which is why `useCurrencies`
   * caches it for an hour instead of asking per price.
   */
  list(options?: { readonly signal?: AbortSignal }): Promise<Currency[]>;

  /**
   * `GET api/v1/{code}/` — one currency.
   *
   * The code is upper-cased before the call. stapel-currencies 0.1.9 folds the
   * case server-side too (`views.py` `get_object`), so this is no longer the
   * difference between 200 and 404 — but the catalogue is canonically
   * upper-case on every other surface (comm, admin, the seed list), and a
   * cache key that is sometimes `usd` and sometimes `USD` is two cache entries
   * for one row.
   *
   * A code the catalogue does not carry (or an inactive one) answers a BARE
   * DRF 404 — `{"detail": "Not found."}`, not the Stapel envelope — which core
   * folds to the generic `stapel.http.404`. {@link UNKNOWN_CURRENCY_CODE}
   * replaces that with the condition's real name, so a skin renders "Unknown
   * or inactive currency code" in every locale the backend catalogue ships
   * rather than "Requested resource not found".
   */
  retrieve(
    code: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<Currency>;
}

/** `GET api/v1/` — the catalogue, mount-relative. */
export const CURRENCIES_LIST_PATH = "api/v1/";

/**
 * The backend's own name for "this code is not in the catalogue"
 * (`stapel_currencies.errors.ERR_400_UNKNOWN_CURRENCY`), with texts in en/ru/es
 * in the generated error bundles.
 *
 * The code says `400` and this route answers `404`: the registry names the
 * CONDITION, and the comm Function `currencies.convert` — the surface that
 * will raise it next — raises it as a 400. The thrown error keeps its true
 * HTTP status; only the i18n key is borrowed, because the sentence a person
 * needs to read is the same one.
 */
export const UNKNOWN_CURRENCY_CODE = "error.400.unknown_currency";

/** The generic key core assigns a 404 that carried no Stapel envelope. */
const BARE_404_CODE = "stapel.http.404";

const signalOf = (options?: {
  readonly signal?: AbortSignal;
}): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

/**
 * Re-key a bare DRF 404 to {@link UNKNOWN_CURRENCY_CODE}. Anything else — a
 * 404 that DID carry an envelope, a 500, a transport fault — is rethrown
 * untouched: a module that renames every failure to its own favourite error is
 * how an outage reads as a typo.
 */
function foldUnknownCurrency(error: unknown, code: string): unknown {
  if (!isStapelApiError(error)) return error;
  if (error.status !== 404 || error.code !== BARE_404_CODE) return error;
  return new StapelApiError({
    code: UNKNOWN_CURRENCY_CODE,
    message: error.message,
    params: { code },
    status: error.status,
    body: error.body,
  });
}

export function createCurrenciesApi(client: StapelClient): CurrenciesApi {
  return {
    client,
    list: (options) =>
      client.get<Currency[]>(CURRENCIES_LIST_PATH, { ...signalOf(options) }),
    retrieve: async (code, options) => {
      const normalized = code.toUpperCase();
      try {
        return await client.get<Currency>(
          `${CURRENCIES_LIST_PATH}${encodeURIComponent(normalized)}/`,
          { ...signalOf(options) }
        );
      } catch (error) {
        throw foldUnknownCurrency(error, normalized);
      }
    },
  };
}
