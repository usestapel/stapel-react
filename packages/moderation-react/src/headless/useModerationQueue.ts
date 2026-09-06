/**
 * The console's queue bag: filters, keyset pages, counters, and the ONE
 * refusal the nav axis cannot express.
 *
 * ── "staff only" is a state of this screen, not an error of it ────────────
 *
 * `GET cases` is behind the moderation mandate, and a signed-in person without
 * it gets a 403 — `moderation_forbidden` from the module's own guard, or
 * core's generic `forbidden`. The nav surface axis has `public | member` and
 * no way to say "staff", so a container legitimately routes an ordinary member
 * here. Rendering that as an operations failure would blame somebody for using
 * the wrong account; {@link ModerationQueueBag.access} names it instead.
 *
 * ── This bag ALWAYS names a state, and it is never `dlq` ──────────────────
 *
 * Backend 0.7.0 made an unfiltered `GET cases` return dead-lettered rows
 * beside the human queue. This screen used to send no `state` at all, so on
 * the day that release lands it would have grown an outage's worth of rows a
 * moderator cannot act on, wearing the same clothes as work. {@link
 * asCaseFilters} therefore fills {@link DEFAULT_QUEUE_STATE} in whenever the
 * caller left the field empty — in the MECHANISM, not in the screen, so no
 * host and no "clear all" button can reach the mixture by accident. The park
 * has its own bag ({@link useModerationDlq}) and its own tab.
 */
import { useCallback, useMemo, useState } from "react";
import {
  STAPEL_UI_KEYS,
  actionAvailable,
  actionBlocked,
  mapLoad,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { CaseFilters } from "../api/moderationApi.js";
import type { Case, PolicyReason, Stats } from "../api/types.js";
import { useModerationRuntime } from "../model/context.js";
import { loadOf, useCasesQuery, usePolicy, useStatsQuery } from "../model/queries.js";
import { isStaffOnly } from "../model/refusals.js";

/**
 * What the queue's filter bar edits.
 *
 * Spelled with explicit `| undefined` rather than as `Omit<CaseFilters, …>`
 * because a filter bar CLEARS fields, and under `exactOptionalPropertyTypes`
 * "the key is absent" and "the key is undefined" are different types — a
 * control that sets a field back to `undefined` could not otherwise typecheck.
 * {@link useModerationQueue} drops the undefined keys before the request, so
 * "no filter" and "an empty filter" still produce the same URL.
 */
export interface QueueFilters {
  readonly state?: string | undefined;
  readonly targetType?: string | undefined;
  readonly reasonCode?: string | undefined;
  readonly scopeKey?: string | undefined;
  readonly severityMin?: number | undefined;
  readonly subjectUserId?: string | undefined;
}

/** Whether this account may read the queue at all. `"unknown"` while the first
 * page is still in flight — a door is not locked until somebody tried it. */
export type QueueAccess = "ok" | "staff_only" | "unknown";

/**
 * What the moderator queue asks for when nothing else was chosen.
 *
 * `"queued"` is the backend's own name for the human queue (`views.CaseListView`
 * docstring, backend 0.7.0). Not `""`: an empty state is "every state", which
 * now includes the dead-letter park.
 */
export const DEFAULT_QUEUE_STATE = "queued";

export interface ModerationQueueBag {
  readonly rows: LoadState<readonly Case[]>;
  readonly filters: QueueFilters;
  readonly setFilters: (next: QueueFilters) => void;
  readonly hasMore: boolean;
  readonly loadMore: ActionAvailability;
  readonly runLoadMore: () => void;
  readonly refetch: () => void;
  readonly stats: LoadState<Stats>;
  readonly access: QueueAccess;
  /** The target types this deployment registered — a HOST seam: no endpoint
   * lists them, so an unfilled one means the filter says so and stays off. */
  readonly targetTypes: readonly string[] | undefined;
  readonly reasons: LoadState<readonly PolicyReason[]>;
}

/**
 * Drop the cleared keys: an absent filter must not become `?state=undefined`.
 *
 * `state` is the exception — it is filled in rather than dropped, because for
 * this list "no state" is not "no filter", it is "the park too".
 */
function asCaseFilters(filters: QueueFilters): CaseFilters {
  return {
    state:
      filters.state !== undefined && filters.state !== ""
        ? filters.state
        : DEFAULT_QUEUE_STATE,
    ...(filters.targetType !== undefined ? { targetType: filters.targetType } : {}),
    ...(filters.reasonCode !== undefined ? { reasonCode: filters.reasonCode } : {}),
    ...(filters.scopeKey !== undefined ? { scopeKey: filters.scopeKey } : {}),
    ...(filters.severityMin !== undefined ? { severityMin: filters.severityMin } : {}),
    ...(filters.subjectUserId !== undefined
      ? { subjectUserId: filters.subjectUserId }
      : {}),
  };
}

export function useModerationQueue(
  initial: QueueFilters = {}
): ModerationQueueBag {
  const runtime = useModerationRuntime();
  const [filters, setFilters] = useState<QueueFilters>({
    state: DEFAULT_QUEUE_STATE,
    ...initial,
  });
  const page = useCasesQuery(asCaseFilters(filters));
  const stats = useStatsQuery();
  const policy = usePolicy();

  const access: QueueAccess = useMemo(() => {
    if (page.rows.status === "failed") {
      return isStaffOnly(page.rows.error) ? "staff_only" : "unknown";
    }
    return page.rows.status === "ready" ? "ok" : "unknown";
  }, [page.rows]);

  return {
    rows: page.rows,
    filters,
    setFilters,
    hasMore: page.hasMore,
    loadMore: page.loadingMore
      ? actionBlocked(STAPEL_UI_KEYS.loading)
      : actionAvailable(),
    runLoadMore: useCallback(() => {
      page.loadMore();
    }, [page]),
    refetch: useCallback(() => {
      page.refetch();
    }, [page]),
    stats: loadOf(stats),
    access,
    targetTypes: runtime.targetTypes,
    reasons: mapLoad(loadOf(policy), (disclosure) => disclosure.reasons),
  };
}
