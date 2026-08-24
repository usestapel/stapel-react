import { useCallback, useEffect, useState } from "react";
import type { LoadState } from "@stapel/core";
import { useCurrenciesAnalytics, useCurrenciesRuntime } from "../model/context.js";
import { useCurrencies } from "../model/queries.js";
import { CURRENCIES_EVENTS } from "../analytics/events.js";
import type { Currency } from "../api/types.js";

export interface DisplayCurrencyBag {
  /** The currency amounts are shown in. Starts at the deployment's base and
   * becomes the stored choice once it has been read back. */
  readonly code: string;
  setCode: (next: string) => void;
  /** The catalogue to choose from — a picker renders its own load states. */
  readonly options: LoadState<readonly Currency[]>;
  refetch: () => void;
}

/**
 * The viewer's display currency, read from and written to the pair's
 * preference store.
 *
 * The stored value arrives asynchronously (the repository is IndexedDB /
 * localStorage behind a promise) while the base currency is available on the
 * first frame — so the hook starts at the base and switches once, rather than
 * rendering an empty picker until storage answers.
 */
export function useDisplayCurrency(): DisplayCurrencyBag {
  const runtime = useCurrenciesRuntime();
  const analytics = useCurrenciesAnalytics();
  const { state, refetch } = useCurrencies();
  const [code, setLocal] = useState(runtime.money.baseCurrency);

  useEffect(() => {
    let live = true;
    void runtime.displayCurrency
      .read()
      .then((stored) => {
        if (live && stored !== undefined && stored.length > 0) {
          setLocal(stored.toUpperCase());
        }
      })
      .catch(() => {
        // A store that cannot be read is not an error a person can act on:
        // the base currency is a correct answer, so the screen keeps working.
      });
    return () => {
      live = false;
    };
  }, [runtime]);

  const setCode = useCallback(
    (next: string) => {
      const normalized = next.toUpperCase();
      setLocal(normalized);
      analytics?.track(CURRENCIES_EVENTS.displayChanged, { code: normalized });
      void runtime.displayCurrency.write(normalized).catch(() => {
        // Persisting failed (private mode, quota). The choice still applies to
        // this session — refusing to change the display because the browser
        // will not remember it would be the wrong trade.
      });
    },
    [runtime, analytics]
  );

  return { code, setCode, options: state, refetch };
}
