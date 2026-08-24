import { createContext, useContext, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import { CORE_ERROR_LOCALES, coreErrorBundle } from "./i18n/coreErrors.js";
import { CORE_UI_LOCALES, coreUiBundle } from "./i18n/coreUi.js";

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

/**
 * The CLDR plural categories. Which of them a language actually uses is a fact
 * about the language, not a choice a catalogue makes: `en` has `one`/`other`,
 * `ru` has `one`/`few`/`many`/`other`, `ja` has `other` alone. Only `other` is
 * defined everywhere, which is why it is the fallback and the only form a
 * static gate may demand.
 */
export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * Translate a plural FAMILY. `params.count` selects the form; it is also
 * interpolated, so `{count}` in the message works without repeating it.
 */
export type PluralTranslateFn = (
  key: string,
  params: { count: number } & Record<string, unknown>
) => string;

export interface I18nEngine {
  /** Current locale. */
  readonly locale: string;
  /** Translate a key; missing keys fall back to the key itself. */
  t: TranslateFn;
  /**
   * Translate a plural family: `tPlural("search.results.count_exact",
   * { count })` looks up `<key>.<category>` for the current locale's CLDR
   * category, then `<key>.other`, then `<key>` itself (a family that is still
   * one flat string), then the key. See {@link pluralCategory}.
   */
  tPlural: PluralTranslateFn;
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

/**
 * `Intl.PluralRules` is not free to construct and a page asks for the same
 * locale on every render, so one instance per locale is kept.
 */
const pluralRules = new Map<string, Intl.PluralRules>();

/**
 * The CLDR cardinal category `count` takes in `locale` — `Intl.PluralRules`,
 * never a hand-rolled `n === 1 ? … : …`, which is right in English and wrong
 * in the next language the product ships. An unknown locale tag degrades to
 * English rather than throwing: a plural is copy, and copy must not be able to
 * crash a render.
 */
export function pluralCategory(locale: string, count: number): PluralCategory {
  let rules = pluralRules.get(locale);
  if (rules === undefined) {
    try {
      rules = new Intl.PluralRules(locale);
    } catch {
      rules = new Intl.PluralRules("en");
    }
    pluralRules.set(locale, rules);
  }
  return rules.select(count) as PluralCategory;
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
 * CLDR plurals through `tPlural`, static bundles + async loader, missing-key
 * fallback to the key itself (frontend-standard §4.2 — user-facing strings are
 * always keys).
 *
 * ── Plurals: ONE mechanism, and it is the lint's ───────────────────────────
 *
 * A plural message is catalogued as one FLAT key per CLDR category —
 * `search.results.count_exact.one`, `…few`, `…many`, `…other` — and rendered
 * with `tPlural("search.results.count_exact", { count })`. The dictionary
 * stays `Record<string, string>` (every bundle, every generated catalogue and
 * `getBundle` are unchanged), and the registry `stapel/i18n-key-exists` reads
 * catalogues the categories automatically, because it scans the pair's key
 * module for `"<ns>.…"` literals and the bundle lives there.
 *
 * The alternative — an object message `{one, few, many, other}` — was not
 * taken: it widens `I18nDictionary` for every consumer, and the lint would
 * still have to be taught the shape, so the two halves could drift. Which
 * categories a language HAS is `Intl.PluralRules`' answer, not the
 * catalogue's; a bundle that ships only `other` is complete for `ja` and
 * degrades honestly for `ru`.
 *
 * Seeds core's OWN floors under every locale before anything else: the error
 * floor (`./i18n/coreErrors.ts` — `stapel.http.*`, `stapel.transport.failed`,
 * `stapel.error.unknown`), so the codes core itself mints for a response with
 * no envelope have display copy without a single line of host wiring, and the
 * UI floor (`./i18n/coreUi.ts` — `stapel.ui.*`: retry, dismiss, confirm,
 * cancel, the empty-state default), so the shared skin substrate's own
 * controls are translated with the same zero wiring. Both are FLOORS in the
 * fleet's usual sense: registered first, so any pair bundle or host override
 * registered later wins on the same key.
 */
export function createI18n(options: CreateI18nOptions): I18nEngine {
  const dictionaries = new Map<string, I18nDictionary>();
  const flooredLocales = new Set<string>();
  const loadedLocales = new Set<string>();
  const listeners = new Set<() => void>();
  let locale = options.locale;
  let version = 0;

  /** Put core's error + UI floors UNDER whatever this locale already has. */
  function floor(targetLocale: string): void {
    if (flooredLocales.has(targetLocale)) return;
    flooredLocales.add(targetLocale);
    dictionaries.set(targetLocale, {
      ...coreErrorBundle(targetLocale),
      ...coreUiBundle(targetLocale),
      ...(dictionaries.get(targetLocale) ?? {}),
    });
  }

  for (const seeded of [...CORE_ERROR_LOCALES, ...CORE_UI_LOCALES, options.locale]) {
    floor(seeded);
  }

  if (options.bundles) {
    for (const [bundleLocale, bundle] of Object.entries(options.bundles)) {
      floor(bundleLocale);
      dictionaries.set(bundleLocale, {
        ...(dictionaries.get(bundleLocale) ?? {}),
        ...bundle,
      });
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
    tPlural: (key, params) => {
      const dictionary = dictionaries.get(locale);
      const category = pluralCategory(locale, params.count);
      const template =
        dictionary?.[`${key}.${category}`] ??
        // `other` is the form every locale defines; a bundle that ships only
        // it (or a language that needs only it) resolves here.
        dictionary?.[`${key}.other`] ??
        // A family still catalogued as ONE flat string — every host bundle
        // written before plurals existed. It reads worse than a real plural
        // and better than a raw key on the page.
        dictionary?.[key];
      if (template === undefined) return key;
      return interpolate(template, params);
    },
    setLocale: async (nextLocale) => {
      floor(nextLocale);
      await ensureLoaded(nextLocale);
      locale = nextLocale;
      notify();
    },
    registerBundle: (bundleLocale, bundle) => {
      floor(bundleLocale);
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
 * The nearest engine, or `null` outside any `<I18nProvider>`, subscribed to
 * its changes when there is one.
 *
 * For a component that owns its own copy props and merely FLOORS them from
 * core's bundles when a host is present — the shared skin substrate's
 * `SkinConfirm` with explicit `confirmLabel`/`cancelLabel`, rendered in a
 * host that mounts no provider (a bare test, a storybook without the
 * harness). Everything that renders a pair's own keys keeps using
 * {@link useT}: a missing provider there is a wiring defect, and throwing is
 * the right answer.
 */
export function useOptionalI18n(): I18nEngine | null {
  const engine = useContext(I18nContext);
  useSyncExternalStore(
    engine === null ? noSubscription : engine.subscribe,
    engine === null ? zero : engine.getVersion,
    engine === null ? zero : engine.getVersion
  );
  return engine;
}

function noSubscription(): () => void {
  return () => undefined;
}

function zero(): number {
  return 0;
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

/**
 * Reactive plural translate function — the counted half of `useT`.
 *
 * ```tsx
 * const tPlural = useTPlural();
 * <span>{tPlural("search.results.count_exact", { count })}</span>
 * ```
 *
 * The name is the CONTRACT, not a preference: `stapel/i18n-key-exists` treats
 * a `tPlural(…)` call's first argument as a family and demands `<key>.other`
 * in the generated registry, where a `t(…)` call demands the key verbatim. A
 * plural rendered through `t` would therefore be gated as a key that does not
 * exist — one mechanism, spelled the same way in the runtime and in the lint.
 */
export function useTPlural(): PluralTranslateFn {
  const engine = useI18n();
  useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
  return engine.tPlural;
}
