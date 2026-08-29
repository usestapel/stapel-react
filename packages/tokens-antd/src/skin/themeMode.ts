/**
 * The document-attribute subscriptions the skin substrate themes from.
 *
 * `useThemeMode()` — the mode the document is in RIGHT NOW, and again the
 * moment it changes. `useHostBrand()` — the scoped token set the document is
 * wearing, on the same terms.
 *
 * `resolveThemeMode()` (root export) answers the first question once, at call
 * time, and that was the class defect across nine copied `theme.tsx` files
 * (audit CF-1): every skin read it during render and nothing subscribed, so
 * a runtime theme toggle left already-mounted skins on the old side until
 * something unrelated re-rendered them. These hooks are the subscription.
 *
 * Two signals, not one, because `@stapel/tokens`' generated `tokens.css`
 * keys on two attributes of `<html>` and they are peers: `data-theme` picks
 * the side (`:root` = light, `[data-theme="dark"]` = dark) and `data-brand`
 * picks the ramp (`:root[data-brand="…"]`). Both resolve to the same
 * `--stapel-<role>` custom properties the bridge reads, so a consumer that
 * watches only one of them serves a stale theme whenever the other moves —
 * which is not hypothetical: a multibrand host learns its brand from the
 * network and stamps `data-brand` in an effect, AFTER the render that built
 * the theme, so every antd control kept the fallback brand's colours until
 * something unrelated re-rendered (owner report 2026-08-30, worked around in
 * the host with a private observer this makes unnecessary).
 *
 * ONE MutationObserver serves the whole document, however many components
 * subscribe, and it dispatches per attribute — a `data-brand` change never
 * wakes a theme-mode subscriber, so neither hook pays for the other. It
 * delivers on the next microtask (before paint, so no frame ever shows the
 * old value), and `useSyncExternalStore` makes the first client render read
 * the live value instead of a default.
 *
 * Deliberately NOT `prefers-color-scheme`: the stylesheet ships no media
 * query, so an OS-dark/host-light document would serve light custom
 * properties while this reported dark. The attributes are the only signals
 * that cannot disagree with the stylesheet (see `resolveThemeMode`).
 *
 * `@stapel/shell-react/theme`'s `useDocumentThemeMode` is the same hook plus
 * a synchronous listener for the shell's own applier; it aliases to this one.
 */
import { useSyncExternalStore } from "react";
import {
  BRAND_ATTRIBUTE,
  THEME_ATTRIBUTE,
  hostBrandScope,
  resolveThemeMode,
} from "../index.js";
import type { ThemeMode } from "../index.js";

type Listener = () => void;

/** Subscribers per watched attribute, so each wakes only for its own signal. */
const listeners = new Map<string, Set<Listener>>([
  [THEME_ATTRIBUTE, new Set<Listener>()],
  [BRAND_ATTRIBUTE, new Set<Listener>()],
]);

/** The single observer, created with the first subscriber and disconnected
 * with the last — a host that never mounts a skin pays nothing, and a page
 * of 200 skins pays for one. */
let observer: MutationObserver | null = null;

function subscribeAttribute(attribute: string, onChange: Listener): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => undefined;
  }
  const set = listeners.get(attribute);
  if (set === undefined) return () => undefined;
  set.add(onChange);
  if (observer === null) {
    observer = new MutationObserver((records) => {
      for (const record of records) {
        // A copy, because a listener may unsubscribe (React does, on the
        // unmount a theme change can itself cause) while we are iterating.
        for (const listener of [...(listeners.get(record.attributeName ?? "") ?? [])]) {
          listener();
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [THEME_ATTRIBUTE, BRAND_ATTRIBUTE],
    });
  }
  return () => {
    set.delete(onChange);
    if (observer !== null && [...listeners.values()].every((s) => s.size === 0)) {
      observer.disconnect();
      observer = null;
    }
  };
}

/**
 * Subscribe to `data-theme` changes on the document element. Returns an
 * unsubscribe; a no-op where there is no document. Exported for a non-React
 * consumer (a canvas, a chart library's own theme option).
 */
export function subscribeThemeMode(onChange: () => void): () => void {
  return subscribeAttribute(THEME_ATTRIBUTE, onChange);
}

/**
 * Subscribe to `data-brand` changes on the document element — the scoped
 * token set. Same contract as {@link subscribeThemeMode}, for the other half
 * of what `tokens.css` keys on.
 */
export function subscribeHostBrand(onChange: () => void): () => void {
  return subscribeAttribute(BRAND_ATTRIBUTE, onChange);
}

/** `"light"` where there is no DOM — `tokens.css`' `:root` default, the same
 * answer `resolveThemeMode()` gives on the server. */
function serverThemeMode(): ThemeMode {
  return "light";
}

/** `""` where there is no DOM — no scope, i.e. `tokens.css`' unscoped
 * `:root` ramp, the same answer `hostBrandScope()` gives on the server. */
function serverHostBrand(): string {
  return "";
}

/**
 * The document's theme mode, reactive. Every default skin's `mode` prop
 * defaults to this; a component that renders colours from `toAntdTheme(mode)`
 * or picks a `{light,dark}` half itself reads it here, never `"light"`.
 */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeThemeMode, resolveThemeMode, serverThemeMode);
}

/**
 * The document's brand scope, reactive — `""` when the host declares none.
 *
 * The VALUE is rarely what a caller wants (a skin renders no brand name);
 * the RE-RENDER is. A component that builds anything from the live
 * `--stapel-*` custom properties reads this so that a host stamping
 * `data-brand` after first paint repaints it, exactly as a `data-theme` flip
 * does.
 */
export function useHostBrand(): string {
  return useSyncExternalStore(subscribeHostBrand, hostBrandScope, serverHostBrand);
}
