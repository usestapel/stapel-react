/**
 * The three small hooks the console needs and nothing else in the fleet has:
 * a translator that survives being mounted outside an `<I18nProvider>`, and
 * two media-query readers.
 */
import { useCallback, useEffect, useState } from "react";
import { useOptionalI18n } from "@stapel/core";
import { brickI18nBundleEn } from "../i18n/keys.js";

/** Resolve one of this package's keys. */
export type BrickTranslate = (key: string) => string;

/**
 * The console's translator. `useT` would be the normal choice, but it throws
 * outside an `<I18nProvider>` — and a waiting screen is exactly the surface a
 * host mounts before (or beside) its provider tree. So the engine is OPTIONAL
 * and the package's own English bundle is the floor: a console without an i18n
 * host reads in English, never in key names.
 */
export function useBrickT(): BrickTranslate {
  const i18n = useOptionalI18n();
  return useCallback(
    (key: string): string => {
      const fromHost = i18n?.getBundle()[key];
      return fromHost ?? brickI18nBundleEn[key] ?? key;
    },
    [i18n]
  );
}

/**
 * A media query as a boolean. Starts `false` and settles in an effect: a
 * server render and the first client frame must agree, and no server knows
 * what kind of pointer is on the other end.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (): void => {
      setMatches(list.matches);
    };
    // `addListener` is the pre-2021 spelling; jsdom stubs and old Safari still
    // ship only that one, and a keypad that never appears on a phone is the
    // whole feature missing.
    if (typeof list.addEventListener === "function") {
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    }
    list.addListener?.(onChange);
    return () => {
      list.removeListener?.(onChange);
    };
  }, [query]);
  return matches;
}

/** True on a touch screen — the console shows its keypad there. */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}

/** True when the person asked the system for less movement. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
