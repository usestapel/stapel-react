import { useQuery } from "@tanstack/react-query";
import { loadStateFromQuery, useActiveSessionReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { DataOwnerHealth } from "../api/types.js";
import { useGdprApi } from "./context.js";
import { gdprQueryKeys } from "./queryKeys.js";

/** What {@link useOwnersHealth} reports. */
export interface OwnersHealthBag {
  /**
   * Every DECLARED owner, answering or not. The table is built from the
   * inventory and not from the answers, which is the whole mechanism: an owner
   * that never replies must appear as a row that says so, because a table
   * assembled from replies would show a perfect, empty-of-problems list
   * exactly when the deployment is at its most broken.
   */
  readonly rows: LoadState<readonly DataOwnerHealth[]>;
  /** Owners with no `alive` inside `OWNER_ALIVE_MAX_AGE_HOURS` — the finding. */
  readonly silent: readonly DataOwnerHealth[];
  /**
   * Owners answering for a different set of subjects than the inventory
   * declares. Usually a library that was upgraded on one side of a fleet: it
   * still answers, so it is not silent, but an erasure of the subject it
   * stopped claiming now has no receipt slot at all.
   */
  readonly mismatched: readonly DataOwnerHealth[];
  readonly refetch: () => void;
}

/** Same membership both ways, order-insensitive. */
function sameSubjects(
  declared: readonly string[],
  answered: readonly string[]
): boolean {
  if (declared.length !== answered.length) return false;
  const seen = new Set(answered);
  return declared.every((subject) => seen.has(subject));
}

/**
 * The data-owner liveness table (staff) — the read behind the `gdpr.W006` boot
 * warning.
 *
 * ── Why a product ships an operations screen at all ───────────────────────
 *
 * Every erasure this module opens creates one receipt slot per declared owner
 * and waits. An owner that is deployed but whose `consume_actions` process was
 * never started answers nothing, forever: the erasure sits `queued`, the sweep
 * eventually marks it `timeout`, and the only trace is a log line nobody
 * reads. The probe/`alive` pair exists to make that visible BEFORE a deletion
 * deadline passes — the fleet audit that motivated it found seven silent
 * owners in a running product — and this hook is where a person can see it.
 *
 * `alive` is the SERVER's bit (it compares `last_alive_at` against the
 * configured max age), so nothing here re-derives liveness from a timestamp
 * and a guess at the deployment's threshold.
 *
 * The read is `IsAdminUser`; a non-staff caller gets `error.403.forbidden`,
 * which `isStaffOnly` names so the screen can say so rather than showing an
 * operations table's generic failure to somebody who is simply not an operator.
 */
export function useOwnersHealth(
  options: { readonly enabled?: boolean } = {}
): OwnersHealthBag {
  const api = useGdprApi();
  const sessionReady = useActiveSessionReady();
  const enabled = sessionReady && (options.enabled ?? true);

  const query = useQuery<readonly DataOwnerHealth[]>({
    queryKey: gdprQueryKeys.ownersHealth,
    queryFn: ({ signal }) => api.ownersHealth({ signal }),
    enabled,
  });

  const rows = loadStateFromQuery(query);
  const loaded = rows.status === "ready" ? rows.data : [];

  return {
    rows,
    silent: loaded.filter((row) => !row.alive),
    mismatched: loaded.filter(
      (row) =>
        row.alive &&
        !sameSubjects(
          row.declared_subject_types ?? [],
          row.answered_subject_types ?? []
        )
    ),
    refetch: () => {
      void query.refetch();
    },
  };
}
