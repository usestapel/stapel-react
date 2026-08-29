/**
 * Shared test environment for the skin substrate suites.
 *
 * The viewport is mocked at the ENVIRONMENT edge — `window.innerWidth` plus a
 * `matchMedia` that evaluates `(min-width: N)` against it — never by stubbing
 * the hooks, so a suite fails if a hook's query and `@stapel/tokens`'
 * breakpoints ever disagree. The i18n host is core's real engine with no
 * bundles registered: every sentence the substrate renders comes from the
 * floor, which is the claim under test.
 */
import { act } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";

type Listener = () => void;
const listeners = new Set<Listener>();

export function installMatchMedia(): void {
  window.matchMedia = ((query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const matches = (): boolean =>
      min === null ? false : window.innerWidth >= Number(min[1]);
    return {
      get matches() {
        return matches();
      },
      media: query,
      onchange: null,
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l),
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
}

export function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  act(() => {
    for (const l of [...listeners]) l();
    window.dispatchEvent(new Event("resize"));
  });
}

export function resetViewportListeners(): void {
  listeners.clear();
}

/** Stamp the document's theme and let the MutationObserver deliver it. */
export async function setDocumentTheme(mode: "light" | "dark" | null): Promise<void> {
  await act(async () => {
    if (mode === null) document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    await Promise.resolve();
  });
}

/** Stamp the document's brand scope (`<html data-brand>`) and let the
 * MutationObserver deliver it. */
export async function setDocumentBrand(brand: string | null): Promise<void> {
  await act(async () => {
    if (brand === null) document.documentElement.removeAttribute("data-brand");
    else document.documentElement.setAttribute("data-brand", brand);
    await Promise.resolve();
  });
}

export function makeI18n(locale = "en"): I18nEngine {
  return createI18n({ locale });
}

export function Host(props: { locale?: string; i18n?: I18nEngine; children: ReactNode }): ReactElement {
  return (
    <I18nProvider i18n={props.i18n ?? makeI18n(props.locale)}>{props.children}</I18nProvider>
  );
}
