/**
 * The interface language, as a bag a skin renders.
 *
 * Switching a language here is three things at once, and all three have to
 * happen or the switch is a lie:
 *
 *  1. core's i18n engine loads the locale — which, with this pair's
 *     `runtime.localeLoader` wired in, means downloading the bundle from
 *     stapel-translate (or reading the one stored on the device);
 *  2. the choice is remembered, in the scope the viewer's session justifies
 *     (`model/preference.ts`);
 *  3. `<html lang>` is updated, so screen readers change voice and the
 *     browser offers the right dictionary — the half everybody forgets, and
 *     the only one a person using a screen reader notices immediately.
 *
 * The bag also reports the LOADER's outcome (`partial`), because a switch that
 * fell back to the in-package copy is a switch that half worked, and a person
 * who just chose Spanish and got an English menu deserves to be told which of
 * the two happened.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@stapel/core";
import { TRANSLATE_EVENTS } from "../analytics/events.js";
import { useTranslateAnalytics, useTranslateRuntime } from "../model/context.js";
import type { LanguageOption } from "../model/runtime.js";
import type { RemoteLocaleStatus } from "../model/localeLoader.js";
import { useCurrentLocale } from "./useCurrentLocale.js";
import { useLocaleStatus } from "./useRemoteLocale.js";

export interface LanguageBag {
  /** The locale in effect right now. */
  readonly code: string;
  /** What a person may choose — the deployment's list, not the module's. */
  readonly options: readonly LanguageOption[];
  /** A switch is in flight (the bundle is downloading). */
  readonly switching: boolean;
  /** The loader's outcome for the current locale, once it has one. */
  readonly status: RemoteLocaleStatus | undefined;
  /**
   * True when the copy in effect did NOT come from the server: the switch
   * applied, and some texts will read in English. A skin says so beside the
   * control; it does not silently pretend.
   */
  readonly partial: boolean;
  setCode: (next: string) => void;
}

export function useLanguage(): LanguageBag {
  const runtime = useTranslateRuntime();
  const analytics = useTranslateAnalytics();
  const engine = useI18n();
  const code = useCurrentLocale();
  const status = useLocaleStatus(code);
  const [switching, setSwitching] = useState(false);

  const setCode = useCallback(
    (next: string) => {
      if (next === engine.locale) return;
      const from = engine.locale;
      setSwitching(true);
      analytics?.track(TRANSLATE_EVENTS.languageChanged, { from, to: next });
      void engine
        .setLocale(next)
        .catch(() => {
          // The loader itself never rejects (it has a fallback ladder); this
          // guards a host loader that does. The locale still applies — copy in
          // English beats a switch that silently did nothing.
        })
        .finally(() => {
          setSwitching(false);
        });
      void runtime.preferences.write(next).catch(() => {
        // Persisting failed (private mode, quota). The choice still applies to
        // this session: refusing to change the language because the browser
        // will not remember it would be the wrong trade.
      });
      if (typeof document !== "undefined") {
        document.documentElement.lang = next;
      }
    },
    [analytics, engine, runtime]
  );

  // The stored choice arrives asynchronously (the repository is IndexedDB /
  // localStorage behind a promise) while the engine already has a locale — so
  // this applies it once, on mount, rather than blocking the first render.
  useEffect(() => {
    let live = true;
    void runtime.preferences
      .read()
      .then((stored) => {
        if (
          live &&
          stored !== undefined &&
          stored.length > 0 &&
          stored !== engine.locale
        ) {
          setCode(stored);
        }
      })
      .catch(() => {
        // A store that cannot be read is not an error a person can act on: the
        // engine's current locale is a correct answer.
      });
    return () => {
      live = false;
    };
    // Every dependency here is stable for the life of the provider (the
    // runtime, the engine, and a `setCode` that closes over both), so this
    // runs once per mount — it must not re-run on a locale change, or it
    // would fight the change that was just made.
  }, [runtime, engine, setCode]);

  const partial = useMemo(
    () => status !== undefined && status.source === "fallback",
    [status]
  );

  return {
    code,
    options: runtime.languages,
    switching,
    status,
    partial,
    setCode,
  };
}
