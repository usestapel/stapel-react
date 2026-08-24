/**
 * `useThemeMode()` — the mode the document is in RIGHT NOW, and again the
 * moment it changes.
 *
 * `resolveThemeMode()` (root export) answers the same question once, at call
 * time, and that was the class defect across nine copied `theme.tsx` files
 * (audit CF-1): every skin read it during render and nothing subscribed, so
 * a runtime theme toggle left already-mounted skins on the old side until
 * something unrelated re-rendered them. This hook is the subscription.
 *
 * One signal: the `data-theme` attribute on `<html>`, the attribute
 * `@stapel/tokens`' `tokens.css` keys its dark block on and the one every
 * applier in the fleet writes (`@stapel/shell-react`'s `applyThemePreference`,
 * a host's pre-paint boot script, the showcase viewer). A MutationObserver on
 * that attribute delivers the change on the next microtask — before paint,
 * so no frame ever shows the old side — and `useSyncExternalStore` makes the
 * first client render read the live value instead of a default.
 *
 * Deliberately NOT `prefers-color-scheme`: the stylesheet ships no media
 * query, so an OS-dark/host-light document would serve light custom
 * properties while this reported dark. The attribute is the only signal that
 * cannot disagree with the stylesheet (see `resolveThemeMode`).
 *
 * `@stapel/shell-react/theme`'s `useDocumentThemeMode` is the same hook plus
 * a synchronous listener for the shell's own applier; it aliases to this one.
 */
import { useSyncExternalStore } from "react";
import { THEME_ATTRIBUTE, resolveThemeMode } from "../index.js";
import type { ThemeMode } from "../index.js";

/**
 * Subscribe to `data-theme` changes on the document element. Returns an
 * unsubscribe; a no-op where there is no document. Exported for a non-React
 * consumer (a canvas, a chart library's own theme option).
 */
export function subscribeThemeMode(onChange: () => void): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => undefined;
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [THEME_ATTRIBUTE],
  });
  return () => {
    observer.disconnect();
  };
}

/** `"light"` where there is no DOM — `tokens.css`' `:root` default, the same
 * answer `resolveThemeMode()` gives on the server. */
function serverThemeMode(): ThemeMode {
  return "light";
}

/**
 * The document's theme mode, reactive. Every default skin's `mode` prop
 * defaults to this; a component that renders colours from `toAntdTheme(mode)`
 * or picks a `{light,dark}` half itself reads it here, never `"light"`.
 */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeThemeMode, resolveThemeMode, serverThemeMode);
}
