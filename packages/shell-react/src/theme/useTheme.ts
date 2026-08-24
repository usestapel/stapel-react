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
 *
 * ── Why the reader is an ALIAS and not an implementation ──────────────────
 *
 * "What mode is this document in" had two answers in one layer: this module's
 * `useDocumentThemeMode` and `@stapel/tokens-antd/skin`'s `useThemeMode`,
 * which every default skin in the fleet reads. Two subscriptions to one
 * attribute is the class of defect the shared-layer audit names — they cannot
 * disagree today and will the first time one of them is fixed. So there is
 * one implementation, it lives beside the skins that depend on it hardest,
 * and this name is kept as its alias: a host that imported
 * `useDocumentThemeMode` keeps working, and the shell's control and a pair's
 * skin now flip on the same store notification rather than on two.
 *
 * `@stapel/tokens-antd` is a peer this package already declares. Its `/skin`
 * entry is `sideEffects: false`, so a bundler that only sees this import
 * drops the antd surfaces re-exported beside the hook: `/theme` stays the
 * plain-DOM control it advertises.
 */
import { useLayoutEffect } from "react";
import { useThemeMode } from "@stapel/tokens-antd/skin";

import {
  applyThemePreference,
  watchSystemTheme,
  type ApplyThemeOptions,
  type ThemeMode,
  type ThemePreference,
} from "./preference.js";

/**
 * The mode the document is stamped with, live — the fleet's single reader
 * (`@stapel/tokens-antd/skin`'s `useThemeMode`), re-exported under the name
 * this subpath has always published. It observes `data-theme` on `<html>`,
 * which is what {@link applyThemePreference} writes, what a host's pre-paint
 * boot script writes, and what `@stapel/tokens`' generated CSS keys its dark
 * block on.
 */
export const useDocumentThemeMode: () => ThemeMode = useThemeMode;

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
