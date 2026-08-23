import { useQuery } from "@tanstack/react-query";
import {
  loadedRowsOrEmpty,
  mapLoad,
  loadStateFromQuery,
  useActiveSessionReady,
} from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { ScopeUsageRow } from "../api/types.js";
import { useVideoApi } from "./context.js";
import { usageQueryKeys } from "./queryKeys.js";
import {
  DEFAULT_USAGE_MONTHS,
  DEFAULT_USAGE_TZ,
  normalizeScopeUsage,
  usageMonth,
  usageMonthLabels,
} from "./usage.js";
import type { ScopeUsageAnswer } from "./usage.js";

export interface UseScopeUsageOptions {
  /** How many calendar months the selector offers, newest first (1..36). */
  readonly months?: number;
  /**
   * The month to SHOW, `YYYY-MM`. Changing it issues its own request — the
   * server is the authority on one month's numbers, and the window answer is
   * not re-fetched to get them.
   */
  readonly month?: string;
  /** IANA zone the buckets are cut in. Default `UTC`, as the view's is. */
  readonly tz?: string;
  /** Set `false` to hold the reads (e.g. the scope is not resolved yet). */
  readonly enabled?: boolean;
}

export interface ScopeUsageBag {
  /** The answer the table is rendering — the month read when a month is
   * selected, the window read otherwise. */
  readonly state: LoadState<ScopeUsageAnswer>;
  /** The shown month's rows, longest presence first. */
  readonly rows: LoadState<readonly ScopeUsageRow[]>;
  /** The month selector's options, newest first — always from the WINDOW
   * read, so clicking through months never shrinks the list to one. */
  readonly monthLabels: readonly string[];
  /** The label actually on screen (`undefined` before an answer lands, or
   * when the scope has no months at all). */
  readonly month: string | undefined;
  /** The zone the shown numbers were cut in. */
  readonly tz: string;
  readonly refetch: () => void;
}

/**
 * One partition's per-month, per-person call time.
 *
 * ── Two queries, on purpose ───────────────────────────────────────────────
 *
 * The WINDOW read (`?months=N`) supplies the month selector's options and is
 * cached under its own key; the MONTH read (`?month=YYYY-MM`) supplies the
 * rows on screen. A single query could not do both: `?month=` answers a
 * one-element `months` list, so a selector fed from it would collapse to the
 * month already chosen the first time anyone used it, and a selector fed from
 * a window that re-fetched on every click would re-ask for six months to
 * render one.
 *
 * The month read is `enabled` only once a month is chosen, so the first paint
 * is one request, not two.
 *
 * ── Gated on the session, like every mandate-gated read ───────────────────
 *
 * The view is `HasWorkspaceMandateIfScoped`: anonymous is refused in every
 * deployment shape. A read that raced a still-bootstrapping session would
 * therefore answer 404 — the SAME 404 that means "not available for this
 * workspace" — and the screen would blame the workspace for a race.
 * `useActiveSessionReady()` settles first and returns immediately when no
 * session-owning module is mounted at all.
 */
export function useScopeUsage(
  scopeKey: string,
  options: UseScopeUsageOptions = {}
): ScopeUsageBag {
  const api = useVideoApi();
  const sessionReady = useActiveSessionReady();
  const months = options.months ?? DEFAULT_USAGE_MONTHS;
  const tz = options.tz ?? DEFAULT_USAGE_TZ;
  const addressable = scopeKey.length > 0;
  const enabled = sessionReady && addressable && (options.enabled ?? true);

  const windowQuery = useQuery({
    queryKey: usageQueryKeys.window(scopeKey, months, tz),
    queryFn: ({ signal }) =>
      api
        .scopeUsage(scopeKey, { kind: "window", months, tz }, { signal })
        .then(normalizeScopeUsage),
    enabled,
  });

  const selected = options.month;
  const monthQuery = useQuery({
    queryKey: usageQueryKeys.month(scopeKey, selected ?? "", tz),
    queryFn: ({ signal }) =>
      api
        .scopeUsage(
          scopeKey,
          { kind: "month", month: selected ?? "", tz },
          { signal }
        )
        .then(normalizeScopeUsage),
    enabled: enabled && selected !== undefined,
  });

  const windowState = loadStateFromQuery(windowQuery);
  const state =
    selected !== undefined ? loadStateFromQuery(monthQuery) : windowState;

  // The selector's options genuinely do not discriminate — an empty list means
  // "offer nothing to click", which is the right answer while the window is in
  // flight AND when it failed. The ROWS below keep the discrimination, and
  // they are what the screen is actually about.
  const monthLabels = loadedRowsOrEmpty(mapLoad(windowState, usageMonthLabels));

  const shown = state.status === "ready" ? usageMonth(state.data, selected) : undefined;

  return {
    state,
    rows: mapLoad(state, (answer) => usageMonth(answer, selected)?.rows ?? []),
    monthLabels,
    month: shown?.month,
    tz,
    refetch: () => {
      void windowQuery.refetch();
      if (selected !== undefined) void monthQuery.refetch();
    },
  };
}
