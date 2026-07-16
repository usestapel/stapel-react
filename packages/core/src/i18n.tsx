import { createContext, useContext, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";

/** Flat key → string dictionary, e.g. `{"auth.otp.invalid": "Invalid code"}`. */
export type I18nDictionary = Record<string, string>;

/**
 * Async locale loader seam. Point it at the stapel-translate pair:
 * `loadLocale: (locale) => translateClient.resolve(locale)` — the engine
 * calls it once per locale and caches the result as a bundle.
 */
export type LocaleLoader = (locale: string) => Promise<I18nDictionary>;

export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>
) => string;

export interface I18nEngine {
  /** Current locale. */
  readonly locale: string;
  /** Translate a key; missing keys fall back to the key itself. */
  t: TranslateFn;
  /** Switch locale; loads it via `loadLocale` when not already registered. */
  setLocale(locale: string): Promise<void>;
  /** Register a static bundle (packages register their keys this way). */
  registerBundle(locale: string, bundle: I18nDictionary): void;
  /**
   * The merged flat dictionary for a locale (default: the current one) —
   * every bundle registered under it, later registrations winning per key
   * (the same merge-priority convention every pair's `register*I18n` follows).
   * For `formatFlowError`'s `bundle` argument, and any other caller that needs
   * a raw lookup table rather than `t`'s key-or-fallback string. Returns `{}`
   * for a locale nothing has been registered under yet.
   */
  getBundle(locale?: string): I18nDictionary;
  /** Subscribe to engine changes (locale switches, bundle registration). */
  subscribe(listener: () => void): () => void;
  /** Monotonic change counter (for useSyncExternalStore). */
  getVersion(): number;
}

/** `{param}` interpolation. Unknown params are left as-is. */
export function interpolate(
  template: string,
  params?: Record<string, unknown>
): string {
  if (!params) return template;
  return template.replace(/\{([\w.]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match
  );
}

export interface CreateI18nOptions {
  /** Initial locale. */
  readonly locale: string;
  /** Static bundles, keyed by locale. */
  readonly bundles?: Readonly<Record<string, I18nDictionary>>;
  /** Async loader for locales not covered by static bundles. */
  readonly loadLocale?: LocaleLoader;
}

/**
 * Minimal i18n engine: dictionaries per locale, `{param}` interpolation,
 * static bundles + async loader, missing-key fallback to the key itself
 * (frontend-standard §4.2 — user-facing strings are always keys).
 */
export function createI18n(options: CreateI18nOptions): I18nEngine {
  const dictionaries = new Map<string, I18nDictionary>();
  const loadedLocales = new Set<string>();
  const listeners = new Set<() => void>();
  let locale = options.locale;
  let version = 0;

  if (options.bundles) {
    for (const [bundleLocale, bundle] of Object.entries(options.bundles)) {
      dictionaries.set(bundleLocale, { ...bundle });
    }
  }

  function notify(): void {
    version += 1;
    for (const listener of listeners) listener();
  }

  async function ensureLoaded(nextLocale: string): Promise<void> {
    if (!options.loadLocale || loadedLocales.has(nextLocale)) return;
    loadedLocales.add(nextLocale);
    const bundle = await options.loadLocale(nextLocale);
    const existing = dictionaries.get(nextLocale) ?? {};
    dictionaries.set(nextLocale, { ...existing, ...bundle });
  }

  const engine: I18nEngine = {
    get locale(): string {
      return locale;
    },
    t: (key, params) => {
      const template = dictionaries.get(locale)?.[key];
      if (template === undefined) return key;
      return interpolate(template, params);
    },
    setLocale: async (nextLocale) => {
      await ensureLoaded(nextLocale);
      locale = nextLocale;
      notify();
    },
    registerBundle: (bundleLocale, bundle) => {
      const existing = dictionaries.get(bundleLocale) ?? {};
      dictionaries.set(bundleLocale, { ...existing, ...bundle });
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
    getBundle: (bundleLocale) => ({ ...dictionaries.get(bundleLocale ?? locale) }),
  };

  return engine;
}

const I18nContext = createContext<I18nEngine | null>(null);

export function I18nProvider(props: {
  i18n: I18nEngine;
  children: ReactNode;
}): ReactElement {
  return (
    <I18nContext.Provider value={props.i18n}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nEngine {
  const engine = useContext(I18nContext);
  if (engine === null) {
    throw new Error("useI18n must be used within an <I18nProvider>");
  }
  return engine;
}

/**
 * Reactive translate function: re-renders on locale switches and bundle
 * registration.
 */
export function useT(): TranslateFn {
  const engine = useI18n();
  useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
  return engine.t;
}
