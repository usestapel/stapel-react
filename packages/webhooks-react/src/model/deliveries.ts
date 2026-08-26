import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  useActiveSessionReady,
} from "@stapel/core";
import type {
  ActionAvailability,
  LoadState,
  StapelApiError,
} from "@stapel/core";
import type { Delivery, DeliveryStatus, ReplayResult } from "../api/types.js";
import { isDeliveryStatus } from "../api/types.js";
import { WEBHOOKS_EVENTS } from "../analytics/events.js";
import { useWebhooksAnalytics, useWebhooksApi } from "./context.js";
import { webhooksQueryKeys } from "./queryKeys.js";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";

/**
 * How often the log re-reads while something is still moving.
 *
 * stapel-webhooks has no stream: deliveries are retried by a task queue and
 * nothing pushes their state anywhere (`tasks.py`). A log that never re-read
 * would show `pending` until the person reloaded the page, which on the screen
 * somebody opens to watch a retry ladder is the whole point missed. 15 seconds
 * is slower than the fastest retry step and fast enough that a status change
 * is seen within one glance.
 */
export const DELIVERY_POLL_INTERVAL_MS = 15_000;

/** Statuses that mean "this row is not finished". */
const IN_FLIGHT: readonly DeliveryStatus[] = ["pending", "retrying"];

/** What {@link useDeliveries} reports. */
export interface DeliveriesBag {
  readonly rows: LoadState<readonly Delivery[]>;
  /** Whether the poll is currently running — the log shows this, quietly. */
  readonly polling: boolean;
  readonly refetch: () => void;
  /**
   * Replay one row. **Available only for a `dead` row**, with the reason
   * beside the control for every other status: the backend answers 409
   * `webhooks_not_replayable` for anything else, and a Replay button on a
   * succeeded delivery is a control whose only outcome is a refusal.
   */
  readonly replayGate: (row: Delivery) => ActionAvailability;
  readonly replay: UseMutationResult<ReplayResult, StapelApiError, string>;
}

/**
 * One rule's delivery log.
 *
 * ── The poll stops on its own ─────────────────────────────────────────────
 *
 * `refetchInterval` is a FUNCTION of the current rows, not a constant: it
 * returns `false` the moment nothing is `pending`/`retrying` any more. A log
 * of thirty finished deliveries therefore costs one request, and a settings
 * tab left open in a background window does not spend the rest of the day
 * asking a question whose answer stopped changing. `refetchIntervalInBackground`
 * is left off, so a hidden tab does not poll at all.
 */
export function useDeliveries(
  subscriptionId: string | undefined,
  status?: DeliveryStatus,
  options: { readonly enabled?: boolean } = {}
): DeliveriesBag {
  const api = useWebhooksApi();
  const analytics = useWebhooksAnalytics();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();
  const enabled =
    sessionReady && subscriptionId !== undefined && (options.enabled ?? true);

  const query = useQuery({
    queryKey: webhooksQueryKeys.deliveryList(subscriptionId ?? "", status ?? ""),
    queryFn: ({ signal }) =>
      api.deliveries(
        subscriptionId ?? "",
        status !== undefined ? { status } : undefined,
        { signal }
      ),
    enabled,
    refetchInterval: (q) => {
      const rows = q.state.data;
      if (!Array.isArray(rows)) return false;
      const moving = rows.some(
        (row) =>
          isDeliveryStatus(row.status) &&
          IN_FLIGHT.includes(row.status as DeliveryStatus)
      );
      return moving ? DELIVERY_POLL_INTERVAL_MS : false;
    },
  });

  const rows = loadStateFromQuery(query);

  // Derived straight from the load state rather than from a flattened copy:
  // "we could not read the log" and "nothing is in flight" are different
  // sentences, and only the union can tell them apart.
  const polling =
    rows.status === "ready" &&
    rows.data.some(
      (row) =>
        isDeliveryStatus(row.status) &&
        IN_FLIGHT.includes(row.status as DeliveryStatus)
    );

  const replay = useMutation<ReplayResult, StapelApiError, string>({
    mutationFn: (deliveryId) => api.replay(deliveryId),
    onSuccess: (result) => {
      analytics?.track(WEBHOOKS_EVENTS.deliveryReplayed);
      queryClient.removeQueries({
        queryKey: webhooksQueryKeys.delivery(result.id),
      });
      void queryClient.invalidateQueries({
        queryKey: webhooksQueryKeys.deliveries,
      });
    },
  });

  return {
    rows,
    polling,
    refetch: () => {
      void query.refetch();
    },
    replayGate: (row) =>
      row.status === "dead"
        ? actionAvailable()
        : actionBlocked(WEBHOOKS_I18N_KEYS.logReplayOnlyDead, {
            status: row.status,
          }),
    replay,
  };
}

/** One delivery, with its payload — the detail sheet's read. */
export function useDelivery(
  deliveryId: string | undefined,
  options: { readonly enabled?: boolean } = {}
): {
  readonly state: LoadState<Delivery>;
  readonly refetch: () => void;
} {
  const api = useWebhooksApi();
  const sessionReady = useActiveSessionReady();
  const enabled =
    sessionReady && deliveryId !== undefined && (options.enabled ?? true);

  const query = useQuery({
    queryKey: webhooksQueryKeys.delivery(deliveryId ?? ""),
    queryFn: ({ signal }) => api.delivery(deliveryId ?? "", { signal }),
    enabled,
  });

  return {
    state: loadStateFromQuery(query),
    refetch: () => {
      void query.refetch();
    },
  };
}
