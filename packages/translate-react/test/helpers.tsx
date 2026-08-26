import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { Analytics, I18nEngine } from "@stapel/core";
import {
  TranslateProvider,
  createTranslateRuntime,
  registerTranslateI18n,
} from "../src/index.js";
import type {
  RemoteLocaleLoader,
  RemoteLocaleStatus,
  TranslateRuntime,
} from "../src/index.js";
import { registerTranslateI18nRu } from "../src/i18n/ru.js";
import { registerTranslateI18nEs } from "../src/i18n/es.js";

export const BASE = "/translate/";
export const LANGUAGES: readonly string[] = ["en", "es", "ru"];

/** One recorded request the pair made. */
export interface WireCall {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

export interface WireOptions {
  /** `suffix → [status, body]`, matched by `url.includes(suffix)`. */
  readonly routes?: Readonly<Record<string, readonly [number, unknown]>>;
  /** Fail every call (offline). */
  readonly offline?: boolean;
}

/** A canned `fetch` that RECORDS: the wire is mocked, the client is real. */
export function recordingFetch(options: WireOptions = {}): {
  fetch: typeof globalThis.fetch;
  calls: WireCall[];
} {
  const calls: WireCall[] = [];
  const routes = options.routes ?? {};
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      body:
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : null,
    });
    if (options.offline === true) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    for (const [suffix, [status, body]] of Object.entries(routes)) {
      if (url.includes(suffix)) {
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          })
        );
      }
    }
    return Promise.resolve(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
  return { fetch: fetchImpl, calls };
}

/**
 * Make `matchMedia` answer against a chosen width, the way
 * `packages/tokens-antd/test/env.tsx` does: `SkinDialog`/`SkinTheme` read
 * `(min-width: N)`, and jsdom's stub answers `false` to everything — which
 * would make every surface a phone by accident rather than by test.
 */
export function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      const matches = min !== null ? width >= Number(min[1]) : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
    },
  });
}

/** A loader status as the loader would have published it. */
export function statusOf(
  overrides: Partial<RemoteLocaleStatus> = {}
): RemoteLocaleStatus {
  return {
    locale: "en",
    revision: 7,
    keys: 42,
    source: "network",
    stale: false,
    failed: false,
    error: null,
    ...overrides,
  };
}

export interface HarnessOptions {
  readonly locale?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly contentTranslate?: boolean;
  readonly status?: RemoteLocaleStatus;
  /** Flush the text batcher on demand instead of on a microtask. */
  readonly schedule?: (flush: () => void) => void;
  /** The host's analytics seam — a test double, to assert what was emitted. */
  readonly analytics?: Analytics;
  /** A preference store double, to assert what a language switch persisted. */
  readonly preferenceStore?: {
    read: () => Promise<string | undefined>;
    write: (code: string) => Promise<void>;
  };
}

export interface HarnessKit {
  readonly runtime: TranslateRuntime;
  readonly i18n: I18nEngine;
  readonly Wrapper: (props: { children: ReactNode }) => ReactElement;
}

/**
 * Build the provider frame a skin test renders inside, and hand back the
 * runtime and engine so a test can assert on what the components did.
 */
export function makeHarness(options: HarnessOptions = {}): HarnessKit {
  const locale = options.locale ?? "en";
  const base = createTranslateRuntime({
    baseUrl: BASE,
    fetch: options.fetch ?? recordingFetch().fetch,
    languages: LANGUAGES,
    capabilities: { contentTranslate: options.contentTranslate ?? true },
    bundleCache: null,
    preferenceStore: options.preferenceStore ?? {
      read: () => Promise.resolve(undefined),
      write: () => Promise.resolve(),
    },
    ...(options.analytics !== undefined ? { analytics: options.analytics } : {}),
    ...(options.schedule !== undefined ? { batchSchedule: options.schedule } : {}),
  });

  let runtime = base;
  if (options.status !== undefined) {
    const seeded = options.status;
    const loader = ((target: string) =>
      base.localeLoader(target)) as RemoteLocaleLoader;
    loader.getStatus = () => seeded;
    loader.subscribe = () => () => undefined;
    loader.getVersion = () => 1;
    runtime = { ...base, localeLoader: loader };
  }

  const engine = createI18n({ locale, loadLocale: runtime.localeLoader });
  registerTranslateI18n(engine, locale);
  if (locale === "ru") registerTranslateI18nRu(engine);
  if (locale === "es") registerTranslateI18nEs(engine);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper(props: { children: ReactNode }): ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nProvider i18n={engine}>
          <TranslateProvider runtime={runtime}>{props.children}</TranslateProvider>
        </I18nProvider>
      </QueryClientProvider>
    );
  }

  return { runtime, i18n: engine, Wrapper };
}
