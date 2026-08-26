/**
 * The remote locale loader — the seam this whole pair exists for.
 *
 * `@stapel/core`'s `createI18n({ loadLocale })` has always taken a
 * `LocaleLoader`, and nothing in the fleet fed it from a server: every pair
 * shipped en/ru/es inside its bundle and a deployment that wanted a fourth
 * language, or a changed sentence, needed a frontend release. stapel-translate
 * already serves every `t()` key over an anonymous, revisioned, month-cacheable
 * read API. This function is the wire between the two:
 *
 *   const runtime = createTranslateRuntime({ baseUrl: "/translate/", languages });
 *   const i18n = createI18n({ locale: "en", loadLocale: runtime.localeLoader });
 *
 * ── Two calls on a cold start, one on a warm one ───────────────────────────
 *
 * The revision endpoint answers a single number and is the cache key of the
 * bundle: a stored bundle carrying the same revision IS the current bundle, so
 * a warm start costs one small request and no download. A new revision
 * replaces the stored entry.
 *
 * ── It never returns nothing ───────────────────────────────────────────────
 *
 * A blank UI is the one outcome a translation loader must not produce, so the
 * failure ladder has three rungs and each is REPORTED (`getStatus`), not
 * silently taken:
 *
 *   network  the bundle as just downloaded;
 *   cache    the stored bundle — possibly at an older revision (offline, or
 *            the revision call failed): stale copy beats no copy;
 *   fallback the in-package bundle the host passed for this locale, or `{}` —
 *            at which point the engine's own key-fallback renders English.
 *
 * `<TranslationStatus/>` reads the same status and says which rung is in
 * effect, and `<LanguageSwitcher/>` says "some texts may appear in English"
 * when it is the last one — because a person who just picked Spanish and got
 * half an English screen deserves to know it is a fault and not the product.
 */
import { createRepository } from "@stapel/core";
import type { I18nDictionary, Repository } from "@stapel/core";
import type { TranslateApi } from "../api/translateApi.js";
import type { LanguageBundle } from "../api/types.js";

/** Where the bundle in effect for a locale came from. */
export type RemoteLocaleSource = "network" | "cache" | "fallback";

export interface RemoteLocaleStatus {
  readonly locale: string;
  /** The revision the bundle carries, or `null` when it never reached one. */
  readonly revision: number | null;
  /** How many keys are in effect — what `<TranslationStatus/>` counts. */
  readonly keys: number;
  readonly source: RemoteLocaleSource;
  /** True when the stored bundle is at an older revision than the server's. */
  readonly stale: boolean;
  /** True when the network path failed and a lower rung answered. */
  readonly failed: boolean;
  /** The failure, for `ErrorAlert thrown=` — never rendered raw. */
  readonly error: unknown;
}

/**
 * A `LocaleLoader` that also reports what it did. The call signature is what
 * `createI18n` takes; the three methods are what the status chip reads
 * (`useSyncExternalStore`), so nothing has to fetch the bundle twice to find
 * out whether it arrived.
 */
export interface RemoteLocaleLoader {
  (locale: string): Promise<I18nDictionary>;
  getStatus(locale: string): RemoteLocaleStatus | undefined;
  subscribe(listener: () => void): () => void;
  getVersion(): number;
}

export interface CreateRemoteLocaleLoaderOptions {
  /**
   * In-package bundles to fall back to, keyed by locale — typically the pair
   * bundles a host already registers (`{ ru: registerRu, … }` catalogues).
   * A locale with no entry falls back to `{}`, which the engine renders as the
   * English floor rather than as raw keys.
   */
  readonly fallbackBundles?: Readonly<Record<string, I18nDictionary>>;
  /**
   * Where downloaded bundles are stored between visits. Default: a
   * `scope: "app"` repository in localStorage — a UI catalogue is not a
   * secret, and it must survive a logout the way a chosen theme does.
   * `null` disables persistence (SSR, tests).
   */
  readonly cache?: Repository<CachedBundle> | null;
}

/** One stored bundle, with the revision that identifies it. */
export interface CachedBundle {
  readonly revision: number;
  readonly bundle: LanguageBundle;
}

const NAMESPACE = "translate-bundles";

let sharedCache: Repository<CachedBundle> | null = null;

/** Built lazily so importing this module never touches storage. */
function defaultCache(): Repository<CachedBundle> {
  sharedCache ??= createRepository<CachedBundle>(NAMESPACE, {
    scope: "app",
    storage: "local",
  });
  return sharedCache;
}

/** @internal Test seam — drops the memoized repository between cases. */
export function __resetBundleCache(): void {
  sharedCache = null;
}

export function createRemoteLocaleLoader(
  api: TranslateApi,
  options: CreateRemoteLocaleLoaderOptions = {}
): RemoteLocaleLoader {
  const fallbacks = options.fallbackBundles ?? {};
  const cache =
    options.cache === null ? null : (options.cache ?? defaultCache());

  const statuses = new Map<string, RemoteLocaleStatus>();
  const listeners = new Set<() => void>();
  let version = 0;

  function publish(status: RemoteLocaleStatus): void {
    statuses.set(status.locale, status);
    version += 1;
    for (const listener of listeners) listener();
  }

  async function readCache(locale: string): Promise<CachedBundle | undefined> {
    if (cache === null) return undefined;
    try {
      return await cache.get(locale);
    } catch {
      // A rotated key or a full disk reads as a miss, never as a throw: the
      // ladder below has two more rungs and a person is waiting for copy.
      return undefined;
    }
  }

  async function writeCache(locale: string, entry: CachedBundle): Promise<void> {
    if (cache === null) return;
    try {
      await cache.set(locale, entry);
    } catch {
      /* storage is a nicety here; the bundle is already in hand */
    }
  }

  /** The in-package bundle for `es-419` is the one registered for `es`. */
  function fallbackFor(locale: string): I18nDictionary | undefined {
    const exact = fallbacks[locale];
    if (exact !== undefined) return exact;
    const dash = locale.indexOf("-");
    return dash > 0 ? fallbacks[locale.slice(0, dash)] : undefined;
  }

  const load = async (locale: string): Promise<I18nDictionary> => {
    let revision: number | null = null;
    let error: unknown = null;
    try {
      revision = (await api.languagesRevision()).revision;
    } catch (caught) {
      error = caught;
    }

    const cached = await readCache(locale);
    if (revision !== null && cached !== undefined && cached.revision === revision) {
      publish({
        locale,
        revision,
        keys: Object.keys(cached.bundle).length,
        source: "cache",
        stale: false,
        failed: false,
        error: null,
      });
      return cached.bundle;
    }

    if (revision !== null) {
      try {
        const bundle = await api.languageData(locale, revision);
        await writeCache(locale, { revision, bundle });
        publish({
          locale,
          revision,
          keys: Object.keys(bundle).length,
          source: "network",
          stale: false,
          failed: false,
          error: null,
        });
        return bundle;
      } catch (caught) {
        error = caught;
      }
    }

    if (cached !== undefined) {
      publish({
        locale,
        revision: cached.revision,
        keys: Object.keys(cached.bundle).length,
        source: "cache",
        stale: revision !== null && revision !== cached.revision,
        failed: true,
        error,
      });
      return cached.bundle;
    }

    const fallback = fallbackFor(locale) ?? {};
    publish({
      locale,
      revision: null,
      keys: Object.keys(fallback).length,
      source: "fallback",
      stale: false,
      failed: true,
      error,
    });
    return fallback;
  };

  const loader = load as RemoteLocaleLoader;
  loader.getStatus = (locale: string) => statuses.get(locale);
  loader.subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  loader.getVersion = () => version;
  return loader;
}
