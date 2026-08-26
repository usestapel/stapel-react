/**
 * The locale in effect, read REACTIVELY.
 *
 * `useI18n().locale` is a property of a mutable engine: a component that reads
 * it directly renders the locale that was current when it happened to mount
 * and never hears about the switch. `useT()` subscribes for its own reasons
 * (it needs to re-render when a bundle is registered) but hands back a
 * function, not the tag — so the tag needs its own subscription, and this is
 * it. One line, in one place, rather than a `useSyncExternalStore` in every
 * component that needs to know which language it is drawing.
 */
import { useSyncExternalStore } from "react";
import { useI18n } from "@stapel/core";

export function useCurrentLocale(): string {
  const engine = useI18n();
  const read = (): string => engine.locale;
  return useSyncExternalStore(engine.subscribe, read, read);
}
