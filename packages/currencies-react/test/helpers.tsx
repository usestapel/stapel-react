import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { CurrenciesProvider, createCurrenciesRuntime } from "../src/index.js";
import { registerCurrenciesI18n } from "../src/i18n/keys.js";
import { registerCurrenciesI18nRu } from "../src/i18n/ru.js";
import { registerCurrenciesI18nEs } from "../src/i18n/es.js";

export const CATALOG: readonly Record<string, unknown>[] = [
  { code: "USD", display_name: "currency.usd", symbol: "$", value: "1.00000000", is_active: true },
  { code: "EUR", display_name: "currency.eur", symbol: "€", value: "0.93000000", is_active: true },
  { code: "RUB", display_name: "currency.rub", symbol: "₽", value: "92.59000000", is_active: true },
];

/** A canned `fetch` — the WIRE is mocked, the client and hooks are real. */
export function catalogFetch(
  body: unknown = CATALOG,
  status = 200
): typeof globalThis.fetch {
  return (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    )) as typeof globalThis.fetch;
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

export function Harness(props: {
  children: ReactNode;
  locale?: string;
  fetch?: typeof globalThis.fetch;
}): ReactElement {
  const locale = props.locale ?? "en";
  const engine = createI18n({ locale });
  registerCurrenciesI18n(engine);
  if (locale === "ru") registerCurrenciesI18nRu(engine);
  if (locale === "es") registerCurrenciesI18nEs(engine);
  const runtime = createCurrenciesRuntime({
    baseUrl: "/currencies/",
    fetch: props.fetch ?? catalogFetch(),
    // The preference store is not under test here; a stub keeps the skin tests
    // free of IndexedDB and of a session manager they do not need.
    displayCurrencyStore: {
      read: () => Promise.resolve(undefined),
      write: () => Promise.resolve(),
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={engine}>
        <CurrenciesProvider runtime={runtime}>{props.children}</CurrenciesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
