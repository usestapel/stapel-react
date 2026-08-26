/**
 * What the remote loader actually did for a locale, as a `LoadState` a skin
 * renders with `LoadBoundary`.
 *
 * The loader is not a query: core's i18n engine calls it, once per locale, at
 * whatever moment somebody switches. Asking react-query to fetch the bundle a
 * SECOND time so a chip could show its size would download it twice and could
 * disagree with the copy on screen. So the loader publishes what it did and
 * this hook subscribes — one download, one truth.
 *
 * The three rungs map onto the state a person can act on:
 *
 *   no status yet          loading — the switch is in flight;
 *   network / cache        ready — with `source`/`stale` in the payload, so
 *                          `<TranslationStatus/>` can say "saved on this
 *                          device" instead of implying it came from the server;
 *   fallback               failed — nothing was downloaded and nothing was
 *                          stored: the app is on its built-in English, and
 *                          that is a fault worth an alert with a retry.
 */
import { useMemo, useSyncExternalStore } from "react";
import { loadFailed, loadLoading, loadReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { useTranslateRuntime } from "../model/context.js";
import type { RemoteLocaleStatus } from "../model/localeLoader.js";
import { useCurrentLocale } from "./useCurrentLocale.js";

/** The loader's raw outcome for one locale, subscribed. */
export function useLocaleStatus(locale: string): RemoteLocaleStatus | undefined {
  const runtime = useTranslateRuntime();
  const loader = runtime.localeLoader;
  const version = useSyncExternalStore(
    loader.subscribe,
    loader.getVersion,
    loader.getVersion
  );
  return useMemo(() => {
    void version; // the counter is the invalidation signal, not the value
    return loader.getStatus(locale);
  }, [loader, locale, version]);
}

/**
 * The loaded bundle's status as a `LoadState` (defaults to the locale in
 * effect). `<TranslationStatus/>` renders exactly this.
 */
export function useRemoteLocale(
  locale?: string
): LoadState<RemoteLocaleStatus> {
  const current = useCurrentLocale();
  const target = locale ?? current;
  const status = useLocaleStatus(target);

  if (status === undefined) return loadLoading();
  if (status.source === "fallback") return loadFailed(status.error);
  return loadReady(status);
}
