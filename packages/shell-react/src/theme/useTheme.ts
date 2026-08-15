/**
 * React seams for the theme preference.
 *
 * Two hooks, deliberately split by whether they WRITE:
 *
 *   * {@link useThemePreference} applies a preference to the document and
 *     keeps following the OS while it is `system`. A host calls it once,
 *     with whatever it treats as the source of truth (a profile field, a
 *     store, local state) — the library never fetches or PATCHes that field
 *     itself, because the host already owns its profile client and a second
 *     writer is how two controls end up disagreeing.
 *   * {@link useDocumentThemeMode} only READS the mode the document is
 *     stamped with. `<ThemeModeControl/>` uses it, so mounting a control
 *     never changes the theme as a side effect of rendering.
 */
import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";

import {
  applyThemePreference,
  documentThemeMode,
  subscribeThemeStamp,
  THEME_ATTRIBUTE,
  watchSystemTheme,
  type ApplyThemeOptions,
  type ThemeMode,
  type ThemePreference,
} from "./preference.js";

/**
 * Apply *preference*, and keep applying it as the OS changes while it is
 * `system`. Returns the mode the document is rendering.
 */
export function useThemePreference(
  preference: ThemePreference,
  options: ApplyThemeOptions = {},
): ThemeMode {
  const persist = options.persist;
  // Joined so a fresh array literal from the caller does not re-run the
  // effect on every render.
  const classKey = options.darkClasses?.join(" ");

  // Layout, not passive: the stamp must land before paint, and before the
  // control's own subscription reads it back.
  useLayoutEffect(() => {
    const opts: ApplyThemeOptions = {
      ...(classKey === undefined
        ? {}
        : { darkClasses: classKey === "" ? [] : classKey.split(" ") }),
      ...(persist === undefined ? {} : { persist }),
    };
    applyThemePreference(preference, opts);
    return watchSystemTheme(preference, opts);
  }, [preference, persist, classKey]);

  // Read back from the document rather than remembering what was applied:
  // the OS watcher above re-stamps it, and so may a boot script or a second
  // host surface. One source, so they cannot disagree.
  return useDocumentThemeMode();
}

/**
 * The mode the document is stamped with. Two subscriptions, because there
 * are two kinds of writer: {@link subscribeThemeStamp} for this module's own
 * applier (synchronous — a MutationObserver alone would deliver it a
 * microtask late, and the control would render a mode the page had already
 * left), and a MutationObserver on {@link THEME_ATTRIBUTE} for everyone else
 * — a pre-paint boot script, a host's own applier.
 */
export function useDocumentThemeMode(): ThemeMode {
  const subscribe = useCallback((onChange: () => void) => {
    const unsubscribe = subscribeThemeStamp(onChange);
    if (typeof document === "undefined") return unsubscribe;
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [THEME_ATTRIBUTE],
    });
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, []);

  return useSyncExternalStore(subscribe, documentThemeMode, () => "light");
}
