/**
 * The dead-letter park: cases the SCREENING SEAM gave up on, which are not
 * the moderator's queue and must never be counted with it.
 *
 * ── Why this is a second bag and not a filter on the first ────────────────
 *
 * Backend 0.7.0 split "the machine looked and abstained" (`queued`) from "the
 * seam broke and nothing looked at anything" (`dlq`). A dead letter carries no
 * verdict, cannot be decided, and is repaired rather than judged — so it is
 * work an ENGINEER owes, addressed by class of failure, in bulk, once the
 * thing that broke is fixed. {@link useModerationQueue} hands a moderator rows
 * to decide; this hands an engineer a park to empty. Folding them into one
 * list with a state filter is exactly the reading that let a 78% screening
 * failure rate spend twelve days on a client stand looking like a busy queue.
 *
 * ── The optimistic hop is `queued`, not "gone" ────────────────────────────
 *
 * `POST rescan` answers 202: the case is back on the ladder, not decided. So a
 * rescanned row is shown as `queued` where it stands rather than vanishing
 * under the reader's finger — a row that disappears on click cannot be told
 * apart from a row that failed to send. The next refetch removes it, because
 * the list asks for `state=dlq` and it no longer is one.
 *
 * ── One invalidation per GESTURE ──────────────────────────────────────────
 *
 * "Rescan them all" is the row action run once per row (the same call the
 * backend documents — there is no bulk route), so the loop writes N times but
 * refreshes the console ONCE, at the end. A per-row invalidation would refetch
 * the page under itself N times and make the progress count race the list it
 * is counting.
 */
import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  STAPEL_UI_KEYS,
  actionAvailable,
  actionBlocked,
  mapLoad,
  useFlow,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { Case, Stats } from "../api/types.js";
import { createTriageFlow, triageRefused } from "../flows/triageFlow.js";
import type { TriageFlowState } from "../flows/triageFlow.js";
import { MODERATION_I18N_KEYS } from "../i18n/keys.js";
import { useModerationAnalytics, useModerationApi } from "../model/context.js";
import { loadOf, useCasesQuery, useStatsQuery } from "../model/queries.js";
import { moderationQueryKeys } from "../model/queryKeys.js";
import { isStaffOnly } from "../model/refusals.js";
import type { QueueAccess } from "./useModerationQueue.js";

/** The state a rescanned row is shown in before the list refetches. */
const REVIVED_STATE = "queued" as const;

/** One class of failure, and the cases it is holding. */
export interface DlqGroup {
  /** `Case.last_error_class` — a Python exception name from a CLOSED
   * vocabulary (`services.ERROR_CLASSES`), never prose, and `""` only for a
   * row parked before the class was recorded. */
  readonly errorClass: string;
  readonly rows: readonly Case[];
  readonly count: number;
}

/** How far "rescan them all" has got. `total` is fixed when the run starts. */
export interface DlqRescanProgress {
  readonly running: boolean;
  readonly done: number;
  readonly total: number;
  /** Rows the server refused. They stay in the park, which is the truth. */
  readonly failed: number;
}

export interface ModerationDlqBag {
  /** The park, with rescanned rows already reading `queued`. */
  readonly rows: LoadState<readonly Case[]>;
  /** The same rows, grouped by what broke — the axis an engineer repairs on. */
  readonly groups: readonly DlqGroup[];
  /** `undefined` = every class. Sent as `?error_class=`. */
  readonly errorClass: string | undefined;
  readonly setErrorClass: (value: string | undefined) => void;
  readonly hasMore: boolean;
  readonly loadMore: ActionAvailability;
  readonly runLoadMore: () => void;
  readonly refetch: () => void;
  readonly access: QueueAccess;
  /** Whether one row may be sent back. Shut while a bulk run is walking. */
  readonly rescan: ActionAvailability;
  readonly runRescan: (caseId: string) => void;
  /** Shut when the park is empty or a run is already walking. */
  readonly rescanAll: ActionAvailability;
  readonly runRescanAll: () => void;
  readonly progress: DlqRescanProgress;
  readonly state: TriageFlowState;
  /** The counters, so the console header can print `dlq_total` BESIDE
   * `queue_total` and never the sum of the two. */
  readonly stats: LoadState<Stats>;
}

const IDLE: DlqRescanProgress = {
  running: false,
  done: 0,
  total: 0,
  failed: 0,
};

/**
 * Group the loaded page by `last_error_class`.
 *
 * Rows within a group are ordered by `dlq_at` ASCENDING — the longest-broken
 * case first, because "since when" is the question an engineer opens this on
 * and the wire order (`-created_at`) answers a different one. Groups are
 * ordered by size, biggest first: with two unrelated faults running at once
 * (the case this whole state was built for), the one holding the most cases is
 * the one to repair first.
 */
export function groupByErrorClass(rows: readonly Case[]): readonly DlqGroup[] {
  const byClass = new Map<string, Case[]>();
  for (const row of rows) {
    const key = row.last_error_class ?? "";
    const bucket = byClass.get(key);
    if (bucket === undefined) byClass.set(key, [row]);
    else bucket.push(row);
  }
  return [...byClass.entries()]
    .map(([errorClass, group]) => ({
      errorClass,
      rows: [...group].sort(
        (a, b) => Date.parse(a.dlq_at ?? "") - Date.parse(b.dlq_at ?? "")
      ),
      count: group.length,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (a.errorClass < b.errorClass ? -1 : a.errorClass > b.errorClass ? 1 : 0)
    );
}

export function useModerationDlq(): ModerationDlqBag {
  const api = useModerationApi();
  const client = useQueryClient();
  const analytics = useModerationAnalytics();
  const machine = useMemo(() => createTriageFlow({ analytics }), [analytics]);
  const state = useFlow(machine);

  const [errorClass, setErrorClass] = useState<string | undefined>(undefined);
  const [revived, setRevived] = useState<readonly string[]>([]);
  const [progress, setProgress] = useState<DlqRescanProgress>(IDLE);

  const page = useCasesQuery({
    state: "dlq",
    ...(errorClass !== undefined ? { errorClass } : {}),
  });
  const stats = useStatsQuery();

  const rows: LoadState<readonly Case[]> = useMemo(
    () =>
      revived.length === 0
        ? page.rows
        : mapLoad(page.rows, (loaded) =>
            loaded.map((row) =>
              revived.includes(row.id) ? { ...row, state: REVIVED_STATE } : row
            )
          ),
    [page.rows, revived]
  );

  const groups = useMemo(
    () => (rows.status === "ready" ? groupByErrorClass(rows.data) : []),
    [rows]
  );

  const access: QueueAccess = useMemo(() => {
    if (page.rows.status === "failed") {
      return isStaffOnly(page.rows.error) ? "staff_only" : "unknown";
    }
    return page.rows.status === "ready" ? "ok" : "unknown";
  }, [page.rows]);

  /** The console is stale after a revive: the park shrank, so did `dlq_total`,
   * and the human queue grew by exactly the same cases. */
  const invalidate = useCallback((): void => {
    void client.invalidateQueries({ queryKey: moderationQueryKeys.cases });
    void client.invalidateQueries({ queryKey: moderationQueryKeys.stats });
  }, [client]);

  /**
   * One revive. Marks the row optimistically, and unmarks it if the server
   * refuses — a row that stays in the park must not read as sent back.
   * Answers the refusal rather than throwing it, because the bulk loop has to
   * carry on past one bad row and still know how many it left behind.
   */
  const reviveOne = useCallback(
    async (caseId: string): Promise<unknown> => {
      setRevived((current) =>
        current.includes(caseId) ? current : [...current, caseId]
      );
      try {
        await api.rescan(caseId);
        return null;
      } catch (error) {
        setRevived((current) => current.filter((id) => id !== caseId));
        return error;
      }
    },
    [api]
  );

  const busy = progress.running;
  const rescan: ActionAvailability = busy
    ? actionBlocked(MODERATION_I18N_KEYS.dlqRescanningAll)
    : actionAvailable();

  const runRescan = useCallback(
    (caseId: string): void => {
      if (busy) return;
      void machine.run(
        { step: "claiming" },
        async () => {
          const error = await reviveOne(caseId);
          if (error !== null) throw error;
          invalidate();
        },
        {
          resolve: () => ({ step: "screening" }),
          reject: (error) => triageRefused(error),
        }
      );
    },
    [busy, invalidate, machine, reviveOne]
  );

  /** The rows a bulk run would touch: loaded, and not already sent back. */
  const pending: readonly Case[] = useMemo(
    () =>
      rows.status === "ready"
        ? rows.data.filter((row) => !revived.includes(row.id))
        : [],
    [rows, revived]
  );

  const rescanAll: ActionAvailability = busy
    ? actionBlocked(STAPEL_UI_KEYS.loading)
    : pending.length === 0
      ? actionBlocked(MODERATION_I18N_KEYS.dlqNothingToRescan)
      : actionAvailable();

  const runRescanAll = useCallback((): void => {
    if (busy) return;
    const targets = pending.map((row) => row.id);
    if (targets.length === 0) return;
    setProgress({ running: true, done: 0, total: targets.length, failed: 0 });
    void machine.run(
      { step: "claiming" },
      async () => {
        let failed = 0;
        let lastError: unknown = null;
        // Sequential on purpose: the park is emptied because a seam was just
        // repaired, and firing a page of re-screens at it all at once is how a
        // recovering dependency gets knocked over a second time.
        for (const [index, caseId] of targets.entries()) {
          const error = await reviveOne(caseId);
          if (error !== null) {
            failed += 1;
            lastError = error;
          }
          setProgress({
            running: true,
            done: index + 1,
            total: targets.length,
            failed,
          });
        }
        setProgress((current) => ({ ...current, running: false }));
        invalidate();
        // The count of what stayed behind is on the glass either way; the
        // refusal is raised so the reader is told WHY, not only how many.
        if (lastError !== null) throw lastError;
      },
      {
        resolve: () => ({ step: "screening" }),
        reject: (error) => triageRefused(error),
      }
    );
  }, [busy, invalidate, machine, pending, reviveOne]);

  return {
    rows,
    groups,
    errorClass,
    setErrorClass: useCallback((value: string | undefined) => {
      setErrorClass(value);
      // The optimistic marks belong to the page they were made on: a row
      // revived under one filter is a different row's neighbour under the next.
      setRevived([]);
    }, []),
    hasMore: page.hasMore,
    loadMore: page.loadingMore
      ? actionBlocked(STAPEL_UI_KEYS.loading)
      : actionAvailable(),
    runLoadMore: useCallback(() => {
      page.loadMore();
    }, [page]),
    refetch: useCallback(() => {
      setRevived([]);
      page.refetch();
    }, [page]),
    access,
    rescan,
    runRescan,
    rescanAll,
    runRescanAll,
    progress,
    state,
    stats: loadOf(stats),
  };
}
